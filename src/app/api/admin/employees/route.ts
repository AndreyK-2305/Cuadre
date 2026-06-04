import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient, User } from "@supabase/supabase-js"
import { getEmployeeLimitLabel, getPlanCapabilities, getPlanDisplayName } from "@/lib/planLimits"
import type { EmployeeCreatePayload, EmployeeUser, OperationalUserRole, Restaurant, UserProfile } from "@/types/app"

type EmployeeActionBody = {
  action?: "reset" | "toggle" | "update"
  user_id?: string
  nombre?: string
  activo?: boolean
  rol?: OperationalUserRole
}

type AuthorizedScope = {
  serviceClient: SupabaseClient
  profile: Pick<UserProfile, "user_id" | "rol" | "restaurante_id" | "activo">
  scopeRestaurantId: string | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const manageableRoles: OperationalUserRole[] = ["Gerente", "Empleado"]

export async function GET(request: NextRequest) {
  const authorized = await getAuthorizedScope(request)

  if ("response" in authorized) return authorized.response

  const restaurantId = resolveRestaurantId(authorized, request.nextUrl.searchParams.get("restaurant_id"))

  if (!restaurantId) {
    return NextResponse.json({ employees: [] })
  }

  const { data, error } = await authorized.serviceClient
    .from("usuarios")
    .select("user_id, email, nombre, rol, restaurante_id, activo, created_at")
    .eq("restaurante_id", restaurantId)
    .in("rol", manageableRoles)
    .order("created_at", { ascending: false })
    .returns<EmployeeUser[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ employees: data ?? [] })
}

export async function POST(request: NextRequest) {
  const authorized = await getAuthorizedScope(request)

  if ("response" in authorized) return authorized.response

  const body = await request.json().catch(() => null) as EmployeeCreatePayload | null
  const email = normalizeEmail(body?.email)
  const nombre = String(body?.nombre ?? "").trim()
  const role = normalizeOperationalRole(body?.rol)
  const restaurantId = resolveRestaurantId(authorized, body?.restaurante_id)

  if (!restaurantId || !email || !nombre || !role) {
    return NextResponse.json({ error: "Selecciona emprendimiento, nombre, correo y rol operativo." }, { status: 400 })
  }

  const restaurant = await fetchRestaurant(authorized.serviceClient, restaurantId)

  if ("error" in restaurant) {
    return NextResponse.json({ error: restaurant.error }, { status: 404 })
  }

  const employee = await ensureEmployeeUser(authorized.serviceClient, restaurant.restaurant, {
    email,
    nombre,
    rol: role,
    resetPassword: true
  })

  if ("error" in employee) {
    return NextResponse.json({ error: employee.error }, { status: 400 })
  }

  return NextResponse.json({ employee: employee.employee })
}

export async function PATCH(request: NextRequest) {
  const authorized = await getAuthorizedScope(request)

  if ("response" in authorized) return authorized.response

  const body = await request.json().catch(() => null) as EmployeeActionBody | null
  const action = body?.action
  const userId = String(body?.user_id ?? "").trim()

  if (!action || !userId) {
    return NextResponse.json({ error: "Selecciona empleado y accion valida." }, { status: 400 })
  }

  const employee = await fetchEmployee(authorized.serviceClient, userId)

  if ("error" in employee) {
    return NextResponse.json({ error: employee.error }, { status: 404 })
  }

  if (!canManageRestaurant(authorized, employee.employee.restaurante_id)) {
    return NextResponse.json({ error: "No puedes gestionar empleados de otro emprendimiento." }, { status: 403 })
  }

  if (action === "reset") {
    const { error } = await authorized.serviceClient.auth.admin.updateUserById(userId, {
      password: createPendingPassword(),
      user_metadata: createAccessMetadata(employee.employee.nombre ?? employee.employee.email, true)
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ employee: employee.employee })
  }

  const patch: Partial<Pick<EmployeeUser, "nombre" | "rol" | "activo">> = {}

  if (action === "toggle") {
    patch.activo = Boolean(body?.activo)

    if (patch.activo && !employee.employee.activo) {
      const restaurant = await fetchRestaurant(authorized.serviceClient, employee.employee.restaurante_id)

      if ("error" in restaurant) {
        return NextResponse.json({ error: restaurant.error }, { status: 404 })
      }

      const slotCheck = await ensureEmployeeSlotAvailable(authorized.serviceClient, restaurant.restaurant)
      if ("error" in slotCheck) {
        return NextResponse.json({ error: slotCheck.error }, { status: 403 })
      }
    }
  } else {
    if (body?.nombre !== undefined) {
      patch.nombre = String(body.nombre).trim()

      if (!patch.nombre) {
        return NextResponse.json({ error: "El nombre del usuario operativo es obligatorio." }, { status: 400 })
      }
    }

    if (body?.rol !== undefined) {
      const role = normalizeOperationalRole(body.rol)

      if (!role) {
        return NextResponse.json({ error: "Selecciona un rol operativo valido." }, { status: 400 })
      }

      patch.rol = role
    }
  }

  const { data, error } = await authorized.serviceClient
    .from("usuarios")
    .update(patch)
    .eq("user_id", userId)
    .in("rol", manageableRoles)
    .select("user_id, email, nombre, rol, restaurante_id, activo, created_at")
    .single<EmployeeUser>()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "No se pudo actualizar el empleado." }, { status: 400 })
  }

  return NextResponse.json({ employee: data })
}

async function getAuthorizedScope(request: NextRequest): Promise<AuthorizedScope | { response: NextResponse }> {
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
      response: NextResponse.json({ error: "Sesion no encontrada." }, { status: 401 })
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
      response: NextResponse.json({ error: "Sesion no encontrada." }, { status: 401 })
    }
  }

  const { data: profile, error: profileError } = await requesterClient
    .from("usuarios")
    .select("user_id, rol, restaurante_id, activo")
    .eq("user_id", userId)
    .maybeSingle<Pick<UserProfile, "user_id" | "rol" | "restaurante_id" | "activo">>()

  if (profileError || !profile) {
    return {
      response: NextResponse.json({ error: "No se pudo validar el perfil." }, { status: 403 })
    }
  }

  if (profile.rol === "Empleado" || !profile.activo) {
    return {
      response: NextResponse.json({ error: "No tienes permisos para gestionar empleados." }, { status: 403 })
    }
  }

  if (profile.rol !== "SuperAdministrador" && !profile.restaurante_id) {
    return {
      response: NextResponse.json({ error: "Tu usuario no tiene un emprendimiento asignado." }, { status: 403 })
    }
  }

  return {
    serviceClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }),
    profile,
    scopeRestaurantId: profile.rol === "SuperAdministrador" ? null : profile.restaurante_id
  }
}

function resolveRestaurantId(scope: AuthorizedScope, requestedRestaurantId: string | null | undefined) {
  if (scope.scopeRestaurantId) return scope.scopeRestaurantId
  return String(requestedRestaurantId ?? "").trim()
}

function canManageRestaurant(scope: AuthorizedScope, restaurantId: string) {
  return !scope.scopeRestaurantId || scope.scopeRestaurantId === restaurantId
}

async function fetchRestaurant(
  serviceClient: SupabaseClient,
  restaurantId: string
): Promise<{ restaurant: Restaurant } | { error: string }> {
  const { data, error } = await serviceClient
    .from("restaurantes")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle<Restaurant>()

  if (error || !data) {
    return { error: error?.message ?? "No se encontro el emprendimiento." }
  }

  return { restaurant: data }
}

async function fetchEmployee(
  serviceClient: SupabaseClient,
  userId: string
): Promise<{ employee: EmployeeUser } | { error: string }> {
  const { data, error } = await serviceClient
    .from("usuarios")
    .select("user_id, email, nombre, rol, restaurante_id, activo, created_at")
    .eq("user_id", userId)
    .in("rol", manageableRoles)
    .maybeSingle<EmployeeUser>()

  if (error || !data) {
    return { error: error?.message ?? "No se encontro el empleado." }
  }

  return { employee: data }
}

async function ensureEmployeeUser(
  serviceClient: SupabaseClient,
  restaurant: Restaurant,
  options: { email: string; nombre: string; rol: OperationalUserRole; resetPassword: boolean }
): Promise<{ employee: EmployeeUser } | { error: string }> {
  const existingProfile = await fetchProfileByEmail(serviceClient, options.email)

  if ("error" in existingProfile) {
    return { error: existingProfile.error }
  }

  if (existingProfile.profile && !manageableRoles.includes(existingProfile.profile.rol as OperationalUserRole)) {
    return { error: "Este correo ya pertenece a un administrador o SuperAdministrador." }
  }

  if (existingProfile.profile && existingProfile.profile.restaurante_id !== restaurant.id) {
    return { error: "Este correo ya esta asociado a otro emprendimiento." }
  }

  if (!existingProfile.profile || !existingProfile.profile.activo) {
    const slotCheck = await ensureEmployeeSlotAvailable(serviceClient, restaurant)
    if ("error" in slotCheck) {
      return { error: slotCheck.error }
    }
  }

  let user = existingProfile.profile
    ? await getAuthUser(serviceClient, existingProfile.profile.user_id)
    : await findAuthUserByEmail(serviceClient, options.email)

  if ("error" in user) {
    return { error: user.error }
  }

  if (!user.user) {
    const { data, error } = await serviceClient.auth.admin.createUser({
      email: options.email,
      password: createPendingPassword(),
      email_confirm: true,
      user_metadata: createAccessMetadata(options.nombre, true)
    })

    if (error || !data.user) {
      return { error: error?.message ?? "No se pudo crear el acceso del empleado." }
    }

    user = { user: data.user }
  } else if (options.resetPassword) {
    const { data, error } = await serviceClient.auth.admin.updateUserById(user.user.id, {
      password: createPendingPassword(),
      user_metadata: createAccessMetadata(options.nombre, true)
    })

    if (error || !data.user) {
      return { error: error?.message ?? "No se pudo preparar el primer ingreso del empleado." }
    }

    user = { user: data.user }
  }

  if (!user.user) {
    return { error: "No se pudo confirmar el usuario de acceso." }
  }

  const { data, error } = await serviceClient
    .from("usuarios")
    .upsert(
      {
        user_id: user.user.id,
        email: options.email,
        nombre: options.nombre,
        rol: options.rol,
        restaurante_id: restaurant.id,
        activo: true
      },
      { onConflict: "user_id" }
    )
    .select("user_id, email, nombre, rol, restaurante_id, activo, created_at")
    .single<EmployeeUser>()

  if (error || !data) {
    return { error: error?.message ?? "No se pudo guardar el empleado." }
  }

  return { employee: data }
}

async function fetchProfileByEmail(
  serviceClient: SupabaseClient,
  email: string
): Promise<{ profile: UserProfile | null } | { error: string }> {
  const { data, error } = await serviceClient
    .from("usuarios")
    .select("user_id, email, nombre, rol, restaurante_id, activo")
    .ilike("email", email)
    .limit(1)
    .maybeSingle<UserProfile>()

  if (error) {
    return { error: error.message }
  }

  return { profile: data }
}

async function getAuthUser(serviceClient: SupabaseClient, userId: string): Promise<{ user: User | null } | { error: string }> {
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

function createPendingPassword() {
  return `${randomUUID()}${randomUUID().slice(0, 20)}`
}

function createAccessMetadata(name: string, passwordPending: boolean) {
  return {
    name,
    cuadre_password_pending: passwordPending
  }
}

async function ensureEmployeeSlotAvailable(
  serviceClient: SupabaseClient,
  restaurant: Restaurant
): Promise<{ ok: true } | { error: string }> {
  const capabilities = getPlanCapabilities(restaurant.nivel_suscripcion)

  if (capabilities.employeeLimit === null) {
    return { ok: true }
  }

  if (capabilities.employeeLimit === 0) {
    return {
      error: `El plan ${getPlanDisplayName(restaurant.nivel_suscripcion)} no permite crear empleados o gerentes.`
    }
  }

  const { count, error } = await serviceClient
    .from("usuarios")
    .select("user_id", { count: "exact", head: true })
    .eq("restaurante_id", restaurant.id)
    .eq("activo", true)
    .in("rol", manageableRoles)

  if (error) {
    return { error: error.message }
  }

  if ((count ?? 0) >= capabilities.employeeLimit) {
    return {
      error: `El plan ${getPlanDisplayName(restaurant.nivel_suscripcion)} permite ${getEmployeeLimitLabel(capabilities.employeeLimit)} operativos.`
    }
  }

  return { ok: true }
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}

function normalizeOperationalRole(value: string | null | undefined): OperationalUserRole | null {
  const role = String(value ?? "").trim()
  return role === "Gerente" || role === "Empleado" ? role : null
}
