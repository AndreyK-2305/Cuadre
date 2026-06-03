import { supabase } from "@/lib/supabase/client"
import type { RestaurantWritePayload } from "@/types/app"

export function fetchCurrentUserProfile() {
  return supabase
    .from("usuarios")
    .select("user_id, email, nombre, rol, restaurante_id, restaurante:restaurantes(*)")
    .single()
}

export function fetchRestaurants() {
  return supabase.from("restaurantes").select("*").order("created_at", { ascending: false })
}

export async function createRestaurant(payload: RestaurantWritePayload) {
  const response = await supabase.from("restaurantes").insert(payload).select("*").single()

  if (!response.error && response.data) {
    await syncRestaurantAdmin(response.data.id, response.data.admin_email)
  }

  return response
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
