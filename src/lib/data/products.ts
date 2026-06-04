import { supabase } from "@/lib/supabase/client"
import type { InventoryMovementPayload, ProductInventoryRecipePayload, ProductWritePayload } from "@/types/app"

const productSelectWithRecipes = `
  *,
  producto_inventario_recetas!producto_inventario_recetas_producto_id_fkey(
    id,
    restaurante_id,
    producto_id,
    inventario_id,
    cantidad,
    created_at,
    updated_at,
    inventario:productos!producto_inventario_recetas_inventario_id_fkey(*)
  )
`

export function fetchProducts() {
  return supabase.from("productos").select(productSelectWithRecipes).order("nombre", { ascending: true })
}

export function fetchProductsByRestaurant(restaurantId: string) {
  return supabase
    .from("productos")
    .select(productSelectWithRecipes)
    .eq("restaurante_id", restaurantId)
    .order("nombre", { ascending: true })
}

export function fetchActiveSaleProducts() {
  return supabase
    .from("productos")
    .select(productSelectWithRecipes)
    .eq("activo", true)
    .eq("tipo_item", "producto")
    .order("nombre", { ascending: true })
}

export function fetchActiveInventoryItems() {
  return supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .eq("tipo_item", "inventario")
    .order("nombre", { ascending: true })
}

export function createProduct(payload: ProductWritePayload, restaurantId: string) {
  return supabase
    .from("productos")
    .insert({
      ...payload,
      restaurante_id: restaurantId
    })
    .select("*")
    .single()
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

export async function replaceProductRecipes(
  productId: string,
  restaurantId: string,
  recipes: ProductInventoryRecipePayload[]
) {
  const { error: deleteError } = await supabase
    .from("producto_inventario_recetas")
    .delete()
    .eq("producto_id", productId)

  if (deleteError) return { data: null, error: deleteError }

  if (recipes.length === 0) return { data: [], error: null }

  return supabase
    .from("producto_inventario_recetas")
    .insert(
      recipes.map((recipe) => ({
        restaurante_id: restaurantId,
        producto_id: productId,
        inventario_id: recipe.inventario_id,
        cantidad: recipe.cantidad
      }))
    )
    .select("*")
}
