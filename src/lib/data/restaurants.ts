import { supabase } from "@/lib/supabase/client"
import type {
  Restaurant,
  RestaurantCreatePayload,
  RestaurantWritePayload,
  SubscriptionLevel,
  SubscriptionPlan,
  SubscriptionPlanPayload,
  UserProfile
} from "@/types/app"

type DataResponse<T> = {
  data: T | null
  error: { message: string } | null
}

export async function fetchCurrentUserProfile(): Promise<DataResponse<UserProfile>> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const userId = authData.user?.id

  if (authError || !userId) {
    return {
      data: null,
      error: { message: authError?.message ?? "No se encontro una sesion activa." }
    }
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("user_id, email, nombre, rol, restaurante_id, activo, restaurante:restaurantes(*)")
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    return {
      data: null,
      error: { message: error?.message ?? "No se encontro el perfil de este usuario." }
    }
  }

  return {
    data: data as unknown as UserProfile,
    error: null
  }
}

export function fetchRestaurants() {
  return supabase.from("restaurantes").select("*").order("created_at", { ascending: false })
}

export const defaultSubscriptionPlans: SubscriptionPlan[] = [
  { nivel: "Gratis", nombre: "Gratis", precio: 0, updated_at: "" },
  { nivel: "Basico", nombre: "Basico", precio: 19000, updated_at: "" },
  { nivel: "Completo", nombre: "Completo", precio: 29000, updated_at: "" },
  { nivel: "Emprendedor", nombre: "Emprendedor", precio: 0, updated_at: "" }
]

export async function fetchSubscriptionPlans(): Promise<DataResponse<SubscriptionPlan[]>> {
  const { data, error } = await supabase.from("planes_suscripcion").select("*").order("orden", { ascending: true })

  if (error) {
    return {
      data: defaultSubscriptionPlans,
      error: { message: error.message }
    }
  }

  return {
    data: data && data.length > 0 ? data as SubscriptionPlan[] : defaultSubscriptionPlans,
    error: null
  }
}

export function updateSubscriptionPlan(nivel: SubscriptionLevel, payload: SubscriptionPlanPayload) {
  return supabase.from("planes_suscripcion").update(payload).eq("nivel", nivel).select("*").single()
}

export async function createRestaurant(payload: RestaurantCreatePayload): Promise<DataResponse<Restaurant>> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return {
      data: null,
      error: { message: sessionError?.message ?? "Inicia sesion para registrar emprendimientos." }
    }
  }

  const response = await fetch("/api/admin/restaurants", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  const body = await response.json().catch(() => null) as { restaurant?: Restaurant; error?: string } | null

  if (!response.ok) {
    return {
      data: null,
      error: { message: body?.error ?? "No se pudo registrar el emprendimiento." }
    }
  }

  return {
    data: body?.restaurant ?? null,
    error: null
  }
}

export async function updateRestaurant(id: string, payload: RestaurantWritePayload) {
  const response = await supabase.from("restaurantes").update(payload).eq("id", id).select("*").single()

  if (!response.error && response.data) {
    await syncRestaurantAdmin(response.data.id, response.data.admin_email)
  }

  return response
}

export async function updateRestaurantActiveState(id: string, activo: boolean) {
  return supabase.from("restaurantes").update({ activo }).eq("id", id).select("*").single()
}

export async function deleteRestaurant(id: string): Promise<DataResponse<null>> {
  const { error } = await supabase.from("restaurantes").delete().eq("id", id)

  return {
    data: null,
    error: error ? { message: error.message } : null
  }
}

export async function changeRestaurantAdminPassword(restaurantId: string, password: string): Promise<DataResponse<null>> {
  return updateRestaurantAdminAccess({
    action: "change",
    restaurant_id: restaurantId,
    password
  })
}

export async function resetRestaurantAdminPassword(restaurantId: string): Promise<DataResponse<null>> {
  return updateRestaurantAdminAccess({
    action: "reset",
    restaurant_id: restaurantId
  })
}

function syncRestaurantAdmin(restaurantId: string, adminEmail: string) {
  return supabase
    .from("usuarios")
    .update({
      restaurante_id: restaurantId,
      rol: "Administrador",
      activo: true
    })
    .ilike("email", adminEmail)
}

async function updateRestaurantAdminAccess(payload: {
  action: "change" | "reset"
  restaurant_id: string
  password?: string
}): Promise<DataResponse<null>> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return {
      data: null,
      error: { message: sessionError?.message ?? "Inicia sesion para gestionar accesos." }
    }
  }

  const response = await fetch("/api/admin/restaurants", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  const body = await response.json().catch(() => null) as { error?: string } | null

  if (!response.ok) {
    return {
      data: null,
      error: { message: body?.error ?? "No se pudo actualizar el acceso." }
    }
  }

  return {
    data: null,
    error: null
  }
}
