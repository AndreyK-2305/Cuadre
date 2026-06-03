"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Plus, Trash2 } from "lucide-react"
import { formatCurrency, formatDateKey, formatDateTime } from "@/lib/format"
import {
  buildExpensePayload,
  createEmptyExpenseForm,
  getExpensesTotal,
  validateExpensePayload,
  type ExpenseForm
} from "@/lib/dashboard/expenses"
import { createExpense, createExpensesReportQuery, voidExpense } from "@/lib/data/expenses"
import { VoidReasonModal } from "@/components/ui/VoidReasonModal"
import type { Expense } from "@/types/app"

type ExpensesModuleProps = {
  refreshSignal: number
  onChanged: () => void
}

export function ExpensesModule({ refreshSignal, onChanged }: ExpensesModuleProps) {
  const today = formatDateKey()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [form, setForm] = useState<ExpenseForm>(() => createEmptyExpenseForm(today))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null)
  const [savingVoid, setSavingVoid] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: loadError } = await createExpensesReportQuery(today, today)

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }, [today])

  useEffect(() => {
    void loadExpenses()
  }, [loadExpenses, refreshSignal])

  const totalExpenses = useMemo(() => getExpensesTotal(expenses), [expenses])

  function updateForm<K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
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

    if (payload.fecha_dia === today) {
      setExpenses((current) => [data as Expense, ...current])
    }

    setForm(createEmptyExpenseForm(today))
    setNotice(`Egreso registrado por ${formatCurrency(payload.valor)}.`)
    onChanged()
  }

  async function handleVoidExpense(reason: string) {
    if (!voidingExpense) return

    const expense = voidingExpense
    setSavingVoid(true)
    setError("")
    setNotice("")

    const { error: voidError } = await voidExpense(expense.id, reason)

    setSavingVoid(false)

    if (voidError) {
      setVoidingExpense(null)
      setError(voidError.message)
      return
    }

    setExpenses((current) => current.filter((item) => item.id !== expense.id))
    setVoidingExpense(null)
    setNotice(`Egreso anulado: ${expense.descripcion}.`)
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
              <label htmlFor="expense-date">Fecha actual</label>
              <input
                id="expense-date"
                type="date"
                value={form.fecha_dia}
                readOnly
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
          <small>{expenses.length} registros de hoy</small>
          <div className="actions-row">
            <CalendarDays size={18} aria-hidden="true" />
            <span>Hoy: {formatDateForExpense(today)}</span>
          </div>
        </section>
      </section>

      {loading && <div className="panel empty-state">Cargando egresos...</div>}

      {!loading && (
        <section className="history-list">
          <article className="panel">
            <div className="section-title">
              <h2>Historial de egresos</h2>
              <p>Gastos activos registrados durante la fecha actual.</p>
            </div>
          </article>

          {expenses.length === 0 && <div className="panel empty-state">Aun no hay egresos registrados hoy.</div>}

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
                onClick={() => setVoidingExpense(expense)}
                disabled={savingVoid}
              >
                <Trash2 size={16} aria-hidden="true" />
                Anular
              </button>
            </article>
          ))}
        </section>
      )}

      {voidingExpense && (
        <VoidReasonModal
          title="Anular egreso"
          description={`Confirma por que se anula "${voidingExpense.descripcion}".`}
          confirmLabel="Anular egreso"
          saving={savingVoid}
          onClose={() => setVoidingExpense(null)}
          onConfirm={handleVoidExpense}
        />
      )}
    </div>
  )
}

function formatDateForExpense(dateKey: string) {
  const [year, month, day] = dateKey.split("-")
  if (!year || !month || !day) return dateKey
  return `${day}/${month}/${year}`
}
