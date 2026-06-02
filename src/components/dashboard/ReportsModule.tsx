"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Boxes, CalendarDays, Filter, History, TrendingUp } from "lucide-react"
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
import { fetchProducts } from "@/lib/data/products"
import { createSalesReportQuery } from "@/lib/data/sales"
import type { Product, Sale, SaleItem } from "@/types/app"

type ReportsModuleProps = {
  refreshSignal: number
}

export function ReportsModule({ refreshSignal }: ReportsModuleProps) {
  const today = formatDateKey()
  const lastSevenDays = getDateDaysAgo(6)
  const currentMonth = getCurrentMonthPrefix()
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [activePreset, setActivePreset] = useState<ReportPreset>("today")

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError("")

    if (dateFrom && dateTo && dateFrom > dateTo) {
      setSales([])
      setLoading(false)
      setError("La fecha inicial no puede ser mayor que la fecha final.")
      return
    }

    const salesQuery = createSalesReportQuery(dateFrom, dateTo)

    const [{ data: salesData, error: salesError }, { data: productData, error: productError }] =
      await Promise.all([salesQuery, fetchProducts()])

    if (salesError || productError) {
      setError(salesError?.message ?? productError?.message ?? "No se pudieron cargar reportes.")
      setLoading(false)
      return
    }

    setSales((salesData ?? []) as Sale[])
    setProducts((productData ?? []) as Product[])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => {
    void loadReports()
  }, [loadReports, refreshSignal])

  const metrics = useMemo(() => buildReportMetrics(sales, dateFrom, dateTo), [dateFrom, dateTo, sales])
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

  return (
    <div className="module">
      <div className="module-title">
        <div>
          <h2>Resumen del negocio</h2>
          <p>Ventas del dia, semana, mes, historial general e inventario actual.</p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <section className="panel report-filters">
        <div className="filter-title">
          <Filter size={18} />
          <div>
            <h2>Filtro de ventas</h2>
            <p>Consulta un dia especifico o un rango de fechas.</p>
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
                  <span>Total filtrado: {metrics[0]?.value ?? formatCurrency(0)}</span>
                </div>
                <div className="actions-row">
                  <Boxes size={18} />
                  <span>{inventoryTotal} existencias totales</span>
                </div>
                <div className="actions-row">
                  <History size={18} />
                  <span>{sales.length} ventas en historial</span>
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
