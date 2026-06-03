create extension if not exists pgcrypto;

create table if not exists public.restaurantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  admin_email text not null,
  telefono text not null,
  nivel_suscripcion text not null default 'Basico' check (
    nivel_suscripcion in ('Gratis', 'Basico', 'Completo', 'Emprendedor')
  ),
  fecha_suscripcion date not null default ((timezone('America/Bogota', now()))::date),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usuarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  rol text not null default 'Administrador' check (rol in ('SuperAdministrador', 'Administrador')),
  restaurante_id uuid references public.restaurantes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.planes_suscripcion (
  nivel text primary key check (
    nivel in ('Gratis', 'Basico', 'Completo', 'Emprendedor')
  ),
  nombre text not null,
  precio integer not null default 0 check (precio >= 0),
  orden integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.planes_suscripcion (nivel, nombre, precio, orden)
values
  ('Gratis', 'Gratis', 0, 1),
  ('Basico', 'Basico', 19000, 2),
  ('Completo', 'Completo', 29000, 3),
  ('Emprendedor', 'Emprendedor', 0, 4)
on conflict (nivel) do nothing;

alter table public.usuarios
add column if not exists rol text not null default 'Administrador',
add column if not exists restaurante_id uuid references public.restaurantes(id) on delete set null;

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid references public.restaurantes(id) on delete cascade,
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
add column if not exists tipo_item text not null default 'producto',
add column if not exists restaurante_id uuid references public.restaurantes(id) on delete cascade;

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
  restaurante_id uuid references public.restaurantes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  folio_diario integer not null,
  fecha timestamptz not null default now(),
  fecha_dia date not null default ((timezone('America/Bogota', now()))::date),
  total integer not null check (total >= 0),
  dinero_recibido integer not null check (dinero_recibido >= 0),
  cambio integer not null check (cambio >= 0),
  eliminado boolean not null default false,
  eliminado_motivo text,
  eliminado_at timestamptz,
  eliminado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurante_id, fecha_dia, folio_diario)
);

create table if not exists public.egresos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid references public.restaurantes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  descripcion text not null,
  valor integer not null check (valor > 0),
  fecha timestamptz not null default now(),
  fecha_dia date not null default ((timezone('America/Bogota', now()))::date),
  eliminado boolean not null default false,
  eliminado_motivo text,
  eliminado_at timestamptz,
  eliminado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ventas
add column if not exists restaurante_id uuid references public.restaurantes(id) on delete cascade,
add column if not exists eliminado boolean not null default false,
add column if not exists eliminado_motivo text,
add column if not exists eliminado_at timestamptz,
add column if not exists eliminado_por uuid references auth.users(id) on delete set null;

alter table public.egresos
add column if not exists restaurante_id uuid references public.restaurantes(id) on delete cascade,
add column if not exists eliminado boolean not null default false,
add column if not exists eliminado_motivo text,
add column if not exists eliminado_at timestamptz,
add column if not exists eliminado_por uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_rol_check'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
    add constraint usuarios_rol_check check (rol in ('SuperAdministrador', 'Administrador'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurantes_nivel_suscripcion_check'
      and conrelid = 'public.restaurantes'::regclass
  ) then
    alter table public.restaurantes
    add constraint restaurantes_nivel_suscripcion_check
    check (nivel_suscripcion in ('Gratis', 'Basico', 'Completo', 'Emprendedor'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ventas_anulacion_motivo_check'
      and conrelid = 'public.ventas'::regclass
  ) then
    alter table public.ventas
    add constraint ventas_anulacion_motivo_check
    check (
      eliminado = false
      or (
        eliminado_motivo is not null
        and btrim(eliminado_motivo) <> ''
        and eliminado_at is not null
        and eliminado_por is not null
      )
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'egresos_anulacion_motivo_check'
      and conrelid = 'public.egresos'::regclass
  ) then
    alter table public.egresos
    add constraint egresos_anulacion_motivo_check
    check (
      eliminado = false
      or (
        eliminado_motivo is not null
        and btrim(eliminado_motivo) <> ''
        and eliminado_at is not null
        and eliminado_por is not null
      )
    );
  end if;
end;
$$;

alter table public.ventas
drop constraint if exists ventas_fecha_dia_folio_diario_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ventas_restaurante_fecha_folio_key'
      and conrelid = 'public.ventas'::regclass
  ) then
    alter table public.ventas
    add constraint ventas_restaurante_fecha_folio_key unique (restaurante_id, fecha_dia, folio_diario);
  end if;
end;
$$;

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
  restaurante_id uuid references public.restaurantes(id) on delete cascade,
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

alter table public.movimientos_inventario
add column if not exists restaurante_id uuid references public.restaurantes(id) on delete cascade;

create index if not exists idx_productos_activo on public.productos(activo);
create index if not exists idx_productos_tipo_item on public.productos(tipo_item);
create index if not exists idx_productos_restaurante on public.productos(restaurante_id, activo);
create index if not exists idx_ventas_fecha_dia on public.ventas(fecha_dia desc);
create index if not exists idx_ventas_activas_fecha_dia on public.ventas(restaurante_id, fecha_dia desc) where eliminado = false;
create index if not exists idx_egresos_user_fecha_dia on public.egresos(user_id, fecha_dia desc);
create index if not exists idx_egresos_activos_fecha_dia on public.egresos(restaurante_id, fecha_dia desc) where eliminado = false;
create index if not exists idx_detalle_ventas_venta on public.detalle_ventas(venta_id);
create index if not exists idx_movimientos_producto on public.movimientos_inventario(producto_id);
create index if not exists idx_restaurantes_admin_email on public.restaurantes(lower(admin_email));
create index if not exists idx_usuarios_restaurante on public.usuarios(restaurante_id);

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

drop trigger if exists trg_restaurantes_updated_at on public.restaurantes;
create trigger trg_restaurantes_updated_at
before update on public.restaurantes
for each row execute function public.set_updated_at();

drop trigger if exists trg_planes_suscripcion_updated_at on public.planes_suscripcion;
create trigger trg_planes_suscripcion_updated_at
before update on public.planes_suscripcion
for each row execute function public.set_updated_at();

drop trigger if exists trg_egresos_updated_at on public.egresos;
create trigger trg_egresos_updated_at
before update on public.egresos
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol
  from public.usuarios
  where user_id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'SuperAdministrador', false)
$$;

create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurante_id
  from public.usuarios
  where user_id = auth.uid()
$$;

create or replace function public.current_restaurant_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select restaurantes.activo
    from public.restaurantes
    where restaurantes.id = public.current_restaurant_id()
  ), false)
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurante_id uuid;
begin
  select id
  into v_restaurante_id
  from public.restaurantes
  where lower(admin_email) = lower(coalesce(new.email, ''))
  order by created_at desc
  limit 1;

  insert into public.usuarios (user_id, email, nombre, rol, restaurante_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    'Administrador',
    v_restaurante_id
  )
  on conflict (user_id) do update set
    email = excluded.email,
    restaurante_id = coalesce(public.usuarios.restaurante_id, excluded.restaurante_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop function if exists public.registrar_venta(jsonb, integer);

create or replace function public.registrar_venta(
  p_items jsonb,
  p_dinero_recibido integer,
  p_restaurante_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_user_restaurante_id uuid := public.current_restaurant_id();
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

  if p_restaurante_id is null then
    raise exception 'El restaurante de la venta es obligatorio';
  end if;

  if not public.is_super_admin() and not public.current_restaurant_is_active() then
    raise exception 'El acceso de este emprendimiento esta suspendido';
  end if;

  if not public.is_super_admin() and v_user_restaurante_id <> p_restaurante_id then
    raise exception 'No puedes registrar ventas para otro restaurante';
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

    select * into v_product
    from public.productos
    where id = v_product_id
      and restaurante_id = p_restaurante_id
    for update;

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
  where fecha_dia = v_fecha_dia
    and restaurante_id = p_restaurante_id;

  insert into public.ventas (
    restaurante_id,
    user_id,
    folio_diario,
    fecha_dia,
    total,
    dinero_recibido,
    cambio
  )
  values (
    p_restaurante_id,
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

    select * into v_product
    from public.productos
    where id = v_product_id
      and restaurante_id = p_restaurante_id
    for update;

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

grant execute on function public.registrar_venta(jsonb, integer, uuid) to authenticated;

create or replace function public.anular_venta(
  p_venta_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_restaurante_id uuid := public.current_restaurant_id();
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion para anular ventas';
  end if;

  if v_motivo = '' then
    raise exception 'El motivo de anulacion es obligatorio';
  end if;

  if not public.is_super_admin() and not public.current_restaurant_is_active() then
    raise exception 'El acceso de este emprendimiento esta suspendido';
  end if;

  update public.ventas
  set
    eliminado = true,
    eliminado_motivo = v_motivo,
    eliminado_at = now(),
    eliminado_por = v_user
  where id = p_venta_id
    and (public.is_super_admin() or restaurante_id = v_restaurante_id)
    and eliminado = false;

  if not found then
    raise exception 'No se encontro una venta activa para anular';
  end if;
end;
$$;

grant execute on function public.anular_venta(uuid, text) to authenticated;

create or replace function public.anular_egreso(
  p_egreso_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_restaurante_id uuid := public.current_restaurant_id();
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion para anular egresos';
  end if;

  if v_motivo = '' then
    raise exception 'El motivo de anulacion es obligatorio';
  end if;

  if not public.is_super_admin() and not public.current_restaurant_is_active() then
    raise exception 'El acceso de este emprendimiento esta suspendido';
  end if;

  update public.egresos
  set
    eliminado = true,
    eliminado_motivo = v_motivo,
    eliminado_at = now(),
    eliminado_por = v_user
  where id = p_egreso_id
    and (public.is_super_admin() or restaurante_id = v_restaurante_id)
    and eliminado = false;

  if not found then
    raise exception 'No se encontro un egreso activo para anular';
  end if;
end;
$$;

grant execute on function public.anular_egreso(uuid, text) to authenticated;

create or replace function public.restaurar_venta(
  p_venta_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_restaurante_id uuid := public.current_restaurant_id();
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion para restaurar ventas';
  end if;

  if not public.is_super_admin() and not public.current_restaurant_is_active() then
    raise exception 'El acceso de este emprendimiento esta suspendido';
  end if;

  update public.ventas
  set eliminado = false
  where id = p_venta_id
    and (public.is_super_admin() or restaurante_id = v_restaurante_id)
    and eliminado = true;

  if not found then
    raise exception 'No se encontro una venta anulada para restaurar';
  end if;
end;
$$;

grant execute on function public.restaurar_venta(uuid) to authenticated;

create or replace function public.restaurar_egreso(
  p_egreso_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_restaurante_id uuid := public.current_restaurant_id();
begin
  if v_user is null then
    raise exception 'Debes iniciar sesion para restaurar egresos';
  end if;

  if not public.is_super_admin() and not public.current_restaurant_is_active() then
    raise exception 'El acceso de este emprendimiento esta suspendido';
  end if;

  update public.egresos
  set eliminado = false
  where id = p_egreso_id
    and (public.is_super_admin() or restaurante_id = v_restaurante_id)
    and eliminado = true;

  if not found then
    raise exception 'No se encontro un egreso anulado para restaurar';
  end if;
end;
$$;

grant execute on function public.restaurar_egreso(uuid) to authenticated;

alter table public.restaurantes enable row level security;
alter table public.planes_suscripcion enable row level security;
alter table public.usuarios enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.egresos enable row level security;
alter table public.detalle_ventas enable row level security;
alter table public.movimientos_inventario enable row level security;

drop policy if exists "Usuarios leen su perfil" on public.usuarios;
create policy "Usuarios leen su perfil"
on public.usuarios for select
to authenticated
using (auth.uid() = user_id or public.is_super_admin());

drop policy if exists "Usuarios actualizan su perfil" on public.usuarios;
create policy "Usuarios actualizan su perfil"
on public.usuarios for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Superadministradores gestionan usuarios" on public.usuarios;
create policy "Superadministradores gestionan usuarios"
on public.usuarios for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Restaurantes visibles por rol" on public.restaurantes;
create policy "Restaurantes visibles por rol"
on public.restaurantes for select
to authenticated
using (public.is_super_admin() or id = public.current_restaurant_id());

drop policy if exists "Superadministradores gestionan restaurantes" on public.restaurantes;
create policy "Superadministradores gestionan restaurantes"
on public.restaurantes for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Planes visibles por autenticados" on public.planes_suscripcion;
create policy "Planes visibles por autenticados"
on public.planes_suscripcion for select
to authenticated
using (true);

drop policy if exists "Superadministradores gestionan planes" on public.planes_suscripcion;
create policy "Superadministradores gestionan planes"
on public.planes_suscripcion for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Autenticados gestionan productos" on public.productos;
create policy "Autenticados gestionan productos"
on public.productos for all
to authenticated
using (
  public.is_super_admin()
  or (restaurante_id = public.current_restaurant_id() and public.current_restaurant_is_active())
)
with check (
  public.is_super_admin()
  or (restaurante_id = public.current_restaurant_id() and public.current_restaurant_is_active())
);

drop policy if exists "Usuarios leen sus ventas" on public.ventas;
create policy "Usuarios leen sus ventas"
on public.ventas for select
to authenticated
using (
  public.is_super_admin()
  or (restaurante_id = public.current_restaurant_id() and public.current_restaurant_is_active())
);

drop policy if exists "Usuarios insertan sus ventas" on public.ventas;
create policy "Usuarios insertan sus ventas"
on public.ventas for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    public.is_super_admin()
    or (restaurante_id = public.current_restaurant_id() and public.current_restaurant_is_active())
  )
);

drop policy if exists "Usuarios actualizan sus ventas" on public.ventas;

drop policy if exists "Usuarios leen sus egresos" on public.egresos;
create policy "Usuarios leen sus egresos"
on public.egresos for select
to authenticated
using (
  public.is_super_admin()
  or (restaurante_id = public.current_restaurant_id() and public.current_restaurant_is_active())
);

drop policy if exists "Usuarios insertan sus egresos" on public.egresos;
create policy "Usuarios insertan sus egresos"
on public.egresos for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    public.is_super_admin()
    or (restaurante_id = public.current_restaurant_id() and public.current_restaurant_is_active())
  )
);

drop policy if exists "Usuarios actualizan sus egresos" on public.egresos;

drop policy if exists "Usuarios eliminan sus egresos" on public.egresos;

drop policy if exists "Usuarios leen detalle de sus ventas" on public.detalle_ventas;
create policy "Usuarios leen detalle de sus ventas"
on public.detalle_ventas for select
to authenticated
using (
  exists (
    select 1
    from public.ventas
    where ventas.id = detalle_ventas.venta_id
      and (public.is_super_admin() or ventas.restaurante_id = public.current_restaurant_id())
      and (public.is_super_admin() or public.current_restaurant_is_active())
  )
);

drop policy if exists "Autenticados gestionan movimientos" on public.movimientos_inventario;
create policy "Autenticados gestionan movimientos"
on public.movimientos_inventario for all
to authenticated
using (
  public.is_super_admin()
  or (restaurante_id = public.current_restaurant_id() and public.current_restaurant_is_active())
)
with check (
  public.is_super_admin()
  or (restaurante_id = public.current_restaurant_id() and public.current_restaurant_is_active())
);
