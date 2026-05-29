export type Product = {
  id: string
  nombre: string
  descripcion: string | null
  tipo_item: "producto" | "inventario"
  precio: number
  cantidad_stock: number
  tipo_unidad: string
  activo: boolean
  created_at: string
  updated_at: string
}

export type SaleItem = {
  id: string
  venta_id: string
  producto_id: string
  producto_nombre: string
  precio_unitario: number
  cantidad: number
  subtotal: number
}

export type Sale = {
  id: string
  folio_diario: number
  fecha: string
  fecha_dia: string
  total: number
  dinero_recibido: number
  cambio: number
  detalle_ventas?: SaleItem[]
}

export type CartItem = {
  product: Product
  quantity: number
}

export type RegisterSaleResult = {
  venta_id: string
  folio_diario: number
  fecha: string
  fecha_dia: string
  total: number
  dinero_recibido: number
  cambio: number
}
