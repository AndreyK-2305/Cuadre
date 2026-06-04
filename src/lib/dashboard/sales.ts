import type { CartItem, MobileCartState, Product, SaleInventoryConsumptionPayload } from "@/types/app"

export const quickCashValues = [2000, 5000, 10000, 20000, 50000, 100000]

export function getCartTotal(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + item.product.precio * item.quantity, 0)
}

export function getCartQuantity(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + item.quantity, 0)
}

export function getMobileCartState(cart: CartItem[]): MobileCartState {
  return {
    quantity: getCartQuantity(cart),
    total: getCartTotal(cart),
    hasItems: cart.length > 0
  }
}

export function getLowStockCount(products: Product[]) {
  return products.filter((product) => {
    const availableUnits = getRecipeAvailableUnits(product)
    return availableUnits !== null && availableUnits > 0 && availableUnits <= 5
  }).length
}

export function getVisibleProductsLabel(search: string, visibleCount: number) {
  return search.trim() ? `${visibleCount} resultados` : `${visibleCount} disponibles`
}

export function getSaleStockState(product: Product) {
  const availableUnits = getRecipeAvailableUnits(product)
  if (availableUnits === null) return "active"
  if (availableUnits <= 0) return "off"
  if (availableUnits <= 5) return "low"
  return "active"
}

export function getSaleStockLabel(product: Product) {
  const availableUnits = getRecipeAvailableUnits(product)
  if (availableUnits === null) return "Venta directa"
  if (availableUnits <= 0) return "Sin inventario"
  if (availableUnits <= 5) return "Stock bajo"
  return "Disponible"
}

export function getRecipeAvailableUnits(product: Product) {
  const recipes = product.producto_inventario_recetas ?? []
  if (recipes.length === 0) return null

  return recipes.reduce<number | null>((available, recipe) => {
    const stock = recipe.inventario?.cantidad_stock ?? 0
    const quantity = recipe.cantidad || 1
    const recipeAvailable = Math.floor(stock / quantity)

    if (available === null) return recipeAvailable
    return Math.min(available, recipeAvailable)
  }, null)
}

export function getSaleAvailabilityLabel(product: Product) {
  const availableUnits = getRecipeAvailableUnits(product)
  if (availableUnits === null) return "sin receta de stock"
  return `${availableUnits} posibles por inventario`
}

export function canChargeCart(cart: CartItem[], cashReceived: number, cartTotal: number, saving: boolean) {
  return cart.length > 0 && cashReceived >= cartTotal && !saving
}

export function buildSaleItems(cart: CartItem[]) {
  return cart.map((item) => ({
    producto_id: item.product.id,
    cantidad: item.quantity,
    ...(item.note?.trim() ? { nota: item.note.trim() } : {}),
    ...(item.inventoryConsumptions
      ? {
          consumos: item.inventoryConsumptions
            .filter((consumption) => consumption.inventario_id && consumption.cantidad > 0)
            .map((consumption) => ({
              inventario_id: consumption.inventario_id,
              cantidad: consumption.cantidad,
              ...(consumption.nota?.trim() ? { nota: consumption.nota.trim() } : {})
            }))
        }
      : {})
  }))
}

export function getDefaultInventoryConsumptions(
  product: Product,
  quantity: number
): SaleInventoryConsumptionPayload[] {
  return (product.producto_inventario_recetas ?? [])
    .filter((recipe) => recipe.inventario_id && recipe.cantidad > 0)
    .map((recipe) => ({
      inventario_id: recipe.inventario_id,
      cantidad: recipe.cantidad * quantity
    }))
}

export function getProductRecipeLabel(product: Product) {
  const recipes = product.producto_inventario_recetas ?? []
  if (recipes.length === 0) return "Sin inventario asociado"
  if (recipes.length === 1) return "1 insumo asociado"
  return `${recipes.length} insumos asociados`
}
