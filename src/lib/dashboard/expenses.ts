import type { Expense, ExpenseWritePayload } from "@/types/app"

export type ExpenseForm = {
  descripcion: string
  valor: string
  fecha_dia: string
}

export function createEmptyExpenseForm(dateKey: string): ExpenseForm {
  return {
    descripcion: "",
    valor: "",
    fecha_dia: dateKey
  }
}

type BaseExpensePayload = Omit<ExpenseWritePayload, "restaurante_id">

export function buildExpensePayload(form: ExpenseForm): BaseExpensePayload {
  return {
    descripcion: form.descripcion.trim(),
    valor: Number(form.valor),
    fecha_dia: form.fecha_dia
  }
}

export function validateExpensePayload(payload: BaseExpensePayload) {
  if (!payload.descripcion) return "La descripcion es obligatoria."
  if (!payload.fecha_dia) return "Selecciona la fecha del egreso."
  if (!Number.isFinite(payload.valor) || payload.valor <= 0) return "El valor debe ser mayor a cero."
  return ""
}

export function getExpensesTotal(expenses: Expense[]) {
  return expenses.reduce((total, expense) => total + expense.valor, 0)
}
