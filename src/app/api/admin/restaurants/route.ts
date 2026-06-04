import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient, User } from "@supabase/supabase-js"
import type { Restaurant, RestaurantCreatePayload, UserProfile } from "@/types/app"

type RestaurantRequestBody = Partial<RestaurantCreatePayload>
type PasswordActionBody = {
  action?: "change" | "reset"
  restaurant_id?: string
  password?: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: NextRequest) {
  const clients = await getAuthorizedClients(request)

  if ("response" in clients) return clients.response

  const body = await request.json().catch(() => null) as RestaurantRequestBody | null
  const payload = normalizeRestaurantPayload(body)

  if (!payload) {
    return NextResponse.json({ error: "Completa nombre, correo, telefono, fecha y plan." }, { status: 400 })
  }

  const { data: restaurant, error: restaurantError } = await clients.serviceClient
    .from("restaurantes")
    .insert(payload)
    .select("*")
    .single<Restaurant>()

  if (restaurantError || !restaurant) {
    return NextResponse.json(
      { error: restaurantError?.message ?? "No se pudo registrar el emprendimiento." },
      { status: 400 }
    )
  }

  const adminUser = await ensureAdminUser(clients.serviceClient, restaurant, { resetPassword: true })

  if ("error" in adminUser) {
    await clients.serviceClient.from("restaurantes").delete().eq("id", restaurant.id)
    return NextResponse.json({ error: adminUser.error }, { status: 400 })
  }

  return NextResponse.json({ restaurant })
}

export async function PATCH(request: NextRequest) {
  const clients = await getAuthorizedClients(request)

  if ("response" in clients) return clients.response

  const body = await request.json().catch(() => null) as PasswordActionBody | null
  const restaurantId = String(body?.restaurant_id ?? "").trim()
  const action = body?.action

  if (!restaurantId || !action) {
    return NextResponse.json({ error: "Selecciona un emprendimiento y una accion valida." }, { status: 400 })
  }

  const { data: restaurant, error: restaurantError } = await clients.serviceClient
    .from("restaurantes")
    .select("*")
    .eq("id", restaurantId)
    .single<Restaurant>()

  if (restaurantError || !restaurant) {
    return NextResponse.json({ error: "No se encontro el emprendimiento." }, { status: 404 })
  }

  const adminUser = await ensureAdminUser(clients.serviceClient, restaurant)

  if ("error" in adminUser) {
    return NextResponse.json({ error: adminUser.error }, { status: 400 })
  }

  if (action === "change") {
    const password = String(body?.password ?? "").trim()

    if (password.length < 6) {
      return NextResponse.json({ error: "La contrasena debe tener minimo 6 caracteres." }, { status: 400 })
    }

    const { error } = await clients.serviceClient.auth.admin.updateUserById(adminUser.user.id, {
      password,
      user_metadata: createAdminMetadata(restaurant.nombre, false)
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  const { error } = await clients.serviceClient.auth.admin.updateUserById(adminUser.user.id, {
    password: createPendingPassword(),
    user_metadata: createAdminMetadata(restaurant.nombre, true)
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

function normalizeRestaurantPayload(body: RestaurantRequestBody | null): RestaurantCreatePayload | null {
  if (!body) return null

  const payload: RestaurantCreatePayload = {
    nombre: String(body.nombre ?? "").trim(),
    admin_email: String(body.admin_email ?? "").trim().toLowerCase(),
    telefono: String(body.telefono ?? "").trim(),
    nivel_suscripcion: body.nivel_suscripcion ?? "Basico",
    fecha_suscripcion: String(body.fecha_suscripcion ?? "").trim(),
    activo: Boolean(body.activo)
  }

  if (!payload.nombre || !payload.admin_email || !payload.telefono || !payload.fecha_suscripcion) {
    return null
  }

  return payload
}

async function getAuthorizedClients(request: NextRequest) {
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return {
      response: NextResponse.json(
        { error: "Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      )
    }
  }

  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    return {
      response: NextResponse.json({ error: "Sesion administrativa no encontrada." }, { status: 401 })
    }
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

  const accessToken = authorization.slice("Bearer ".length)
  const { data: authData, error: authError } = await requesterClient.auth.getUser(accessToken)
  const userId = authData.user?.id

  if (authError || !userId) {
    return {
      response: NextResponse.json({ error: "Sesion administrativa no encontrada." }, { status: 401 })
    }
  }

  const { data: profile, error: profileError } = await requesterClient
    .from("usuarios")
    .select("rol")
    .eq("user_id", userId)
    .maybeSingle<Pick<UserProfile, "rol">>()

  if (profileError || !profile || profile.rol !== "SuperAdministrador") {
    return {
      response: NextResponse.json({ error: "Solo un SuperAdministrador puede gestionar emprendimientos." }, { status: 403 })
    }
  }

  return {
    serviceClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
}

async function ensureAdminUser(
  serviceClient: SupabaseClient,
  restaurant: Restaurant,
  options: { resetPassword?: boolean } = {}
): Promise<{ user: User } | { error: string }> {
  const { data: profile } = await serviceClient
    .from("usuarios")
    .select("user_id")
    .ilike("email", restaurant.admin_email)
    .maybeSingle<{ user_id: string }>()

  let user: User | null = null

  if (profile?.user_id) {
    const { data, error } = await serviceClient.auth.admin.getUserById(profile.user_id)

    if (data.user) {
      user = data.user
    }

    if (error && !isMissingUserError(error.message)) {
      return { error: error.message }
    }
  }

  if (!user) {
    const existingUser = await findAuthUserByEmail(serviceClient, restaurant.admin_email)

    if ("error" in existingUser) {
      return { error: existingUser.error }
    }

    user = existingUser.user
  }

  if (user) {
    if (options.resetPassword) {
      const { data, error } = await serviceClient.auth.admin.updateUserById(user.id, {
        password: createPendingPassword(),
        user_metadata: createAdminMetadata(restaurant.nombre, true)
      })

      if (error || !data.user) {
        return { error: error?.message ?? "No se pudo dejar la cuenta pendiente." }
      }

      user = data.user
    }

    const { error: profileError } = await upsertAdminProfile(serviceClient, user.id, restaurant)

    if (profileError) {
      return { error: profileError.message }
    }

    return { user }
  }

  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: restaurant.admin_email,
    password: createPendingPassword(),
    email_confirm: true,
    user_metadata: createAdminMetadata(restaurant.nombre, true)
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? "No se pudo crear la cuenta pendiente." }
  }

  const { error: profileError } = await upsertAdminProfile(serviceClient, authData.user.id, restaurant)

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    return { error: profileError.message }
  }

  return { user: authData.user }
}

async function findAuthUserByEmail(
  serviceClient: SupabaseClient,
  email: string
): Promise<{ user: User | null } | { error: string }> {
  const normalizedEmail = email.toLowerCase()
  let page = 1

  while (page <= 20) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 100
    })

    if (error) {
      return { error: error.message }
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail)

    if (user) {
      return { user }
    }

    if (data.users.length < 100) {
      return { user: null }
    }

    page += 1
  }

  return { user: null }
}

function upsertAdminProfile(serviceClient: SupabaseClient, userId: string, restaurant: Restaurant) {
  return serviceClient.from("usuarios").upsert(
    {
      user_id: userId,
      email: restaurant.admin_email,
      nombre: restaurant.nombre,
      rol: "Administrador",
      restaurante_id: restaurant.id,
      activo: true
    },
    { onConflict: "user_id" }
  )
}

function createPendingPassword() {
  return `${randomUUID()}${randomUUID().slice(0, 20)}`
}

function createAdminMetadata(name: string, passwordPending: boolean) {
  return {
    name,
    cuadre_password_pending: passwordPending
  }
}

function isMissingUserError(message: string) {
  return message.toLowerCase().includes("not found")
}
