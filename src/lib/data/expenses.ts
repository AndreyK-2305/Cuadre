import { supabase } from "@/lib/supabase/client"
import type { ExpenseWritePayload } from "@/types/app"

export function createExpense(payload: ExpenseWritePayload) {
  return supabase.from("egresos").insert(payload).select("*").single()
}

export function voidExpense(id: string, reason: string) {
  return supabase.rpc("anular_egreso", {
    p_egreso_id: id,
    p_motivo: reason
  })
}

export function restoreExpense(id: string) {
  return supabase.rpc("restaurar_egreso", {
    p_egreso_id: id
  })
}

export function createExpensesReportQuery(dateFrom: string, dateTo: string) {
  let expensesQuery = supabase
    .from("egresos")
    .select("*")
    .eq("eliminado", false)
    .order("fecha_dia", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000)

  if (dateFrom) {
    expensesQuery = expensesQuery.gte("fecha_dia", dateFrom)
  }

  if (dateTo) {
    expensesQuery = expensesQuery.lte("fecha_dia", dateTo)
  }

  return expensesQuery
}

export function createVoidedExpensesReportQuery(dateFrom: string, dateTo: string) {
  let expensesQuery = supabase
    .from("egresos")
    .select("*")
    .eq("eliminado", true)
    .order("eliminado_at", { ascending: false })
    .order("fecha_dia", { ascending: false })
    .limit(1000)

  if (dateFrom) {
    expensesQuery = expensesQuery.gte("fecha_dia", dateFrom)
  }

  if (dateTo) {
    expensesQuery = expensesQuery.lte("fecha_dia", dateTo)
  }

  return expensesQuery
}
