import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient, User } from "@supabase/supabase-js"
import type { Restaurant, UserProfile } from "@/types/app"

type PasswordBody = {
  email?: string
  password?: string
}

type AccessState = "authorized" | "inactive" | "not_registered"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request: NextRequest) {
  const serviceClient = getServiceClient()

  if ("response" in serviceClient) return serviceClient.response

  const email = normalizeEmail(request.nextUrl.searchParams.get("email"))

  if (!email) {
    return NextResponse.json({ isAuthorized: false, passwordPending: false, accessState: "not_registered" satisfies AccessState })
  }

  const { data: restaurant, error: restaurantError } = await serviceClient.client
    .from("restaurantes")
    .select("*")
    .ilike("admin_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Restaurant>()

  if (restaurantError) {
    return NextResponse.json({ isAuthorized: false, passwordPending: false, accessState: "inactive" satisfies AccessState })
  }

  if (!restaurant) {
    return NextResponse.json({ isAuthorized: false, passwordPending: false, accessState: "not_registered" satisfies AccessState })
  }

  if (!restaurant.activo) {
    return NextResponse.json({ isAuthorized: false, passwordPending: false, accessState: "inactive" satisfies AccessState })
  }

  const account = await findAuthorizedAccount(serviceClient.client, email)

  if ("error" in account || !account.restaurant) {
    return NextResponse.json({ isAuthorized: false, passwordPending: false, accessState: "inactive" satisfies AccessState })
  }

  if (!account.user) {
    return NextResponse.json({ isAuthorized: true, passwordPending: true, accessState: "authorized" satisfies AccessState })
  }

  return NextResponse.json({
    isAuthorized: true,
    passwordPending: isPasswordPending(account.user),
    accessState: "authorized" satisfies AccessState
  })
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

  const account = await findAuthorizedAccount(serviceClient.client, email)

  if ("error" in account || !account.restaurant) {
    return NextResponse.json({ error: "No hay un emprendimiento autorizado para este correo." }, { status: 404 })
  }

  const authorizedAccount = {
    ...account,
    restaurant: account.restaurant
  }

  if (!account.user) {
    const { data, error } = await serviceClient.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: createAccessMetadata(getAccountName(authorizedAccount), false)
    })

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "No se pudo crear el acceso." }, { status: 400 })
    }

    const { error: profileError } = await upsertAccessProfile(serviceClient.client, data.user.id, authorizedAccount, email)

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
    user_metadata: createAccessMetadata(getAccountName(authorizedAccount), false)
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await upsertAccessProfile(serviceClient.client, account.user.id, authorizedAccount, email)

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

async function findAuthorizedAccount(
  serviceClient: SupabaseClient,
  email: string
): Promise<{
  restaurant: Restaurant | null
  user: User | null
  profile: Pick<UserProfile, "user_id" | "email" | "nombre" | "rol" | "restaurante_id" | "activo"> | null
} | { error: string }> {
  const profileAccount = await findProfileAccount(serviceClient, email)

  if ("error" in profileAccount) {
    return { error: profileAccount.error }
  }

  if (profileAccount.profile) {
    if (profileAccount.profile.rol === "SuperAdministrador") {
      return { error: "Correo no autorizado para este acceso." }
    }

    const restaurant = await findRestaurantById(serviceClient, profileAccount.profile.restaurante_id)

    if ("error" in restaurant) {
      return { error: restaurant.error }
    }

    if (!profileAccount.profile.activo || !restaurant.restaurant?.activo) {
      return { error: "Correo no autorizado para este acceso." }
    }

    const user = await getAuthUser(serviceClient, profileAccount.profile.user_id)

    if ("error" in user) {
      return { error: user.error }
    }

    return {
      restaurant: restaurant.restaurant,
      user: user.user,
      profile: profileAccount.profile
    }
  }

  const { data: restaurant, error: restaurantError } = await serviceClient
    .from("restaurantes")
    .select("*")
    .ilike("admin_email", email)
    .eq("activo", true)
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
      user: existingUser.user,
      profile: null
    }
  }

  const { data, error } = await serviceClient.auth.admin.getUserById(profile.user_id)

  if (error) {
    return { error: error.message }
  }

  return {
    restaurant: restaurant ?? null,
    user: data.user,
    profile: null
  }
}

function upsertAccessProfile(
  serviceClient: SupabaseClient,
  userId: string,
  account: {
    restaurant: Restaurant
    profile: Pick<UserProfile, "nombre" | "rol"> | null
  },
  email: string
) {
  return serviceClient.from("usuarios").upsert(
    {
      user_id: userId,
      email,
      nombre: account.profile?.nombre ?? account.restaurant.nombre,
      rol: account.profile?.rol ?? "Administrador",
      restaurante_id: account.restaurant.id,
      activo: true
    },
    { onConflict: "user_id" }
  )
}

async function findProfileAccount(
  serviceClient: SupabaseClient,
  email: string
): Promise<{
  profile: Pick<UserProfile, "user_id" | "email" | "nombre" | "rol" | "restaurante_id" | "activo"> | null
} | { error: string }> {
  const { data, error } = await serviceClient
    .from("usuarios")
    .select("user_id, email, nombre, rol, restaurante_id, activo")
    .ilike("email", email)
    .limit(1)
    .maybeSingle<Pick<UserProfile, "user_id" | "email" | "nombre" | "rol" | "restaurante_id" | "activo">>()

  if (error) {
    return { error: error.message }
  }

  return { profile: data }
}

async function findRestaurantById(
  serviceClient: SupabaseClient,
  restaurantId: string | null
): Promise<{ restaurant: Restaurant | null } | { error: string }> {
  if (!restaurantId) return { restaurant: null }

  const { data, error } = await serviceClient
    .from("restaurantes")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle<Restaurant>()

  if (error) {
    return { error: error.message }
  }

  return { restaurant: data }
}

async function getAuthUser(
  serviceClient: SupabaseClient,
  userId: string
): Promise<{ user: User | null } | { error: string }> {
  const { data, error } = await serviceClient.auth.admin.getUserById(userId)

  if (error && !error.message.toLowerCase().includes("not found")) {
    return { error: error.message }
  }

  return { user: data.user ?? null }
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

function getAccountName(account: {
  restaurant: Restaurant
  profile: Pick<UserProfile, "nombre"> | null
}) {
  return account.profile?.nombre ?? account.restaurant.nombre
}

function createAccessMetadata(name: string, passwordPending: boolean) {
  return {
    name,
    cuadre_password_pending: passwordPending
  }
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}
