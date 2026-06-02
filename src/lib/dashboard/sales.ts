import type { CartItem, MobileCartState, Product } from "@/types/app"

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
  return products.filter((product) => product.cantidad_stock > 0 && product.cantidad_stock <= 5).length
}

export function getVisibleProductsLabel(search: string, visibleCount: number) {
  return search.trim() ? `${visibleCount} resultados` : `${visibleCount} disponibles`
}

export function getSaleStockState(product: Product) {
  if (product.cantidad_stock <= 0) return "off"
  if (product.cantidad_stock <= 5) return "low"
  return "active"
}

export function getSaleStockLabel(product: Product) {
  if (product.cantidad_stock <= 0) return "Sin stock"
  if (product.cantidad_stock <= 5) return "Stock bajo"
  return "Disponible"
}

export function canChargeCart(cart: CartItem[], cashReceived: number, cartTotal: number, saving: boolean) {
  return cart.length > 0 && cashReceived >= cartTotal && !saving
}

export function buildSaleItems(cart: CartItem[]) {
  return cart.map((item) => ({
    producto_id: item.product.id,
    cantidad: item.quantity
  }))
}
