"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Filter, Plus, Trash2 } from "lucide-react"
import { formatCurrency, formatDateKey, formatDateTime, getCurrentMonthPrefix, getDateDaysAgo } from "@/lib/format"
import {
  buildExpensePayload,
  createEmptyExpenseForm,
  getExpensesTotal,
  validateExpensePayload,
  type ExpenseForm
} from "@/lib/dashboard/expenses"
import { getPresetDateRange, type ReportPreset } from "@/lib/dashboard/reports"
import { createExpense, createExpensesReportQuery, deleteExpense } from "@/lib/data/expenses"
import type { Expense } from "@/types/app"

type ExpensesModuleProps = {
  refreshSignal: number
  onChanged: () => void
}

export function ExpensesModule({ refreshSignal, onChanged }: ExpensesModuleProps) {
  const today = formatDateKey()
  const lastSevenDays = getDateDaysAgo(6)
  const currentMonth = getCurrentMonthPrefix()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [form, setForm] = useState<ExpenseForm>(() => createEmptyExpenseForm(today))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [activePreset, setActivePreset] = useState<ReportPreset>("today")

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    setError("")

    if (dateFrom && dateTo && dateFrom > dateTo) {
      setExpenses([])
      setLoading(false)
      setError("La fecha inicial no puede ser mayor que la fecha final.")
      return
    }

    const { data, error: loadError } = await createExpensesReportQuery(dateFrom, dateTo)

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => {
    void loadExpenses()
  }, [loadExpenses, refreshSignal])

  const totalExpenses = useMemo(() => getExpensesTotal(expenses), [expenses])

  function updateForm<K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function setPreset(preset: ReportPreset) {
    setActivePreset(preset)

    const nextRange = getPresetDateRange(preset, { today, lastSevenDays, currentMonth })
    if (nextRange) {
      setDateFrom(nextRange.dateFrom)
      setDateTo(nextRange.dateTo)
    }
  }

  function handleDateFromChange(value: string) {
    setActivePreset("custom")
    setDateFrom(value)
  }

  function handleDateToChange(value: string) {
    setActivePreset("custom")
    setDateTo(value)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")

    const payload = buildExpensePayload(form)
    const validationError = validateExpensePayload(payload)

    if (validationError) {
      setError(validationError)
      setSaving(false)
      return
    }

    const { data, error: createError } = await createExpense(payload)

    setSaving(false)

    if (createError) {
      setError(createError.message)
      return
    }

    if (isDateInActiveRange(payload.fecha_dia, dateFrom, dateTo)) {
      setExpenses((current) => [data as Expense, ...current])
    }

    setForm({ ...createEmptyExpenseForm(payload.fecha_dia), fecha_dia: payload.fecha_dia })
    setNotice(`Egreso registrado por ${formatCurrency(payload.valor)}.`)
    onChanged()
  }

  async function handleDelete(expense: Expense) {
    setDeletingId(expense.id)
    setError("")
    setNotice("")

    const { error: deleteError } = await deleteExpense(expense.id)

    setDeletingId("")

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setExpenses((current) => current.filter((item) => item.id !== expense.id))
    setNotice(`Egreso eliminado: ${expense.descripcion}.`)
    onChanged()
  }

  return (
    <div className="module">
      <div className="module-title">
        <div>
          <h2>Egresos</h2>
          <p>Registra gastos diarios para restarlos del resultado del negocio.</p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <section className="grid-two">
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <div className="section-title">
            <h2>Nuevo egreso</h2>
            <p>Describe el gasto y asigna el valor que salio de caja.</p>
          </div>

          <div className="field">
            <label htmlFor="expense-description">Descripcion</label>
            <input
              id="expense-description"
              value={form.descripcion}
              onChange={(event) => updateForm("descripcion", event.target.value)}
              placeholder="Compra hielo"
              required
            />
          </div>

          <div className="inline-grid">
            <div className="field">
              <label htmlFor="expense-value">Valor COP</label>
              <input
                id="expense-value"
                type="number"
                min="1"
                step="100"
                value={form.valor}
                onChange={(event) => updateForm("valor", event.target.value)}
                placeholder="20000"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="expense-date">Fecha</label>
              <input
                id="expense-date"
                type="date"
                value={form.fecha_dia}
                onChange={(event) => updateForm("fecha_dia", event.target.value)}
                required
              />
            </div>
          </div>

          <button className="button primary" type="submit" disabled={saving}>
            <Plus size={18} aria-hidden="true" />
            {saving ? "Guardando..." : "Registrar egreso"}
          </button>
        </form>

        <section className="metric">
          <span>Total de egresos</span>
          <strong>{formatCurrency(totalExpenses)}</strong>
          <small>{expenses.length} registros en el filtro activo</small>
          <div className="actions-row">
            <CalendarDays size={18} aria-hidden="true" />
            <span>{activePreset === "today" ? "Hoy" : "Rango seleccionado"}</span>
          </div>
        </section>
      </section>

      <section className="panel report-filters">
        <div className="filter-title">
          <Filter size={18} aria-hidden="true" />
          <div>
            <h2>Filtro de egresos</h2>
            <p>Consulta gastos por dia, semana, mes o historial completo.</p>
          </div>
        </div>

        <div className="filter-grid">
          <div className="field">
            <label htmlFor="expenses-date-from">Desde</label>
            <input
              id="expenses-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => handleDateFromChange(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="expenses-date-to">Hasta</label>
            <input
              id="expenses-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => handleDateToChange(event.target.value)}
            />
          </div>

          <div className="actions-row filter-actions">
            {(["today", "week", "month", "all"] as ReportPreset[]).map((preset) => (
              <button
                className={`button subtle ${activePreset === preset ? "active" : ""}`}
                key={preset}
                type="button"
                onClick={() => setPreset(preset)}
              >
                {getPresetLabel(preset)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading && <div className="panel empty-state">Cargando egresos...</div>}

      {!loading && (
        <section className="history-list">
          <article className="panel">
            <div className="section-title">
              <h2>Historial de egresos</h2>
              <p>Hasta 1000 gastos para el filtro seleccionado.</p>
            </div>
          </article>

          {expenses.length === 0 && <div className="panel empty-state">Aun no hay egresos registrados.</div>}

          {expenses.map((expense) => (
            <article className="history-row" key={expense.id}>
              <div className="history-meta">
                <span className="badge off">{formatDateForExpense(expense.fecha_dia)}</span>
                <span>{formatDateTime(expense.created_at)}</span>
              </div>
              <div className="total-line">
                <strong>{formatCurrency(expense.valor)}</strong>
                <span className="muted">{expense.descripcion}</span>
              </div>
              <button
                className="button subtle"
                type="button"
                onClick={() => handleDelete(expense)}
                disabled={deletingId === expense.id}
              >
                <Trash2 size={16} aria-hidden="true" />
                {deletingId === expense.id ? "Eliminando..." : "Eliminar"}
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

function getPresetLabel(preset: ReportPreset) {
  if (preset === "today") return "Hoy"
  if (preset === "week") return "7 dias"
  if (preset === "month") return "Mes"
  if (preset === "all") return "Todo"
  return "Personalizado"
}

function formatDateForExpense(dateKey: string) {
  const [year, month, day] = dateKey.split("-")
  if (!year || !month || !day) return dateKey
  return `${day}/${month}/${year}`
}

function isDateInActiveRange(dateKey: string, dateFrom: string, dateTo: string) {
  if (dateFrom && dateKey < dateFrom) return false
  if (dateTo && dateKey > dateTo) return false
  return true
}
