import type { Product, ProductWritePayload } from "@/types/app"

export type ProductForm = {
  nombre: string
  descripcion: string
  tipo_item: Product["tipo_item"]
  precio: string
  cantidad_stock: string
  tipo_unidad: string
}

export const emptyProductForm: ProductForm = {
  nombre: "",
  descripcion: "",
  tipo_item: "producto",
  precio: "",
  cantidad_stock: "0",
  tipo_unidad: "unidad"
}

export function getProductSearchText(product: Product) {
  return `${product.nombre} ${product.descripcion ?? ""} ${product.tipo_unidad}`.toLowerCase()
}

export function filterProducts(products: Product[], search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return products

  return products.filter((product) => getProductSearchText(product).includes(term))
}

export function splitProductsByType(products: Product[]) {
  return {
    inventoryItems: products.filter((product) => product.tipo_item === "inventario"),
    saleProducts: products.filter((product) => product.tipo_item === "producto")
  }
}

export function buildProductPayload(form: ProductForm): ProductWritePayload {
  const isInventoryItem = form.tipo_item === "inventario"

  return {
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim() || null,
    tipo_item: form.tipo_item,
    precio: isInventoryItem ? 0 : Number(form.precio),
    cantidad_stock: isInventoryItem ? Number(form.cantidad_stock) : 0,
    tipo_unidad: form.tipo_unidad.trim() || "unidad"
  }
}

export function getProductSavedNotice(product: Product) {
  return product.tipo_item === "producto" ? "Producto actualizado." : "Inventario actualizado."
}

export function getProductCreatedNotice(product: Product) {
  return product.tipo_item === "producto" ? "Producto creado." : "Inventario creado."
}
