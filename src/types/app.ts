export type UserRole = "SuperAdministrador" | "Administrador" | "Gerente" | "Empleado"

export type OperationalUserRole = "Gerente" | "Empleado"

export type SubscriptionLevel = "Gratis" | "Basico" | "Completo" | "Emprendedor"

export type SubscriptionPlan = {
  nivel: SubscriptionLevel
  nombre: string
  precio: number
  updated_at: string
}

export type SubscriptionPlanPayload = Pick<SubscriptionPlan, "nombre" | "precio">

export type AnnouncementTargetType = "restaurants" | "plan"

export type Announcement = {
  id: string
  titulo: string
  mensaje: string
  target_type: AnnouncementTargetType
  target_restaurante_ids: string[]
  target_plan: SubscriptionLevel | null
  activo: boolean
  created_at: string
}

export type AnnouncementCreatePayload = Pick<
  Announcement,
  "titulo" | "mensaje" | "target_type" | "target_restaurante_ids" | "target_plan"
>

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
  activo: boolean
  restaurante?: Restaurant | null
}

export type UserAuditProfile = Pick<UserProfile, "user_id" | "email" | "nombre" | "rol">

export type EmployeeUser = {
  user_id: string
  email: string
  nombre: string | null
  rol: OperationalUserRole
  restaurante_id: string
  activo: boolean
  created_at: string
}

export type EmployeeCreatePayload = {
  restaurante_id?: string
  email: string
  nombre: string
  rol: OperationalUserRole
}

export type EmployeeUpdatePayload = {
  user_id: string
  nombre?: string
  activo?: boolean
  rol?: OperationalUserRole
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
  producto_inventario_recetas?: ProductInventoryRecipe[]
}

export type ProductWritePayload = Pick<
  Product,
  "nombre" | "descripcion" | "tipo_item" | "precio" | "cantidad_stock" | "tipo_unidad"
>

export type ProductInventoryRecipe = {
  id: string
  restaurante_id: string
  producto_id: string
  inventario_id: string
  cantidad: number
  created_at: string
  updated_at: string
  inventario?: Product | null
}

export type ProductInventoryRecipePayload = {
  inventario_id: string
  cantidad: number
}

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
  nota: string | null
  detalle_venta_inventario?: SaleInventoryConsumption[]
}

export type SaleInventoryConsumption = {
  id: string
  venta_id: string
  detalle_venta_id: string | null
  producto_id: string | null
  inventario_id: string | null
  inventario_nombre: string
  cantidad: number
  origen: "receta" | "manual"
  nota: string | null
  advertencia: string | null
  created_at: string
}

export type Sale = {
  id: string
  restaurante_id: string
  user_id: string
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
  note?: string
  inventoryConsumptions?: SaleInventoryConsumptionPayload[]
}

export type SaleInventoryConsumptionPayload = {
  inventario_id: string
  cantidad: number
  nota?: string
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
  advertencias?: string[]
}
