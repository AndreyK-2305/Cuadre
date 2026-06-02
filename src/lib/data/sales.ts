import { supabase } from "@/lib/supabase/client"

export type SaleRegistrationItem = {
  producto_id: string
  cantidad: number
}

export function registerSale(items: SaleRegistrationItem[], cashReceived: number) {
  return supabase.rpc("registrar_venta", {
    p_items: items,
    p_dinero_recibido: cashReceived
  })
}

export function createSalesReportQuery(dateFrom: string, dateTo: string) {
  let salesQuery = supabase
    .from("ventas")
    .select("id, folio_diario, fecha, fecha_dia, total, dinero_recibido, cambio, detalle_ventas(*)")
    .order("fecha", { ascending: false })
    .limit(1000)

  if (dateFrom) {
    salesQuery = salesQuery.gte("fecha_dia", dateFrom)
  }

  if (dateTo) {
    salesQuery = salesQuery.lte("fecha_dia", dateTo)
  }

  return salesQuery
}
