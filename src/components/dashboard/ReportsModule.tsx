"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Boxes, Building2, CalendarDays, Download, Filter, History, RotateCcw, Trash2, TrendingUp } from "lucide-react"
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
import {
  downloadReportAsExcel,
  downloadReportAsPdf,
  type ReportExportSection
} from "@/lib/dashboard/reportExport"
import {
  clampReportRangeByPlan,
  getPlanCapabilities,
  getPlanDisplayName,
  getReportHistoryLabel,
  getReportHistoryStartDate,
  type ReportExportFormat
} from "@/lib/planLimits"
import { createExpensesReportQuery, createVoidedExpensesReportQuery, restoreExpense, voidExpense } from "@/lib/data/expenses"
import { fetchProducts, fetchProductsByRestaurant } from "@/lib/data/products"
import { fetchRestaurants, fetchUserAuditProfiles } from "@/lib/data/restaurants"
import { createSalesReportQuery, createVoidedSalesReportQuery, restoreSale, voidSale } from "@/lib/data/sales"
import { ModalBackdrop, ModalHeader } from "@/components/ui/Modal"
import { VoidReasonModal } from "@/components/ui/VoidReasonModal"
import type { Expense, Product, Restaurant, Sale, SaleItem, SubscriptionLevel, UserAuditProfile } from "@/types/app"

type ReportsModuleProps = {
  isGlobal?: boolean
  limitedToToday?: boolean
  subscriptionLevel?: SubscriptionLevel | null
  businessName?: string
  refreshSignal: number
}

const defaultExportSections: ReportExportSection[] = ["summary", "sales", "expenses"]

export function ReportsModule({
  isGlobal = false,
  limitedToToday = false,
  subscriptionLevel,
  businessName = "Cuadre",
  refreshSignal
}: ReportsModuleProps) {
  const today = formatDateKey()
  const lastSevenDays = getDateDaysAgo(6)
  const currentMonth = getCurrentMonthPrefix()
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [voidedSales, setVoidedSales] = useState<Sale[]>([])
  const [voidedExpenses, setVoidedExpenses] = useState<Expense[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [usersById, setUsersById] = useState<Record<string, UserAuditProfile>>({})
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("")
  const [loadingRestaurants, setLoadingRestaurants] = useState(isGlobal)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null)
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null)
  const [savingVoid, setSavingVoid] = useState(false)
  const [restoringId, setRestoringId] = useState("")
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ReportExportFormat>("pdf")
  const [exportSections, setExportSections] = useState<ReportExportSection[]>(defaultExportSections)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [activePreset, setActivePreset] = useState<ReportPreset>("today")
  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  )
  const activePlanLevel = isGlobal ? selectedRestaurant?.nivel_suscripcion : subscriptionLevel
  const planCapabilities = useMemo(() => getPlanCapabilities(activePlanLevel), [activePlanLevel])
  const forcedToday = limitedToToday || planCapabilities.reportTodayOnly
  const effectiveReportCapabilities = useMemo(
    () => forcedToday ? { ...planCapabilities, reportTodayOnly: true, reportHistoryDays: null } : planCapabilities,
    [forcedToday, planCapabilities]
  )
  const reportRange = useMemo(
    () =>
      clampReportRangeByPlan({
        capabilities: effectiveReportCapabilities,
        today,
        dateFrom,
        dateTo
      }),
    [dateFrom, dateTo, effectiveReportCapabilities, today]
  )
  const reportDateFrom = reportRange.dateFrom
  const reportDateTo = reportRange.dateTo
  const exportFormats = planCapabilities.exportFormats
  const canExportReports = exportFormats.length > 0
  const selectedReportBusinessName = selectedRestaurant?.nombre ?? businessName
  const activePlanName = getPlanDisplayName(activePlanLevel)

  useEffect(() => {
    if (!isGlobal) return

    let mounted = true

    async function loadRestaurants() {
      setLoadingRestaurants(true)
      const { data, error: restaurantsError } = await fetchRestaurants()

      if (!mounted) return

      if (restaurantsError) {
        setError(restaurantsError.message)
        setRestaurants([])
        setLoadingRestaurants(false)
        return
      }

      const nextRestaurants = (data ?? []) as Restaurant[]
      setRestaurants(nextRestaurants)
      setSelectedRestaurantId((current) => current || nextRestaurants[0]?.id || "")
      setLoadingRestaurants(false)
    }

    void loadRestaurants()

    return () => {
      mounted = false
    }
  }, [isGlobal])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError("")

    if (reportDateFrom && reportDateTo && reportDateFrom > reportDateTo) {
      setSales([])
      setExpenses([])
      setVoidedSales([])
      setVoidedExpenses([])
      setUsersById({})
      setLoading(false)
      setError("La fecha inicial no puede ser mayor que la fecha final.")
      return
    }

    if (isGlobal && !selectedRestaurantId) {
      setSales([])
      setExpenses([])
      setVoidedSales([])
      setVoidedExpenses([])
      setProducts([])
      setUsersById({})
      setLoading(false)
      return
    }

    const reportRestaurantId = isGlobal ? selectedRestaurantId : undefined
    const salesQuery = createSalesReportQuery(reportDateFrom, reportDateTo, reportRestaurantId)
    const expensesQuery = createExpensesReportQuery(reportDateFrom, reportDateTo, reportRestaurantId)
    const voidedSalesQuery = createVoidedSalesReportQuery(reportDateFrom, reportDateTo, reportRestaurantId)
    const voidedExpensesQuery = createVoidedExpensesReportQuery(reportDateFrom, reportDateTo, reportRestaurantId)
    const productsQuery = reportRestaurantId ? fetchProductsByRestaurant(reportRestaurantId) : fetchProducts()

    const [
      { data: salesData, error: salesError },
      { data: expensesData, error: expensesError },
      { data: voidedSalesData, error: voidedSalesError },
      { data: voidedExpensesData, error: voidedExpensesError },
      { data: productData, error: productError }
    ] = await Promise.all([salesQuery, expensesQuery, voidedSalesQuery, voidedExpensesQuery, productsQuery])

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

    const nextSales = (salesData ?? []) as Sale[]
    const nextVoidedSales = (voidedSalesData ?? []) as Sale[]
    const auditUserIds = [
      ...nextSales.map((sale) => sale.user_id),
      ...nextSales.map((sale) => sale.eliminado_por ?? ""),
      ...nextVoidedSales.map((sale) => sale.user_id),
      ...nextVoidedSales.map((sale) => sale.eliminado_por ?? "")
    ]
    const { data: auditUsers } = await fetchUserAuditProfiles(auditUserIds)

    setUsersById(
      Object.fromEntries((auditUsers ?? []).map((user) => [user.user_id, user]))
    )
    setSales(nextSales)
    setExpenses((expensesData ?? []) as Expense[])
    setVoidedSales(nextVoidedSales)
    setVoidedExpenses((voidedExpensesData ?? []) as Expense[])
    setProducts((productData ?? []) as Product[])
    setLoading(false)
  }, [isGlobal, reportDateFrom, reportDateTo, selectedRestaurantId])

  useEffect(() => {
    void loadReports()
  }, [loadReports, refreshSignal])

  useEffect(() => {
    setExportFormat((current) => exportFormats.includes(current) ? current : exportFormats[0] ?? "pdf")
  }, [exportFormats])

  const metrics = useMemo(
    () => buildReportMetrics(sales, expenses, reportDateFrom, reportDateTo),
    [expenses, reportDateFrom, reportDateTo, sales]
  )
  const topProducts = useMemo(() => getTopProducts(sales), [sales])
  const { inventoryItems, saleProducts, inventoryTotal, suspendedProducts } = useMemo(
    () => getInventorySnapshot(products),
    [products]
  )

  function setPreset(preset: ReportPreset) {
    setActivePreset(preset)

    if (forcedToday) {
      setDateFrom(today)
      setDateTo(today)
      return
    }

    if (preset === "all" && planCapabilities.reportHistoryDays) {
      setDateFrom(getReportHistoryStartDate(today, planCapabilities.reportHistoryDays))
      setDateTo(today)
      return
    }

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

    setVoidingSale(null)
    setNotice(`${saleLabel(sale.folio_diario, sale.fecha_dia)} anulada. Ya no influye en este reporte.`)
    await loadReports()
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

  function handleExportReport() {
    if (!canExportReports || exportSections.length === 0) return

    const payload = {
      businessName: selectedReportBusinessName,
      planName: activePlanName,
      dateFrom: reportDateFrom,
      dateTo: reportDateTo,
      metrics,
      sales,
      expenses,
      voidedSales,
      voidedExpenses,
      products,
      sections: exportSections
    }

    if (exportFormat === "excel") {
      downloadReportAsExcel(payload)
    } else {
      downloadReportAsPdf(payload)
    }

    setIsExportOpen(false)
    setNotice(`Reporte preparado en ${exportFormat === "excel" ? "Excel" : "PDF"}.`)
  }

  function toggleExportSection(section: ReportExportSection) {
    setExportSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section]
    )
  }

  return (
    <div className="module">
      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      {isGlobal && (
        <section className="panel global-report-selector">
          <div className="filter-title">
            <Building2 size={18} />
            <div>
              <h2>Emprendimiento seleccionado</h2>
              <p>Los reportes globales se consultan por cliente para evitar mezclar operaciones.</p>
            </div>
          </div>
          <div className="filter-grid compact">
            <div className="field">
              <label htmlFor="global-restaurant">Emprendimiento</label>
              <select
                id="global-restaurant"
                value={selectedRestaurantId}
                onChange={(event) => setSelectedRestaurantId(event.target.value)}
                disabled={loadingRestaurants || restaurants.length === 0}
              >
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.nombre} - {restaurant.nivel_suscripcion}
                  </option>
                ))}
              </select>
            </div>
            <article className="metric global-report-business">
              <span>{selectedRestaurant?.activo ? "Activo" : "Suspendido"}</span>
              <strong>{selectedRestaurant?.nombre ?? "Sin emprendimientos"}</strong>
              <small>{selectedRestaurant?.admin_email ?? "Registra un cliente para consultar reportes."}</small>
            </article>
          </div>
        </section>
      )}

      <section className="panel report-filters">
        <div className="filter-title">
          <Filter size={18} />
          <div>
            <h2>{isGlobal ? "Filtro global" : "Filtro de ventas"}</h2>
            <p>
              {forcedToday
                ? planCapabilities.reportTodayOnly
                  ? "Tu plan solo incluye reportes del dia actual."
                  : "Tu usuario de empleado solo consulta ventas y egresos del dia actual."
                : effectiveReportCapabilities.reportHistoryDays
                ? `Tu plan incluye ${getReportHistoryLabel(effectiveReportCapabilities)}.`
                : isGlobal
                ? "Consulta la operacion consolidada por dia, semana, mes o historial completo."
                : "Consulta ventas y egresos por dia, semana, mes o historial completo."}
            </p>
          </div>
        </div>

        {forcedToday ? (
          <div className="metric report-day-lock">
            <span>Periodo permitido</span>
            <strong>{formatDateForReport(today)}</strong>
            <small>{planCapabilities.reportTodayOnly ? "Incluido en tu plan" : "Acceso operativo diario"}</small>
          </div>
        ) : (
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
                disabled={Boolean(effectiveReportCapabilities.reportHistoryDays)}
                title={effectiveReportCapabilities.reportHistoryDays ? "Tu plan incluye historial de hasta 3 meses." : undefined}
              >
                Todo
              </button>
            </div>
          </div>
        )}

        <div className="report-plan-row">
          <span className="badge active">Tu plan: {activePlanName}</span>
          <span>{getReportHistoryLabel(effectiveReportCapabilities)}</span>
          {canExportReports ? (
            <button className="button mint" type="button" onClick={() => setIsExportOpen(true)} disabled={loading}>
              <Download size={17} aria-hidden="true" />
              Exportar reporte
            </button>
          ) : (
            <span className="muted">Tu plan no incluye descargas de reportes.</span>
          )}
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
                    <span>Vendido por {formatAuditUser(usersById[sale.user_id])}</span>
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
                    <span>Anulada por {formatAuditUser(usersById[sale.eliminado_por ?? ""])}</span>
                  </div>
                  <div className="total-line">
                    <strong>{formatCurrency(sale.total)}</strong>
                    <span className="muted">
                      Vendida por {formatAuditUser(usersById[sale.user_id])} -{" "}
                      {sale.eliminado_motivo ?? "Sin motivo registrado"}
                    </span>
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

      {isExportOpen && (
        <ReportExportModal
          format={exportFormat}
          formats={exportFormats}
          sections={exportSections}
          onFormatChange={setExportFormat}
          onToggleSection={toggleExportSection}
          onClose={() => setIsExportOpen(false)}
          onConfirm={handleExportReport}
        />
      )}
    </div>
  )
}

function ReportExportModal({
  format,
  formats,
  sections,
  onFormatChange,
  onToggleSection,
  onClose,
  onConfirm
}: {
  format: ReportExportFormat
  formats: ReportExportFormat[]
  sections: ReportExportSection[]
  onFormatChange: (format: ReportExportFormat) => void
  onToggleSection: (section: ReportExportSection) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const sectionOptions: { id: ReportExportSection; label: string; description: string }[] = [
    { id: "summary", label: "Resumen", description: "Metricas principales del rango." },
    { id: "sales", label: "Ventas", description: "Historial y totales de ventas." },
    { id: "expenses", label: "Egresos", description: "Gastos registrados en el filtro." },
    { id: "inventory", label: "Inventario", description: "Productos, stock y estado." },
    { id: "voided", label: "Anulaciones", description: "Ventas y egresos anulados." }
  ]

  return (
    <ModalBackdrop>
      <section className="modal-panel form-grid report-export-modal">
        <ModalHeader
          title="Exportar reporte"
          description="Confirma que informacion quieres incluir en la descarga."
          onClose={onClose}
        />

        {formats.length > 1 && (
          <div className="role-selector report-format-selector" role="radiogroup" aria-label="Formato de descarga">
            {formats.map((item) => (
              <button
                key={item}
                className={format === item ? "role-option active" : "role-option"}
                type="button"
                role="radio"
                aria-checked={format === item}
                onClick={() => onFormatChange(item)}
              >
                <span>
                  <strong>{item === "excel" ? "Excel" : "PDF"}</strong>
                  <small>{item === "excel" ? "Tablas para analizar" : "Resumen imprimible"}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {formats.length === 1 && (
          <div className="notice">Tu plan permite descargar este reporte en {formats[0] === "pdf" ? "PDF" : "Excel"}.</div>
        )}

        <div className="export-section-list">
          {sectionOptions.map((section) => (
            <label className="check-row" key={section.id}>
              <input
                type="checkbox"
                checked={sections.includes(section.id)}
                onChange={() => onToggleSection(section.id)}
              />
              <span>
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </span>
            </label>
          ))}
        </div>

        <button className="button primary" type="button" onClick={onConfirm} disabled={sections.length === 0}>
          <Download size={18} aria-hidden="true" />
          Descargar reporte
        </button>
      </section>
    </ModalBackdrop>
  )
}

function SaleDetails({ details }: { details: SaleItem[] }) {
  if (details.length === 0) {
    return <p className="muted">Sin detalle de productos.</p>
  }

  return (
    <div className="history-list">
      {details.map((detail) => (
        <div className="history-detail" key={detail.id}>
          <div className="history-meta">
            <span>
              {detail.cantidad} x {detail.producto_nombre}
            </span>
            <strong>{formatCurrency(detail.subtotal)}</strong>
          </div>
          {detail.nota && <p className="muted">{detail.nota}</p>}
          {detail.detalle_venta_inventario && detail.detalle_venta_inventario.length > 0 && (
            <div className="history-consumption-list">
              {detail.detalle_venta_inventario.map((consumption) => (
                <span key={consumption.id}>
                  {consumption.inventario_nombre}: {consumption.cantidad} ({consumption.origen})
                </span>
              ))}
            </div>
          )}
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

function formatAuditUser(user?: UserAuditProfile) {
  if (!user) return "usuario no disponible"
  return user.nombre?.trim() || user.email || "usuario sin nombre"
}
