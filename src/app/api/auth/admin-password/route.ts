import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient, User } from "@supabase/supabase-js"
import type { Restaurant } from "@/types/app"

type PasswordBody = {
  email?: string
  password?: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request: NextRequest) {
  const serviceClient = getServiceClient()

  if ("response" in serviceClient) return serviceClient.response

  const email = normalizeEmail(request.nextUrl.searchParams.get("email"))

  if (!email) {
    return NextResponse.json({ isAuthorized: false, passwordPending: false })
  }

  const account = await findAdminAccount(serviceClient.client, email)

  if ("error" in account) {
    return NextResponse.json({ isAuthorized: false, passwordPending: false })
  }

  if (!account.restaurant) {
    return NextResponse.json({ isAuthorized: false, passwordPending: false })
  }

  if (!account.user) {
    return NextResponse.json({ isAuthorized: true, passwordPending: true })
  }

  return NextResponse.json({ isAuthorized: true, passwordPending: isPasswordPending(account.user) })
}

export async function POST(request: NextRequest) {
  const serviceClient = getServiceClient()

  if ("response" in serviceClient) return serviceClient.response

  const body = await request.json().catch(() => null) as PasswordBody | null
  const email = normalizeEmail(body?.email)
  const password = String(body?.password ?? "").trim()

  if (!email || password.length < 6) {
    return NextResponse.json({ error: "Ingresa correo y una contrasena de minimo 6 caracteres." }, { status: 400 })
  }

  const account = await findAdminAccount(serviceClient.client, email)

  if ("error" in account || !account.restaurant) {
    return NextResponse.json({ error: "No hay un emprendimiento autorizado para este correo." }, { status: 404 })
  }

  if (!account.user) {
    const { data, error } = await serviceClient.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: createAdminMetadata(account.restaurant.nombre, false)
    })

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "No se pudo crear el acceso." }, { status: 400 })
    }

    const { error: profileError } = await upsertAdminProfile(serviceClient.client, data.user.id, account.restaurant)

    if (profileError) {
      await serviceClient.client.auth.admin.deleteUser(data.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (!isPasswordPending(account.user)) {
    return NextResponse.json({ error: "La contrasena ya esta configurada." }, { status: 403 })
  }

  const { error } = await serviceClient.client.auth.admin.updateUserById(account.user.id, {
    password,
    user_metadata: createAdminMetadata(account.restaurant.nombre, false)
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await upsertAdminProfile(serviceClient.client, account.user.id, account.restaurant)

  return NextResponse.json({ ok: true })
}

function getServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      response: NextResponse.json(
        { error: "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      )
    }
  }

  return {
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
}

async function findAdminAccount(
  serviceClient: SupabaseClient,
  email: string
): Promise<{ restaurant: Restaurant | null; user: User | null } | { error: string }> {
  const { data: restaurant, error: restaurantError } = await serviceClient
    .from("restaurantes")
    .select("*")
    .ilike("admin_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Restaurant>()

  if (restaurantError) {
    return { error: restaurantError.message }
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("usuarios")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle<{ user_id: string }>()

  if (profileError) {
    return { error: profileError.message }
  }

  if (!profile?.user_id) {
    const existingUser = await findAuthUserByEmail(serviceClient, email)

    if ("error" in existingUser) {
      return { error: existingUser.error }
    }

    return {
      restaurant: restaurant ?? null,
      user: existingUser.user
    }
  }

  const { data, error } = await serviceClient.auth.admin.getUserById(profile.user_id)

  if (error) {
    return { error: error.message }
  }

  return {
    restaurant: restaurant ?? null,
    user: data.user
  }
}

function upsertAdminProfile(serviceClient: SupabaseClient, userId: string, restaurant: Restaurant) {
  return serviceClient.from("usuarios").upsert(
    {
      user_id: userId,
      email: restaurant.admin_email,
      nombre: restaurant.nombre,
      rol: "Administrador",
      restaurante_id: restaurant.id
    },
    { onConflict: "user_id" }
  )
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

function isPasswordPending(user: User) {
  return user.user_metadata?.cuadre_password_pending === true
}

function createAdminMetadata(name: string, passwordPending: boolean) {
  return {
    name,
    cuadre_password_pending: passwordPending
  }
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}
