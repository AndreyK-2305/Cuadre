import { supabase } from "@/lib/supabase/client"
import type { Restaurant, RestaurantCreatePayload, RestaurantWritePayload } from "@/types/app"

type DataResponse<T> = {
  data: T | null
  error: { message: string } | null
}

export function fetchCurrentUserProfile() {
  return supabase
    .from("usuarios")
    .select("user_id, email, nombre, rol, restaurante_id, restaurante:restaurantes(*)")
    .single()
}

export function fetchRestaurants() {
  return supabase.from("restaurantes").select("*").order("created_at", { ascending: false })
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
      rol: "Administrador"
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
