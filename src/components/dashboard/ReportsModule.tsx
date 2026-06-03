"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Boxes, CalendarDays, Filter, History, RotateCcw, Trash2, TrendingUp } from "lucide-react"
import {
  formatCurrency,
  formatDateKey,
  formatDateTime,
  getCurrentMonthPrefix,
  getDateDaysAgo,
  saleLabel
} from "@/lib/format"
import {
  buildReportMetrics,
  getInventorySnapshot,
  getPresetDateRange,
  getTopProducts,
  type ReportPreset
} from "@/lib/dashboard/reports"
import { createExpensesReportQuery, createVoidedExpensesReportQuery, restoreExpense, voidExpense } from "@/lib/data/expenses"
import { fetchProducts } from "@/lib/data/products"
import { createSalesReportQuery, createVoidedSalesReportQuery, restoreSale, voidSale } from "@/lib/data/sales"
import { VoidReasonModal } from "@/components/ui/VoidReasonModal"
import type { Expense, Product, Sale, SaleItem } from "@/types/app"

type ReportsModuleProps = {
  refreshSignal: number
}

export function ReportsModule({ refreshSignal }: ReportsModuleProps) {
  const today = formatDateKey()
  const lastSevenDays = getDateDaysAgo(6)
  const currentMonth = getCurrentMonthPrefix()
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [voidedSales, setVoidedSales] = useState<Sale[]>([])
  const [voidedExpenses, setVoidedExpenses] = useState<Expense[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null)
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null)
  const [savingVoid, setSavingVoid] = useState(false)
  const [restoringId, setRestoringId] = useState("")
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [activePreset, setActivePreset] = useState<ReportPreset>("today")

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError("")

    if (dateFrom && dateTo && dateFrom > dateTo) {
      setSales([])
      setExpenses([])
      setVoidedSales([])
      setVoidedExpenses([])
      setLoading(false)
      setError("La fecha inicial no puede ser mayor que la fecha final.")
      return
    }

    const salesQuery = createSalesReportQuery(dateFrom, dateTo)
    const expensesQuery = createExpensesReportQuery(dateFrom, dateTo)
    const voidedSalesQuery = createVoidedSalesReportQuery(dateFrom, dateTo)
    const voidedExpensesQuery = createVoidedExpensesReportQuery(dateFrom, dateTo)

    const [
      { data: salesData, error: salesError },
      { data: expensesData, error: expensesError },
      { data: voidedSalesData, error: voidedSalesError },
      { data: voidedExpensesData, error: voidedExpensesError },
      { data: productData, error: productError }
    ] = await Promise.all([salesQuery, expensesQuery, voidedSalesQuery, voidedExpensesQuery, fetchProducts()])

    if (salesError || expensesError || voidedSalesError || voidedExpensesError || productError) {
      setError(
        salesError?.message ??
          expensesError?.message ??
          voidedSalesError?.message ??
          voidedExpensesError?.message ??
          productError?.message ??
          "No se pudieron cargar reportes."
      )
      setLoading(false)
      return
    }

    setSales((salesData ?? []) as Sale[])
    setExpenses((expensesData ?? []) as Expense[])
    setVoidedSales((voidedSalesData ?? []) as Sale[])
    setVoidedExpenses((voidedExpensesData ?? []) as Expense[])
    setProducts((productData ?? []) as Product[])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => {
    void loadReports()
  }, [loadReports, refreshSignal])

  const metrics = useMemo(
    () => buildReportMetrics(sales, expenses, dateFrom, dateTo),
    [dateFrom, dateTo, expenses, sales]
  )
  const topProducts = useMemo(() => getTopProducts(sales), [sales])
  const { inventoryItems, saleProducts, inventoryTotal, suspendedProducts } = useMemo(
    () => getInventorySnapshot(products),
    [products]
  )

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

  async function handleVoidSale(reason: string) {
    if (!voidingSale) return

    const sale = voidingSale
    setSavingVoid(true)
    setError("")
    setNotice("")

    const { error: voidError } = await voidSale(sale.id, reason)

    setSavingVoid(false)

    if (voidError) {
      setVoidingSale(null)
      setError(voidError.message)
      return
    }

    setSales((current) => current.filter((item) => item.id !== sale.id))
    setVoidedSales((current) => [
      {
        ...sale,
        eliminado: true,
        eliminado_motivo: reason,
        eliminado_at: new Date().toISOString()
      },
      ...current
    ])
    setVoidingSale(null)
    setNotice(`${saleLabel(sale.folio_diario, sale.fecha_dia)} anulada. Ya no influye en este reporte.`)
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
    setVoidedExpenses((current) => [
      {
        ...expense,
        eliminado: true,
        eliminado_motivo: reason,
        eliminado_at: new Date().toISOString()
      },
      ...current
    ])
    setVoidingExpense(null)
    setNotice(`Egreso anulado: ${expense.descripcion}. Ya no influye en este reporte.`)
  }

  async function handleRestoreSale(sale: Sale) {
    setRestoringId(sale.id)
    setError("")
    setNotice("")

    const { error: restoreError } = await restoreSale(sale.id)

    setRestoringId("")

    if (restoreError) {
      setError(restoreError.message)
      return
    }

    setVoidedSales((current) => current.filter((item) => item.id !== sale.id))
    setSales((current) => [{ ...sale, eliminado: false }, ...current])
    setNotice(`${saleLabel(sale.folio_diario, sale.fecha_dia)} restaurada. Vuelve a influir en el reporte.`)
  }

  async function handleRestoreExpense(expense: Expense) {
    setRestoringId(expense.id)
    setError("")
    setNotice("")

    const { error: restoreError } = await restoreExpense(expense.id)

    setRestoringId("")

    if (restoreError) {
      setError(restoreError.message)
      return
    }

    setVoidedExpenses((current) => current.filter((item) => item.id !== expense.id))
    setExpenses((current) => [{ ...expense, eliminado: false }, ...current])
    setNotice(`Egreso restaurado: ${expense.descripcion}. Vuelve a influir en el reporte.`)
  }

  return (
    <div className="module">
      <div className="module-title">
        <div>
          <h2>Resumen del negocio</h2>
          <p>Ventas, egresos, resultado neto e inventario actual.</p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <section className="panel report-filters">
        <div className="filter-title">
          <Filter size={18} />
          <div>
            <h2>Filtro de ventas</h2>
            <p>Consulta ventas y egresos por dia, semana, mes o historial completo.</p>
          </div>
        </div>

        <div className="filter-grid">
          <div className="field">
            <label htmlFor="date-from">Desde</label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => handleDateFromChange(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="date-to">Hasta</label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(event) => handleDateToChange(event.target.value)}
            />
          </div>

          <div className="actions-row filter-actions">
            <button
              className={`button subtle ${activePreset === "today" ? "active" : ""}`}
              type="button"
              onClick={() => setPreset("today")}
            >
              Hoy
            </button>
            <button
              className={`button subtle ${activePreset === "week" ? "active" : ""}`}
              type="button"
              onClick={() => setPreset("week")}
            >
              7 dias
            </button>
            <button
              className={`button subtle ${activePreset === "month" ? "active" : ""}`}
              type="button"
              onClick={() => setPreset("month")}
            >
              Mes
            </button>
            <button
              className={`button subtle ${activePreset === "all" ? "active" : ""}`}
              type="button"
              onClick={() => setPreset("all")}
            >
              Todo
            </button>
          </div>
        </div>
      </section>

      {loading && <div className="panel empty-state">Cargando reportes...</div>}

      {!loading && (
        <>
          <section className="metrics-grid">
            {metrics.map((metric) => (
              <article className="metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.caption}</small>
              </article>
            ))}
          </section>

          <section className="report-grid">
            <div className="history-list">
              <article className="panel">
                <div className="section-title">
                  <h2>Historial de ventas</h2>
                  <p>Hasta 1000 ventas para el filtro seleccionado.</p>
                </div>
              </article>

              {sales.length === 0 && <div className="panel empty-state">Aun no hay ventas registradas.</div>}

              {sales.map((sale) => (
                <article className="history-row" key={sale.id}>
                  <div className="history-meta">
                    <span className="badge active">{saleLabel(sale.folio_diario, sale.fecha_dia)}</span>
                  <span>{formatDateTime(sale.fecha)}</span>
                  </div>
                  <div className="total-line">
                    <strong>{formatCurrency(sale.total)}</strong>
                    <span className="muted">
                      Recibido {formatCurrency(sale.dinero_recibido)} · Cambio {formatCurrency(sale.cambio)}
                    </span>
                  </div>
                  <SaleDetails details={sale.detalle_ventas ?? []} />
                  <button
                    className="button subtle"
                    type="button"
                    onClick={() => setVoidingSale(sale)}
                    disabled={savingVoid}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Anular venta
                  </button>
                </article>
              ))}

              <article className="panel">
                <div className="section-title">
                  <h2>Historial de egresos</h2>
                  <p>Gastos registrados para el mismo filtro de fechas.</p>
                </div>
              </article>

              {expenses.length === 0 && <div className="panel empty-state">Aun no hay egresos registrados.</div>}

              {expenses.map((expense) => (
                <article className="history-row" key={expense.id}>
                  <div className="history-meta">
                    <span className="badge off">{formatDateForReport(expense.fecha_dia)}</span>
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
                    Anular egreso
                  </button>
                </article>
              ))}

              <article className="panel">
                <div className="section-title">
                  <h2>Historial de anulaciones</h2>
                  <p>Ventas y egresos anulados en el mismo filtro. No influyen en las metricas.</p>
                </div>
              </article>

              {voidedSales.length === 0 && voidedExpenses.length === 0 && (
                <div className="panel empty-state">No hay anulaciones para este filtro.</div>
              )}

              {voidedSales.map((sale) => (
                <article className="history-row" key={`voided-sale-${sale.id}`}>
                  <div className="history-meta">
                    <span className="badge off">Venta anulada</span>
                    <span>{saleLabel(sale.folio_diario, sale.fecha_dia)}</span>
                    <span>{formatVoidedAt(sale.eliminado_at)}</span>
                  </div>
                  <div className="total-line">
                    <strong>{formatCurrency(sale.total)}</strong>
                    <span className="muted">{sale.eliminado_motivo ?? "Sin motivo registrado"}</span>
                  </div>
                  <button
                    className="button subtle"
                    type="button"
                    onClick={() => handleRestoreSale(sale)}
                    disabled={restoringId === sale.id}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    {restoringId === sale.id ? "Restaurando..." : "Deshacer anulacion"}
                  </button>
                </article>
              ))}

              {voidedExpenses.map((expense) => (
                <article className="history-row" key={`voided-expense-${expense.id}`}>
                  <div className="history-meta">
                    <span className="badge off">Egreso anulado</span>
                    <span>{formatDateForReport(expense.fecha_dia)}</span>
                    <span>{formatVoidedAt(expense.eliminado_at)}</span>
                  </div>
                  <div className="total-line">
                    <strong>{formatCurrency(expense.valor)}</strong>
                    <span className="muted">
                      {expense.descripcion} - {expense.eliminado_motivo ?? "Sin motivo registrado"}
                    </span>
                  </div>
                  <button
                    className="button subtle"
                    type="button"
                    onClick={() => handleRestoreExpense(expense)}
                    disabled={restoringId === expense.id}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    {restoringId === expense.id ? "Restaurando..." : "Deshacer anulacion"}
                  </button>
                </article>
              ))}
            </div>

            <aside className="history-list">
              <article className="panel">
                <div className="section-title">
                  <h2>Inventario general</h2>
                  <p>
                    {inventoryTotal} unidades de inventario · {saleProducts.length} productos ·{" "}
                    {suspendedProducts} suspendidos
                  </p>
                </div>
              </article>

              <article className="metric">
                <span>Productos mas vendidos</span>
                {topProducts.length === 0 && <p className="muted">Apareceran cuando existan ventas.</p>}
                {topProducts.map((item) => (
                  <div className="total-line" key={item.name}>
                    <span>{item.name}</span>
                    <strong>{item.quantity}</strong>
                  </div>
                ))}
              </article>

              <article className="metric">
                <span>Lectura rapida</span>
                <div className="actions-row">
                  <CalendarDays size={18} />
                  <span>Hoy: {today}</span>
                </div>
                <div className="actions-row">
                  <TrendingUp size={18} />
                  <span>Resultado neto: {metrics[0]?.value ?? formatCurrency(0)}</span>
                </div>
                <div className="actions-row">
                  <Boxes size={18} />
                  <span>{inventoryTotal} existencias totales</span>
                </div>
                <div className="actions-row">
                  <History size={18} />
                  <span>
                    {sales.length} ventas y {expenses.length} egresos
                  </span>
                </div>
              </article>

              {inventoryItems.map((product) => (
                <article className="stock-row" key={product.id}>
                  <div>
                    <strong>{product.nombre}</strong>
                    <div className="muted">
                      {product.tipo_unidad} · {product.activo ? "Activo" : "Suspendido"}
                    </div>
                  </div>
                  <span className={`badge ${product.activo ? "active" : "off"}`}>
                    {product.cantidad_stock}
                  </span>
                </article>
              ))}
            </aside>
          </section>
        </>
      )}

      {voidingSale && (
        <VoidReasonModal
          title="Anular venta"
          description={`Confirma por que se anula ${saleLabel(voidingSale.folio_diario, voidingSale.fecha_dia)}.`}
          confirmLabel="Anular venta"
          saving={savingVoid}
          onClose={() => setVoidingSale(null)}
          onConfirm={handleVoidSale}
        />
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

function SaleDetails({ details }: { details: SaleItem[] }) {
  if (details.length === 0) {
    return <p className="muted">Sin detalle de productos.</p>
  }

  return (
    <div className="history-list">
      {details.map((detail) => (
        <div className="history-meta" key={detail.id}>
          <span>
            {detail.cantidad} x {detail.producto_nombre}
          </span>
          <strong>{formatCurrency(detail.subtotal)}</strong>
        </div>
      ))}
    </div>
  )
}

function formatDateForReport(dateKey: string) {
  const [year, month, day] = dateKey.split("-")
  if (!year || !month || !day) return dateKey
  return `${day}/${month}/${year}`
}

function formatVoidedAt(value: string | null) {
  if (!value) return "Sin fecha de anulacion"
  return formatDateTime(value)
}
