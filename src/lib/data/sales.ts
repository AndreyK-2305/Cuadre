import { supabase } from "@/lib/supabase/client"

export type SaleRegistrationItem = {
  producto_id: string
  cantidad: number
}

export function registerSale(items: SaleRegistrationItem[], cashReceived: number, restaurantId: string) {
  return supabase.rpc("registrar_venta", {
    p_items: items,
    p_dinero_recibido: cashReceived,
    p_restaurante_id: restaurantId
  })
}

export function voidSale(id: string, reason: string) {
  return supabase.rpc("anular_venta", {
    p_venta_id: id,
    p_motivo: reason
  })
}

export function restoreSale(id: string) {
  return supabase.rpc("restaurar_venta", {
    p_venta_id: id
  })
}

export function createSalesReportQuery(dateFrom: string, dateTo: string, restaurantId?: string) {
  let salesQuery = supabase
    .from("ventas")
    .select(
      "id, restaurante_id, folio_diario, fecha, fecha_dia, total, dinero_recibido, cambio, eliminado, eliminado_motivo, eliminado_at, eliminado_por, detalle_ventas(*)"
    )
    .eq("eliminado", false)
    .order("fecha", { ascending: false })
    .limit(1000)

  if (dateFrom) {
    salesQuery = salesQuery.gte("fecha_dia", dateFrom)
  }

  if (dateTo) {
    salesQuery = salesQuery.lte("fecha_dia", dateTo)
  }

  if (restaurantId) {
    salesQuery = salesQuery.eq("restaurante_id", restaurantId)
  }

  return salesQuery
}

export function createVoidedSalesReportQuery(dateFrom: string, dateTo: string, restaurantId?: string) {
  let salesQuery = supabase
    .from("ventas")
    .select(
      "id, restaurante_id, folio_diario, fecha, fecha_dia, total, dinero_recibido, cambio, eliminado, eliminado_motivo, eliminado_at, eliminado_por, detalle_ventas(*)"
    )
    .eq("eliminado", true)
    .order("eliminado_at", { ascending: false })
    .order("fecha", { ascending: false })
    .limit(1000)

  if (dateFrom) {
    salesQuery = salesQuery.gte("fecha_dia", dateFrom)
  }

  if (dateTo) {
    salesQuery = salesQuery.lte("fecha_dia", dateTo)
  }

  if (restaurantId) {
    salesQuery = salesQuery.eq("restaurante_id", restaurantId)
  }

  return salesQuery
}
