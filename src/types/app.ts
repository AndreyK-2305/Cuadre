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

export type ProductWritePayload = Pick<
  Product,
  "nombre" | "descripcion" | "tipo_item" | "precio" | "cantidad_stock" | "tipo_unidad"
>

export type InventoryMovementType = "entrada" | "venta" | "ajuste" | "deshabilitado"

export type InventoryMovementPayload = {
  producto_id: string
  tipo_movimiento: InventoryMovementType
  cantidad: number
  stock_antes: number
  stock_despues: number
  nota: string
}

export type Expense = {
  id: string
  user_id: string
  descripcion: string
  valor: number
  fecha: string
  fecha_dia: string
  created_at: string
  updated_at: string
}

export type ExpenseWritePayload = {
  descripcion: string
  valor: number
  fecha_dia: string
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

export type MobileCartState = {
  quantity: number
  total: number
  hasItems: boolean
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
