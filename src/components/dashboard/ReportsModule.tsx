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
import { supabase } from "@/lib/supabase/client"
import type { Product, Sale, SaleItem } from "@/types/app"

type ReportsModuleProps = {
  refreshSignal: number
}

type Metric = {
  label: string
  value: string
  caption: string
}

type ReportPreset = "today" | "week" | "month" | "all" | "custom"

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

    const [{ data: salesData, error: salesError }, { data: productData, error: productError }] =
      await Promise.all([
        salesQuery,
        supabase.from("productos").select("*").order("nombre", { ascending: true })
      ])

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

  const metrics = useMemo<Metric[]>(() => {
    const sum = (items: Sale[]) => items.reduce((total, sale) => total + sale.total, 0)
    const total = sum(sales)
    const units = sales.reduce(
      (count, sale) =>
        count + (sale.detalle_ventas ?? []).reduce((saleCount, detail) => saleCount + detail.cantidad, 0),
      0
    )
    const average = sales.length > 0 ? Math.round(total / sales.length) : 0

    return [
      { label: "Total filtrado", value: formatCurrency(total), caption: `${sales.length} ventas` },
      { label: "Productos vendidos", value: String(units), caption: "unidades en detalle" },
      { label: "Promedio por venta", value: formatCurrency(average), caption: "ticket promedio" },
      { label: "Rango", value: getRangeLabel(dateFrom, dateTo), caption: "consulta activa" }
    ]
  }, [dateFrom, dateTo, sales])

  const topProducts = useMemo(() => {
    const productMap = new Map<string, { quantity: number; total: number }>()

    for (const sale of sales) {
      for (const detail of sale.detalle_ventas ?? []) {
        const current = productMap.get(detail.producto_nombre) ?? { quantity: 0, total: 0 }
        productMap.set(detail.producto_nombre, {
          quantity: current.quantity + detail.cantidad,
          total: current.total + detail.subtotal
        })
      }
    }

    return Array.from(productMap.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }, [sales])

  const inventoryItems = products.filter((product) => product.tipo_item === "inventario")
  const saleProducts = products.filter((product) => product.tipo_item === "producto")
  const inventoryTotal = inventoryItems.reduce((total, product) => total + product.cantidad_stock, 0)
  const suspendedProducts = products.filter((product) => !product.activo).length

  function setPreset(preset: ReportPreset) {
    setActivePreset(preset)

    if (preset === "today") {
      setDateFrom(today)
      setDateTo(today)
      return
    }

    if (preset === "week") {
      setDateFrom(lastSevenDays)
      setDateTo(today)
      return
    }

    if (preset === "month") {
      setDateFrom(`${currentMonth}-01`)
      setDateTo(today)
      return
    }

    if (preset === "all") {
      setDateFrom("")
      setDateTo("")
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

function getRangeLabel(dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) return "Todo"
  if (dateFrom && dateTo && dateFrom === dateTo) return formatDateForLabel(dateFrom)
  if (dateFrom && dateTo) return `${formatDateForLabel(dateFrom)} a ${formatDateForLabel(dateTo)}`
  if (dateFrom) return `Desde ${formatDateForLabel(dateFrom)}`
  return `Hasta ${formatDateForLabel(dateTo)}`
}

function formatDateForLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-")
  if (!year || !month || !day) return dateKey
  return `${day}/${month}/${year}`
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
