create extension if not exists pgcrypto;

create table if not exists public.usuarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  created_at timestamptz not null default now()
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  tipo_item text not null default 'producto' check (tipo_item in ('producto', 'inventario')),
  precio integer not null default 0 check (precio >= 0),
  cantidad_stock integer not null default 0 check (cantidad_stock >= 0),
  tipo_unidad text not null default 'unidad',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.productos
add column if not exists tipo_item text not null default 'producto';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_tipo_item_check'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
    add constraint productos_tipo_item_check check (tipo_item in ('producto', 'inventario'));
  end if;
end;
$$;

create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  folio_diario integer not null,
  fecha timestamptz not null default now(),
  fecha_dia date not null default ((timezone('America/Bogota', now()))::date),
  total integer not null check (total >= 0),
  dinero_recibido integer not null check (dinero_recibido >= 0),
  cambio integer not null check (cambio >= 0),
  created_at timestamptz not null default now(),
  unique (fecha_dia, folio_diario)
);

create table if not exists public.detalle_ventas (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  producto_nombre text not null,
  precio_unitario integer not null check (precio_unitario >= 0),
  cantidad integer not null check (cantidad > 0),
  subtotal integer not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  tipo_movimiento text not null check (
    tipo_movimiento in ('entrada', 'venta', 'ajuste', 'deshabilitado')
  ),
  cantidad integer not null,
  stock_antes integer not null,
  stock_despues integer not null,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists idx_productos_activo on public.productos(activo);
create index if not exists idx_productos_tipo_item on public.productos(tipo_item);
create index if not exists idx_ventas_fecha_dia on public.ventas(fecha_dia desc);
create index if not exists idx_detalle_ventas_venta on public.detalle_ventas(venta_id);
create index if not exists idx_movimientos_producto on public.movimientos_inventario(producto_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_productos_updated_at on public.productos;
create trigger trg_productos_updated_at
before update on public.productos
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (user_id, email, nombre)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (user_id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.registrar_venta(
  p_items jsonb,
  p_dinero_recibido integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_fecha_dia date := ((timezone('America/Bogota', now()))::date);
  v_folio integer;
  v_total integer := 0;
  v_qty integer;
  v_product productos%rowtype;
  v_sale ventas%rowtype;
  v_item jsonb;
  v_product_id uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion para registrar ventas';
  end if;

  if p_dinero_recibido is null or p_dinero_recibido < 0 then
    raise exception 'El dinero recibido no es valido';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as item(value) loop
    v_product_id := (v_item ->> 'producto_id')::uuid;
    v_qty := (v_item ->> 'cantidad')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'La cantidad de venta no es valida';
    end if;

    select * into v_product from public.productos where id = v_product_id for update;

    if not found then
      raise exception 'El producto no existe';
    end if;

    if not v_product.activo then
      raise exception 'El producto % esta deshabilitado', v_product.nombre;
    end if;

    if v_product.tipo_item <> 'producto' then
      raise exception '% no esta marcado como producto de venta', v_product.nombre;
    end if;

    v_total := v_total + (v_product.precio * v_qty);
  end loop;

  if p_dinero_recibido < v_total then
    raise exception 'El dinero recibido es menor al total';
  end if;

  lock table public.ventas in exclusive mode;

  select coalesce(max(folio_diario), 0) + 1
  into v_folio
  from public.ventas
  where fecha_dia = v_fecha_dia;

  insert into public.ventas (
    user_id,
    folio_diario,
    fecha_dia,
    total,
    dinero_recibido,
    cambio
  )
  values (
    v_user,
    v_folio,
    v_fecha_dia,
    v_total,
    p_dinero_recibido,
    p_dinero_recibido - v_total
  )
  returning * into v_sale;

  for v_item in select value from jsonb_array_elements(p_items) as item(value) loop
    v_product_id := (v_item ->> 'producto_id')::uuid;
    v_qty := (v_item ->> 'cantidad')::integer;

    select * into v_product from public.productos where id = v_product_id for update;

    insert into public.detalle_ventas (
      venta_id,
      producto_id,
      producto_nombre,
      precio_unitario,
      cantidad,
      subtotal
    )
    values (
      v_sale.id,
      v_product.id,
      v_product.nombre,
      v_product.precio,
      v_qty,
      v_product.precio * v_qty
    );
  end loop;

  return jsonb_build_object(
    'venta_id', v_sale.id,
    'folio_diario', v_sale.folio_diario,
    'fecha', v_sale.fecha,
    'fecha_dia', v_sale.fecha_dia,
    'total', v_sale.total,
    'dinero_recibido', v_sale.dinero_recibido,
    'cambio', v_sale.cambio
  );
end;
$$;

grant execute on function public.registrar_venta(jsonb, integer) to authenticated;

alter table public.usuarios enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.detalle_ventas enable row level security;
alter table public.movimientos_inventario enable row level security;

drop policy if exists "Usuarios leen su perfil" on public.usuarios;
create policy "Usuarios leen su perfil"
on public.usuarios for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Usuarios actualizan su perfil" on public.usuarios;
create policy "Usuarios actualizan su perfil"
on public.usuarios for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Autenticados gestionan productos" on public.productos;
create policy "Autenticados gestionan productos"
on public.productos for all
to authenticated
using (true)
with check (true);

drop policy if exists "Usuarios leen sus ventas" on public.ventas;
create policy "Usuarios leen sus ventas"
on public.ventas for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Usuarios insertan sus ventas" on public.ventas;
create policy "Usuarios insertan sus ventas"
on public.ventas for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Usuarios leen detalle de sus ventas" on public.detalle_ventas;
create policy "Usuarios leen detalle de sus ventas"
on public.detalle_ventas for select
to authenticated
using (
  exists (
    select 1
    from public.ventas
    where ventas.id = detalle_ventas.venta_id
      and ventas.user_id = auth.uid()
  )
);

drop policy if exists "Autenticados gestionan movimientos" on public.movimientos_inventario;
create policy "Autenticados gestionan movimientos"
on public.movimientos_inventario for all
to authenticated
using (true)
with check (true);
