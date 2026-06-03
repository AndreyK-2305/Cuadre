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
      error: { message: sessionError?.message ?? "Inicia sesion para registrar restaurantes." }
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
      error: { message: body?.error ?? "No se pudo registrar el restaurante." }
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

function syncRestaurantAdmin(restaurantId: string, adminEmail: string) {
  return supabase
    .from("usuarios")
    .update({
      restaurante_id: restaurantId,
      rol: "Administrador"
    })
    .ilike("email", adminEmail)
}
