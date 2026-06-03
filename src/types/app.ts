export type UserRole = "SuperAdministrador" | "Administrador"

export type SubscriptionLevel = "Gratis" | "Basico" | "Completo" | "Emprendedor"

export type Restaurant = {
  id: string
  nombre: string
  admin_email: string
  telefono: string
  nivel_suscripcion: SubscriptionLevel
  fecha_suscripcion: string
  activo: boolean
  created_at: string
  updated_at: string
}

export type RestaurantWritePayload = Pick<
  Restaurant,
  "nombre" | "admin_email" | "telefono" | "nivel_suscripcion" | "fecha_suscripcion" | "activo"
>

export type RestaurantCreatePayload = RestaurantWritePayload

export type UserProfile = {
  user_id: string
  email: string
  nombre: string | null
  rol: UserRole
  restaurante_id: string | null
  restaurante?: Restaurant | null
}

export type Product = {
  id: string
  restaurante_id: string
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
  restaurante_id: string
  producto_id: string
  tipo_movimiento: InventoryMovementType
  cantidad: number
  stock_antes: number
  stock_despues: number
  nota: string
}

export type Expense = {
  id: string
  restaurante_id: string
  user_id: string
  descripcion: string
  valor: number
  fecha: string
  fecha_dia: string
  eliminado: boolean
  eliminado_motivo: string | null
  eliminado_at: string | null
  eliminado_por: string | null
  created_at: string
  updated_at: string
}

export type ExpenseWritePayload = {
  restaurante_id: string
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
  restaurante_id: string
  folio_diario: number
  fecha: string
  fecha_dia: string
  total: number
  dinero_recibido: number
  cambio: number
  eliminado: boolean
  eliminado_motivo: string | null
  eliminado_at: string | null
  eliminado_por: string | null
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
