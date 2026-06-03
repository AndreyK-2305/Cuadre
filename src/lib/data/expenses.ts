import { supabase } from "@/lib/supabase/client"
import type { ExpenseWritePayload } from "@/types/app"

export function createExpense(payload: ExpenseWritePayload) {
  return supabase.from("egresos").insert(payload).select("*").single()
}

export function deleteExpense(id: string) {
  return supabase.from("egresos").delete().eq("id", id)
}

export function createExpensesReportQuery(dateFrom: string, dateTo: string) {
  let expensesQuery = supabase
    .from("egresos")
    .select("*")
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
