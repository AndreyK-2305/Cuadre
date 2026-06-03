import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Restaurant, RestaurantCreatePayload, UserProfile } from "@/types/app"

type RestaurantRequestBody = Partial<RestaurantCreatePayload>

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    )
  }

  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Sesion administrativa no encontrada." }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as RestaurantRequestBody | null
  const payload = normalizeRestaurantPayload(body)

  if (!payload) {
    return NextResponse.json({ error: "Completa nombre, correo, telefono, fecha, plan y contrasena." }, { status: 400 })
  }

  if (payload.admin_password.length < 6) {
    return NextResponse.json({ error: "La contrasena debe tener minimo 6 caracteres." }, { status: 400 })
  }

  const requesterClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: authorization
      }
    }
  })

  const { data: profile, error: profileError } = await requesterClient
    .from("usuarios")
    .select("rol")
    .single<Pick<UserProfile, "rol">>()

  if (profileError || profile?.rol !== "SuperAdministrador") {
    return NextResponse.json({ error: "Solo un SuperAdministrador puede crear restaurantes." }, { status: 403 })
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: payload.admin_email,
    password: payload.admin_password,
    email_confirm: true,
    user_metadata: {
      name: payload.nombre
    }
  })

  const adminUserId = authData.user?.id

  if (authError || !adminUserId) {
    return NextResponse.json(
      { error: authError?.message ?? "No se pudo crear el usuario administrador." },
      { status: 409 }
    )
  }

  const restaurantPayload = {
    nombre: payload.nombre,
    admin_email: payload.admin_email,
    telefono: payload.telefono,
    nivel_suscripcion: payload.nivel_suscripcion,
    fecha_suscripcion: payload.fecha_suscripcion,
    activo: payload.activo
  }

  const { data: restaurant, error: restaurantError } = await serviceClient
    .from("restaurantes")
    .insert(restaurantPayload)
    .select("*")
    .single<Restaurant>()

  if (restaurantError || !restaurant) {
    await serviceClient.auth.admin.deleteUser(adminUserId)
    return NextResponse.json(
      { error: restaurantError?.message ?? "No se pudo registrar el restaurante." },
      { status: 400 }
    )
  }

  const { error: userProfileError } = await serviceClient.from("usuarios").upsert(
    {
      user_id: adminUserId,
      email: payload.admin_email,
      nombre: payload.nombre,
      rol: "Administrador",
      restaurante_id: restaurant.id
    },
    { onConflict: "user_id" }
  )

  if (userProfileError) {
    await serviceClient.from("restaurantes").delete().eq("id", restaurant.id)
    await serviceClient.auth.admin.deleteUser(adminUserId)
    return NextResponse.json({ error: userProfileError.message }, { status: 400 })
  }

  return NextResponse.json({ restaurant })
}

function normalizeRestaurantPayload(body: RestaurantRequestBody | null): RestaurantCreatePayload | null {
  if (!body) return null

  const payload: RestaurantCreatePayload = {
    nombre: String(body.nombre ?? "").trim(),
    admin_email: String(body.admin_email ?? "").trim().toLowerCase(),
    telefono: String(body.telefono ?? "").trim(),
    nivel_suscripcion: body.nivel_suscripcion ?? "Basico",
    fecha_suscripcion: String(body.fecha_suscripcion ?? "").trim(),
    activo: Boolean(body.activo),
    admin_password: String(body.admin_password ?? "").trim()
  }

  if (!payload.nombre || !payload.admin_email || !payload.telefono || !payload.fecha_suscripcion) {
    return null
  }

  return payload
}
