import { supabase } from "@/lib/supabase/client"
import type { InventoryMovementPayload, ProductWritePayload } from "@/types/app"

export function fetchProducts() {
  return supabase.from("productos").select("*").order("nombre", { ascending: true })
}

export function fetchActiveSaleProducts() {
  return supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .eq("tipo_item", "producto")
    .order("nombre", { ascending: true })
}

export function createProduct(payload: ProductWritePayload) {
  return supabase.from("productos").insert(payload).select("*").single()
}

export function updateProduct(id: string, payload: ProductWritePayload) {
  return supabase.from("productos").update(payload).eq("id", id).select("*").single()
}

export function updateProductStock(id: string, cantidadStock: number) {
  return supabase
    .from("productos")
    .update({ cantidad_stock: cantidadStock })
    .eq("id", id)
    .select("*")
    .single()
}

export function updateProductActiveState(id: string, activo: boolean) {
  return supabase.from("productos").update({ activo }).eq("id", id).select("*").single()
}

export function createInventoryMovement(payload: InventoryMovementPayload) {
  return supabase.from("movimientos_inventario").insert(payload)
}
