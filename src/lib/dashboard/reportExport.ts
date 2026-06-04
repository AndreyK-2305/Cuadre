import { formatCurrency, formatDateTime, saleLabel } from "@/lib/format"
import {
  getAverageTicket,
  getProductInsights,
  getRangeLabel,
  getReportTrendPoints,
  type Metric,
  type ProductInsight,
  type ReportTrendPoint
} from "@/lib/dashboard/reports"
import type { Expense, Product, Sale, SaleItem } from "@/types/app"

export type ReportExportSection = "summary" | "analytics" | "sales" | "expenses" | "inventory" | "voided"

export type ReportExportPayload = {
  businessName: string
  planName: string
  dateFrom: string
  dateTo: string
  metrics: Metric[]
  sales: Sale[]
  expenses: Expense[]
  voidedSales: Sale[]
  voidedExpenses: Expense[]
  products: Product[]
  sections: ReportExportSection[]
}

type ReportOverview = {
  salesTotal: number
  expensesTotal: number
  netResult: number
  unitsSold: number
  salesCount: number
  expensesCount: number
  voidedSalesCount: number
  voidedExpensesCount: number
  rangeLabel: string
  generatedAt: string
}

type AnalyticsData = {
  trendPoints: ReportTrendPoint[]
  productInsights: ProductInsight[]
  averageTicket: number
  peakTrendDay: ReportTrendPoint | null
  topProduct: ProductInsight | null
  netResult: number
  maxTrendValue: number
  maxProductQuantity: number
}

type TableSpec = {
  title: string
  subtitle: string
  accent: string
  headers: string[]
  widths: number[]
  rows: string[][]
  boldColumns: number[]
  emptyLabel: string
}

type PdfPage = {
  ops: string[]
}

const PDF = {
  width: 612,
  height: 792,
  marginX: 42,
  topMargin: 36,
  bottomMargin: 36,
  gutter: 12
} as const

const COLORS = {
  primary: "#155E75",
  primaryDark: "#0F3A4B",
  accent: "#C9952A",
  success: "#1E7B39",
  danger: "#B42318",
  text: "#13212B",
  muted: "#6B7280",
  border: "#D7E0E8",
  soft: "#F7FAFC",
  softAlt: "#EEF4F7",
  white: "#FFFFFF"
} as const

export function downloadReportAsPdf(payload: ReportExportPayload) {
  downloadBlob(buildStyledPdfBlob(payload), buildReportFileName(payload, "pdf"))
}

export function downloadReportAsExcel(payload: ReportExportPayload) {
  const html = buildStyledExcelHtml(payload)
  downloadBlob(
    new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }),
    buildReportFileName(payload, "xls")
  )
}

function buildStyledPdfBlob(payload: ReportExportPayload) {
  const overview = buildReportOverview(payload)
  const analytics = buildAnalyticsData(payload, overview)
  const pages: PdfPage[] = []
  const specs = buildTableSpecs(payload)
  const includeSummary = payload.sections.includes("summary")

  if (includeSummary) {
    renderSummaryPage(pages, payload, overview)
  }

  if (payload.sections.includes("analytics")) {
    renderAnalyticsPage(pages, payload, overview, analytics)
  }

  for (const spec of specs) {
    renderTableSection(pages, payload, overview, spec)
  }

  if (pages.length === 0) {
    renderEmptyReportPage(pages, payload, overview)
  }

  return assemblePdf(pages)
}

function buildStyledExcelHtml(payload: ReportExportPayload) {
  const overview = buildReportOverview(payload)
  const analytics = buildAnalyticsData(payload, overview)
  const specs = buildTableSpecs(payload)
  const includeSummary = payload.sections.includes("summary")
  const includeAnalytics = payload.sections.includes("analytics")

  const summaryCards = includeSummary
    ? `
      <div class="summary-title">Resumen neto del periodo del informe</div>
      <table class="summary-table" role="presentation">
        <tr>
          <td>${summaryCardHtml("Resultado neto", formatSignedCurrency(overview.netResult), "Ventas menos egresos", overview.netResult >= 0 ? "success" : "danger")}</td>
          <td>${summaryCardHtml("Ventas filtradas", formatCurrency(overview.salesTotal), `${overview.salesCount} ventas registradas`, "primary")}</td>
        </tr>
        <tr>
          <td>${summaryCardHtml("Egresos filtrados", formatCurrency(overview.expensesTotal), `${overview.expensesCount} registros`, "accent")}</td>
          <td>${summaryCardHtml("Productos vendidos", String(overview.unitsSold), "Unidades en detalle", "soft")}</td>
        </tr>
      </table>
      <table class="summary-strip-table" role="presentation">
        <tr>
          <td><strong>Ventana:</strong> ${escapeHtml(overview.rangeLabel)}</td>
          <td><strong>Anulaciones:</strong> ${overview.voidedSalesCount + overview.voidedExpensesCount}</td>
          <td><strong>Generado:</strong> ${escapeHtml(overview.generatedAt)}</td>
        </tr>
      </table>
    `
    : ""

  const analyticsSection = includeAnalytics
    ? analyticsSectionHtml(analytics)
    : ""

  const sectionsHtml = specs
    .map((spec) => {
      const bodyRows = spec.rows.length > 0 ? spec.rows : [[spec.emptyLabel]]
      return `
        <section class="report-section">
          <div class="section-head" style="--accent:${spec.accent}">
            <div>
              <span class="section-kicker">Cuadre</span>
              <h2>${escapeHtml(spec.title)}</h2>
              <p>${escapeHtml(spec.subtitle)}</p>
            </div>
          </div>
          <table class="report-table">
            <thead>
              <tr>
                ${spec.headers
                  .map((header, index) => `<th style="width:${spec.widths[index]}px">${escapeHtml(header)}</th>`)
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${bodyRows
                .map((row) => {
                  if (row.length === 1 && row[0] === spec.emptyLabel) {
                    return `<tr><td colspan="${spec.headers.length}" class="empty-cell">${escapeHtml(row[0])}</td></tr>`
                  }

                  return `
                    <tr>
                      ${row
                        .map((cell, index) => {
                          const isBold = spec.boldColumns.includes(index)
                          return `<td class="${isBold ? "is-bold" : ""}">${escapeHtml(cell)}</td>`
                        })
                        .join("")}
                    </tr>
                  `
                })
                .join("")}
            </tbody>
          </table>
        </section>
      `
    })
    .join("")

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        :root {
          --primary: ${COLORS.primary};
          --primary-dark: ${COLORS.primaryDark};
          --accent: ${COLORS.accent};
          --success: ${COLORS.success};
          --danger: ${COLORS.danger};
          --text: ${COLORS.text};
          --muted: ${COLORS.muted};
          --border: ${COLORS.border};
          --soft: ${COLORS.soft};
          --soft-alt: ${COLORS.softAlt};
          --white: ${COLORS.white};
        }

        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 28px;
          font-family: Arial, Helvetica, sans-serif;
          color: var(--text);
          background:
            linear-gradient(180deg, #f8fbfd 0%, #eef4f7 100%);
        }

        .report-shell {
          max-width: 1100px;
          margin: 0 auto;
        }

        .report-cover {
          background: linear-gradient(135deg, var(--primary-dark), var(--primary));
          color: var(--white);
          padding: 28px;
          border-radius: 18px;
          box-shadow: 0 12px 30px rgba(15, 58, 75, 0.18);
        }

        .report-cover-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .report-cover h1 {
          margin: 6px 0 8px;
          font-size: 30px;
          line-height: 1.05;
        }

        .report-cover .eyebrow {
          text-transform: uppercase;
          letter-spacing: 1.8px;
          font-size: 11px;
          opacity: 0.92;
          font-weight: 700;
        }

        .report-cover .meta {
          display: grid;
          gap: 8px;
          justify-items: end;
          text-align: right;
          color: rgba(255, 255, 255, 0.9);
          font-size: 13px;
        }

        .pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: var(--white);
        }

        .summary-title {
          margin: 22px 0 10px;
          font-size: 15px;
          font-weight: 800;
          color: var(--primary-dark);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .summary-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 14px 14px;
          margin-top: 2px;
        }

        .summary-table td {
          width: 50%;
          vertical-align: top;
          padding: 0;
        }

        .summary-strip-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 12px;
          margin-top: 0;
        }

        .summary-strip-table td {
          width: 33.333%;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.75);
          color: var(--muted);
          font-size: 12px;
          vertical-align: top;
        }

        .summary-strip-table strong {
          color: var(--text);
        }

        .summary-card {
          position: relative;
          background: var(--white);
          border: 1px solid var(--border);
          border-top: 5px solid var(--card-accent, var(--primary));
          border-radius: 14px;
          padding: 18px 16px 16px;
          min-height: 122px;
          box-shadow: 0 10px 24px rgba(19, 33, 43, 0.04);
        }

        .summary-card .label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }

        .summary-card .value {
          display: block;
          font-size: 22px;
          line-height: 1.05;
          font-weight: 900;
          color: var(--text);
          margin-bottom: 8px;
        }

        .summary-card .caption {
          font-size: 12px;
          line-height: 1.35;
          color: var(--muted);
        }

        .summary-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .summary-strip div {
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 12px;
          color: var(--muted);
        }

        .summary-strip strong {
          color: var(--text);
        }

        .analytics-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 16px;
        }

        .analytics-summary-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 14px 14px;
          margin-top: 16px;
        }

        .analytics-summary-table td {
          width: 50%;
          vertical-align: top;
          padding: 0;
        }

        .analytics-charts-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 14px;
        }

        .analytics-charts-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 14px 14px;
          margin-top: 14px;
        }

        .analytics-charts-table td {
          width: 50%;
          vertical-align: top;
          padding: 0;
        }

        .analytics-chart {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          background: linear-gradient(180deg, rgba(247, 250, 252, 0.98), rgba(255, 255, 255, 0.92));
        }

        .analytics-chart-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 12px;
        }

        .analytics-chart-title strong {
          font-size: 13px;
          color: var(--text);
        }

        .analytics-chart-title span {
          font-size: 11px;
          color: var(--muted);
        }

        .chart-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }

        .chart-table tr + tr td {
          padding-top: 10px;
        }

        .chart-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text);
          padding-right: 10px;
          width: 48%;
          vertical-align: middle;
        }

        .chart-value {
          font-size: 11px;
          color: var(--muted);
          text-align: right;
          white-space: nowrap;
          vertical-align: middle;
        }

        .chart-track-cell {
          padding: 0;
        }

        .chart-track-table {
          width: 100%;
          border-collapse: collapse;
          overflow: hidden;
          border-radius: 999px;
          background: #e7edf2;
          border: 1px solid var(--border);
        }

        .chart-track-table td {
          height: 12px;
          padding: 0;
        }

        .chart-fill.sales {
          background: linear-gradient(90deg, var(--primary), #2f89a8);
        }

        .chart-fill.expenses {
          background: linear-gradient(90deg, var(--accent), #ddb35c);
        }

        .chart-fill.product {
          background: linear-gradient(90deg, var(--success), #48b568);
        }

        .chart-fill-rest {
          background: transparent;
        }

        .report-section-analytics .empty-cell {
          margin-top: 12px;
          padding: 14px;
          border-radius: 10px;
          border: 1px dashed var(--border);
          color: var(--muted);
          background: rgba(255, 255, 255, 0.82);
          text-align: center;
        }

        .report-section {
          margin-top: 26px;
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(19, 33, 43, 0.04);
        }

        .section-head {
          padding: 18px 18px 14px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(90deg, rgba(21, 94, 117, 0.08), transparent 55%);
          position: relative;
        }

        .section-head::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 6px;
          background: var(--accent);
        }

        .section-head .section-kicker {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.4px;
          color: var(--accent);
          margin-bottom: 6px;
        }

        .section-head h2 {
          margin: 0;
          font-size: 20px;
          line-height: 1.2;
          color: var(--text);
        }

        .section-head p {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.4;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .report-table thead th {
          background: var(--primary);
          color: var(--white);
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 12px 12px;
          border-right: 1px solid rgba(255, 255, 255, 0.12);
        }

        .report-table tbody td {
          padding: 12px;
          border-top: 1px solid var(--border);
          border-right: 1px solid #edf2f7;
          vertical-align: top;
          font-size: 12px;
          line-height: 1.45;
          color: var(--text);
          word-break: break-word;
        }

        .report-table tbody tr:nth-child(even) td {
          background: var(--soft);
        }

        .report-table tbody td.is-bold {
          font-weight: 800;
        }

        .report-table tbody td.empty-cell {
          text-align: center;
          color: var(--muted);
          font-style: italic;
          padding: 24px 12px;
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          color: var(--white);
          background: var(--primary);
        }

        .badge.success { background: var(--success); }
        .badge.accent { background: var(--accent); }
        .badge.soft { background: var(--muted); }
        .badge.danger { background: var(--danger); }

        @media print {
          body { padding: 0; }
          .report-shell { max-width: none; }
          .report-section { break-inside: avoid; page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="report-shell">
        <section class="report-cover">
          <div class="report-cover-top">
            <div>
              <span class="eyebrow">Reporte Cuadre</span>
              <h1>${escapeHtml(payload.businessName)}</h1>
              <div class="pill-row">
                <span class="pill">Plan: ${escapeHtml(payload.planName)}</span>
                <span class="pill">Rango: ${escapeHtml(overview.rangeLabel)}</span>
              </div>
            </div>
            <div class="meta">
              <span>Generado</span>
              <strong>${escapeHtml(overview.generatedAt)}</strong>
            </div>
          </div>
          <p style="margin:0; max-width: 860px; color: rgba(255,255,255,0.9); line-height:1.5;">
            Un resumen claro de la operacion del periodo, con ventas, egresos, inventario y anulaciones
            para revisar el balance real del negocio sin perder el contexto.
          </p>
        </section>

        ${summaryCards}

        ${analyticsSection}

        ${sectionsHtml}
      </div>
    </body>
  </html>`
}

function summaryCardHtml(title: string, value: string, caption: string, tone: "primary" | "accent" | "success" | "danger" | "soft") {
  const accent =
    tone === "success"
      ? COLORS.success
      : tone === "danger"
      ? COLORS.danger
      : tone === "accent"
      ? COLORS.accent
      : tone === "soft"
      ? COLORS.muted
      : COLORS.primary

  return `
    <article class="summary-card" style="--card-accent:${accent}">
      <span class="label">${escapeHtml(title)}</span>
      <strong class="value">${escapeHtml(value)}</strong>
      <span class="caption">${escapeHtml(caption)}</span>
    </article>
  `
}

function analyticsSectionHtml(analytics: AnalyticsData) {
  const trendColor = COLORS.primary
  const trendAccent = COLORS.accent
  const productColor = COLORS.success
  const trackColor = "#e7edf2"

  const trendRows = analytics.trendPoints.length > 0
    ? analytics.trendPoints
        .map((point) => {
          const salesWidth = Math.max(8, (point.sales / analytics.maxTrendValue) * 100)
          const expensesWidth = Math.max(8, (point.expenses / analytics.maxTrendValue) * 100)

          return `
            <table class="chart-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;">
              <tbody>
                <tr>
                  <td class="chart-label">${escapeHtml(point.label)}</td>
                  <td class="chart-value">${escapeHtml(formatCurrency(point.net))}</td>
                </tr>
                <tr>
                  <td class="chart-track-cell" colspan="2">
                    <table class="chart-track-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;border-collapse:collapse;">
                      <tbody>
                        <tr>
                          <td
                            class="chart-fill sales"
                            width="${salesWidth.toFixed(2)}%"
                            bgcolor="${trendColor}"
                            style="background:${trendColor};height:12px;line-height:12px;font-size:1px;"
                          >&nbsp;</td>
                          <td
                            class="chart-fill-rest"
                            width="${Math.max(0, 100 - salesWidth).toFixed(2)}%"
                            bgcolor="${trackColor}"
                            style="background:${trackColor};height:12px;line-height:12px;font-size:1px;"
                          >&nbsp;</td>
                        </tr>
                        <tr>
                          <td
                            class="chart-fill expenses"
                            width="${expensesWidth.toFixed(2)}%"
                            bgcolor="${trendAccent}"
                            style="background:${trendAccent};height:12px;line-height:12px;font-size:1px;"
                          >&nbsp;</td>
                          <td
                            class="chart-fill-rest"
                            width="${Math.max(0, 100 - expensesWidth).toFixed(2)}%"
                            bgcolor="${trackColor}"
                            style="background:${trackColor};height:12px;line-height:12px;font-size:1px;"
                          >&nbsp;</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          `
        })
        .join("")
    : `<div class="empty-cell">Aun no hay movimientos para graficar.</div>`

  const productRows = analytics.productInsights.length > 0
    ? analytics.productInsights
        .slice(0, 6)
        .map((item) => {
          const width = Math.max(10, (item.quantity / analytics.maxProductQuantity) * 100)

          return `
            <table class="chart-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;">
              <tbody>
                <tr>
                  <td class="chart-label">${escapeHtml(item.name)}</td>
                  <td class="chart-value">${item.quantity} unidades</td>
                </tr>
                <tr>
                  <td class="chart-track-cell" colspan="2">
                    <table class="chart-track-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;border-collapse:collapse;">
                      <tbody>
                        <tr>
                          <td
                            class="chart-fill product"
                            width="${width.toFixed(2)}%"
                            bgcolor="${productColor}"
                            style="background:${productColor};height:12px;line-height:12px;font-size:1px;"
                          >&nbsp;</td>
                          <td
                            class="chart-fill-rest"
                            width="${Math.max(0, 100 - width).toFixed(2)}%"
                            bgcolor="${trackColor}"
                            style="background:${trackColor};height:12px;line-height:12px;font-size:1px;"
                          >&nbsp;</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          `
        })
        .join("")
    : `<div class="empty-cell">Aun no hay ventas para mostrar productos.</div>`

  return `
    <section class="report-section report-section-analytics">
      <div class="section-head" style="--accent:${COLORS.accent}">
        <div>
          <span class="section-kicker">Analitica avanzada</span>
          <h2>Estadisticas y graficos de productos</h2>
          <p>Disponible para planes Completo y Emprendedor. Resume el comportamiento del periodo con indicadores visuales.</p>
        </div>
      </div>
      <table class="analytics-summary-table" role="presentation">
        <tr>
          <td>${summaryCardHtml("Ticket promedio", formatCurrency(analytics.averageTicket), "Promedio por venta registrada.", "primary")}</td>
          <td>${summaryCardHtml("Dia mas fuerte", analytics.peakTrendDay?.label ?? "Sin datos", analytics.peakTrendDay ? `Neto ${formatCurrency(analytics.peakTrendDay.net)}` : "Aun no hay tendencia.", "success")}</td>
        </tr>
        <tr>
          <td>${summaryCardHtml("Producto lider", analytics.topProduct?.name ?? "Sin datos", analytics.topProduct ? `${analytics.topProduct.quantity} unidades` : "Aun no hay ventas.", "accent")}</td>
          <td>${summaryCardHtml("Balance neto", formatSignedCurrency(analytics.netResult), "Ventas menos egresos.", analytics.netResult >= 0 ? "success" : "danger")}</td>
        </tr>
      </table>
      <table class="analytics-charts-table" role="presentation">
        <tr>
          <td>
            <div class="analytics-chart" style="border:1px solid #d7e0e8;border-radius:14px;padding:14px;background:linear-gradient(180deg,#f7fafc,#ffffff);">
              <div class="analytics-chart-title">
                <strong>Tendencia por dia</strong>
                <span>Ventas y egresos del periodo</span>
              </div>
              ${trendRows}
            </div>
          </td>
          <td>
            <div class="analytics-chart" style="border:1px solid #d7e0e8;border-radius:14px;padding:14px;background:linear-gradient(180deg,#f7fafc,#ffffff);">
              <div class="analytics-chart-title">
                <strong>Productos con mayor salida</strong>
                <span>Top de unidades vendidas</span>
              </div>
              ${productRows}
            </div>
          </td>
        </tr>
      </table>
    </section>
  `
}

function buildReportOverview(payload: ReportExportPayload): ReportOverview {
  const salesTotal = payload.sales.reduce((sum, sale) => sum + sale.total, 0)
  const expensesTotal = payload.expenses.reduce((sum, expense) => sum + expense.valor, 0)
  const unitsSold = payload.sales.reduce(
    (count, sale) =>
      count + (sale.detalle_ventas ?? []).reduce((saleCount, detail) => saleCount + detail.cantidad, 0),
    0
  )

  return {
    salesTotal,
    expensesTotal,
    netResult: salesTotal - expensesTotal,
    unitsSold,
    salesCount: payload.sales.length,
    expensesCount: payload.expenses.length,
    voidedSalesCount: payload.voidedSales.length,
    voidedExpensesCount: payload.voidedExpenses.length,
    rangeLabel: getRangeLabel(payload.dateFrom, payload.dateTo),
    generatedAt: formatDateTime(new Date().toISOString())
  }
}

function buildAnalyticsData(payload: ReportExportPayload, overview: ReportOverview): AnalyticsData {
  const trendPoints = getReportTrendPoints(payload.sales, payload.expenses, payload.dateFrom, payload.dateTo)
  const productInsights = getProductInsights(payload.sales)
  const averageTicket = getAverageTicket(payload.sales)
  const peakTrendDay = trendPoints.reduce<ReportTrendPoint | null>(
    (best, current) => {
      if (!best) return current
      return current.net > best.net ? current : best
    },
    null
  )

  return {
    trendPoints,
    productInsights,
    averageTicket,
    peakTrendDay,
    topProduct: productInsights[0] ?? null,
    netResult: overview.netResult,
    maxTrendValue: Math.max(1, ...trendPoints.map((point) => Math.max(point.sales, point.expenses, Math.abs(point.net)))),
    maxProductQuantity: Math.max(1, ...productInsights.map((item) => item.quantity))
  }
}

function buildTableSpecs(payload: ReportExportPayload) {
  const specs: TableSpec[] = []

  if (payload.sections.includes("sales")) {
    specs.push({
      title: "Ventas",
      subtitle: "Historial del periodo con detalles clave y totales resaltados.",
      accent: COLORS.primary,
      headers: ["Folio", "Fecha", "Total", "Recibido", "Cambio", "Detalle"],
      widths: [76, 98, 84, 84, 82, 104],
      rows: payload.sales.length
        ? payload.sales.map((sale) => [
            saleLabel(sale.folio_diario, sale.fecha_dia),
            formatDateTime(sale.fecha),
            formatCurrency(sale.total),
            formatCurrency(sale.dinero_recibido),
            formatCurrency(sale.cambio),
            buildSaleSummary(sale.detalle_ventas ?? [])
          ])
        : [],
      boldColumns: [0, 2, 3, 4],
      emptyLabel: "Sin ventas registradas en el periodo."
    })
  }

  if (payload.sections.includes("expenses")) {
    specs.push({
      title: "Egresos",
      subtitle: "Gastos del periodo con descripcion y valor destacado.",
      accent: COLORS.accent,
      headers: ["Descripcion", "Fecha", "Valor", "Dia"],
      widths: [216, 110, 82, 120],
      rows: payload.expenses.length
        ? payload.expenses.map((expense) => [
            expense.descripcion,
            formatDateTime(expense.created_at),
            formatCurrency(expense.valor),
            formatReportDate(expense.fecha_dia)
          ])
        : [],
      boldColumns: [0, 2],
      emptyLabel: "Sin egresos registrados en el periodo."
    })
  }

  if (payload.sections.includes("inventory")) {
    specs.push({
      title: "Inventario",
      subtitle: "Productos e insumos con estado y stock actual.",
      accent: COLORS.success,
      headers: ["Nombre", "Tipo", "Stock", "Unidad", "Estado"],
      widths: [178, 78, 80, 84, 108],
      rows: payload.products.length
        ? payload.products.map((product) => [
            product.nombre,
            capitalizeWord(product.tipo_item),
            String(product.cantidad_stock),
            product.tipo_unidad,
            product.activo ? "Activo" : "Suspendido"
          ])
        : [],
      boldColumns: [0, 2, 4],
      emptyLabel: "Sin productos ni insumos registrados."
    })
  }

  if (payload.sections.includes("voided")) {
    const rows = [
      ...payload.voidedSales.map((sale) => [
        "Venta",
        saleLabel(sale.folio_diario, sale.fecha_dia),
        formatCurrency(sale.total),
        sale.eliminado_motivo ?? "Sin motivo",
        formatVoidedAt(sale.eliminado_at)
      ]),
      ...payload.voidedExpenses.map((expense) => [
        "Egreso",
        expense.descripcion,
        formatCurrency(expense.valor),
        expense.eliminado_motivo ?? "Sin motivo",
        formatVoidedAt(expense.eliminado_at)
      ])
    ]

    specs.push({
      title: "Anulaciones",
      subtitle: "Ventas y egresos anulados con trazabilidad del motivo.",
      accent: COLORS.danger,
      headers: ["Tipo", "Detalle", "Valor", "Motivo", "Fecha"],
      widths: [70, 190, 78, 110, 80],
      rows,
      boldColumns: [0, 2],
      emptyLabel: "Sin anulaciones registradas en el periodo."
    })
  }

  return specs
}

function renderSummaryPage(pages: PdfPage[], payload: ReportExportPayload, overview: ReportOverview) {
  const page = addPage(pages)
  drawRect(page, 0, 680, PDF.width, 112, COLORS.primaryDark)
  drawText(page, 42, 758, "Reporte Cuadre", 11, "F2", "#EAF4F8")
  drawText(page, 42, 736, payload.businessName, 26, "F2", COLORS.white)
  drawBadge(page, 42, 706, 112, 22, `Plan: ${payload.planName}`, COLORS.accent)
  drawBadge(page, 160, 706, 198, 22, `Rango: ${overview.rangeLabel}`, "#1E88A8")
  drawText(page, 424, 754, "Generado", 10, "F1", "#D9EAF1")
  drawText(page, 424, 736, overview.generatedAt, 12, "F2", COLORS.white)
  drawText(
    page,
    42,
    654,
    "Un resumen claro de la operacion del periodo, con las cifras principales resaltadas para lectura rapida.",
    11,
    "F1",
    COLORS.muted
  )

  drawText(page, 42, 620, "Resumen neto del periodo del informe", 15, "F2", COLORS.primaryDark)
  drawLine(page, 42, 610, PDF.width - 42, 610, COLORS.border, 1)

  const cardWidth = (PDF.width - PDF.marginX * 2 - PDF.gutter) / 2
  const cardHeight = 104
  const leftX = PDF.marginX
  const rightX = PDF.marginX + cardWidth + PDF.gutter
  const firstRowY = 570
  const secondRowY = 448

  drawSummaryCard(page, leftX, firstRowY, cardWidth, cardHeight, "Resultado neto", formatSignedCurrency(overview.netResult), "Ventas menos egresos del periodo.", overview.netResult >= 0 ? COLORS.success : COLORS.danger)
  drawSummaryCard(page, rightX, firstRowY, cardWidth, cardHeight, "Ventas filtradas", formatCurrency(overview.salesTotal), `${overview.salesCount} ventas registradas.`, COLORS.primary)
  drawSummaryCard(page, leftX, secondRowY, cardWidth, cardHeight, "Egresos filtrados", formatCurrency(overview.expensesTotal), `${overview.expensesCount} egresos registrados.`, COLORS.accent)
  drawSummaryCard(page, rightX, secondRowY, cardWidth, cardHeight, "Productos vendidos", String(overview.unitsSold), "Unidades contabilizadas en detalle.", COLORS.muted)

  drawRect(page, PDF.marginX, 292, PDF.width - PDF.marginX * 2, 44, COLORS.soft, COLORS.border)
  drawText(page, 58, 320, "Anulaciones", 12, "F2", COLORS.primaryDark)
  drawText(page, 166, 320, `${overview.voidedSalesCount} ventas y ${overview.voidedExpensesCount} egresos`, 12, "F1", COLORS.muted)
  drawText(page, 58, 304, "Las anulaciones se mantienen registradas y no afectan el balance activo.", 10, "F1", COLORS.muted)

  drawFooter(page, pages.length)
}

function renderAnalyticsPage(
  pages: PdfPage[],
  payload: ReportExportPayload,
  overview: ReportOverview,
  analytics: AnalyticsData
) {
  const page = addPage(pages)
  drawPageHeader(page, payload, overview, "Estadisticas avanzadas", "Lectura visual del periodo.", COLORS.accent)
  drawText(page, 42, 652, "Graficos y productos clave", 15, "F2", COLORS.primaryDark)
  drawText(page, 42, 632, "Disponible en los planes Completo y Emprendedor.", 10.5, "F1", COLORS.muted)

  const cardWidth = (PDF.width - PDF.marginX * 2 - PDF.gutter) / 2
  const cardHeight = 78
  const leftX = PDF.marginX
  const rightX = PDF.marginX + cardWidth + PDF.gutter
  const firstRowY = 596
  const secondRowY = 506

  drawAnalyticsCard(page, leftX, firstRowY, cardWidth, cardHeight, "Ticket promedio", formatCurrency(analytics.averageTicket), "Promedio por venta registrada.", COLORS.primary)
  drawAnalyticsCard(page, rightX, firstRowY, cardWidth, cardHeight, "Dia mas fuerte", analytics.peakTrendDay?.label ?? "Sin datos", analytics.peakTrendDay ? `Neto ${formatCurrency(analytics.peakTrendDay.net)}` : "Aun no hay tendencia.", COLORS.success)
  drawAnalyticsCard(page, leftX, secondRowY, cardWidth, cardHeight, "Producto lider", analytics.topProduct?.name ?? "Sin datos", analytics.topProduct ? `${analytics.topProduct.quantity} unidades` : "Aun no hay ventas.", COLORS.accent)
  drawAnalyticsCard(page, rightX, secondRowY, cardWidth, cardHeight, "Balance neto", formatSignedCurrency(analytics.netResult), "Ventas menos egresos.", analytics.netResult >= 0 ? COLORS.success : COLORS.danger)

  const chartWidth = (PDF.width - PDF.marginX * 2 - PDF.gutter) / 2
  const chartHeight = 250
  const chartTopY = 414
  drawAnalyticsChart(
    page,
    leftX,
    chartTopY,
    chartWidth,
    chartHeight,
    "Tendencia por dia",
    "Ventas y egresos del periodo",
    analytics.trendPoints.map((point) => ({
      label: point.label,
      value: Math.max(point.sales, point.expenses),
      sales: point.sales,
      expenses: point.expenses
    })),
    analytics.maxTrendValue,
    COLORS.primary,
    COLORS.accent,
    "trend"
  )
  drawAnalyticsChart(
    page,
    rightX,
    chartTopY,
    chartWidth,
    chartHeight,
    "Productos con mayor salida",
    "Top de unidades vendidas",
    analytics.productInsights.slice(0, 6).map((item) => ({
      label: item.name,
      value: item.quantity,
      quantity: item.quantity
    })),
    analytics.maxProductQuantity,
    COLORS.success,
    COLORS.muted,
    "products"
  )

  drawFooter(page, pages.length)
}

function renderEmptyReportPage(pages: PdfPage[], payload: ReportExportPayload, overview: ReportOverview) {
  const page = addPage(pages)
  drawPageHeader(page, payload, overview, "Resumen neto", "No hay secciones seleccionadas.", COLORS.accent)
  drawRect(page, PDF.marginX, 540, PDF.width - PDF.marginX * 2, 110, COLORS.soft, COLORS.border)
  drawText(page, 68, 602, "No hay secciones seleccionadas", 16, "F2", COLORS.primaryDark)
  drawText(page, 68, 580, "Activa al menos una seccion para generar el reporte en PDF.", 11, "F1", COLORS.muted)
  drawFooter(page, pages.length)
}

function renderTableSection(pages: PdfPage[], payload: ReportExportPayload, overview: ReportOverview, spec: TableSpec) {
  let rowIndex = 0
  let isContinuation = false

  if (spec.rows.length === 0) {
    const page = addPage(pages)
    drawPageHeader(page, payload, overview, spec.title, spec.subtitle, spec.accent)
    drawTableHeader(page, spec.headers, spec.widths, spec.accent)
    drawEmptyTableRow(page, spec.headers.length, spec.emptyLabel)
    drawFooter(page, pages.length)
    return
  }

  while (rowIndex < spec.rows.length) {
    const page = addPage(pages)
    drawPageHeader(
      page,
      payload,
      overview,
      isContinuation ? `${spec.title} (continuacion)` : spec.title,
      spec.subtitle,
      spec.accent
    )

    let cursorY = 648
    drawTableHeader(page, spec.headers, spec.widths, spec.accent, cursorY)
    cursorY -= 30

    while (rowIndex < spec.rows.length) {
      const row = spec.rows[rowIndex]
      const rowHeight = estimateRowHeight(row, spec.widths)

      if (cursorY - rowHeight < PDF.bottomMargin + 18) {
        break
      }

      drawTableRow(page, row, spec.widths, spec.boldColumns, rowIndex, cursorY, rowHeight)
      cursorY -= rowHeight
      rowIndex += 1
    }

    drawFooter(page, pages.length)
    isContinuation = true
  }
}

function drawPageHeader(
  page: PdfPage,
  payload: ReportExportPayload,
  overview: ReportOverview,
  title: string,
  subtitle: string,
  accent = COLORS.primary
) {
  drawRect(page, 0, 710, PDF.width, 82, COLORS.primaryDark)
  drawText(page, 42, 770, "Cuadre", 11, "F2", "#D8EEF4")
  drawText(page, 42, 748, payload.businessName, 20, "F2", COLORS.white)
  drawText(page, 42, 726, subtitle, 10.5, "F1", "#DCE7EC")
  drawBadge(page, 424, 756, 120, 20, overview.rangeLabel, accent)
  drawText(page, 42, 684, title, 18, "F2", COLORS.primaryDark)
}

function drawSummaryCard(
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  value: string,
  caption: string,
  accent: string
) {
  drawRect(page, x, y - height, width, height, COLORS.white, COLORS.border)
  drawRect(page, x, y - 5, width, 5, accent)
  drawText(page, x + 12, y - 24, title, 10.5, "F2", COLORS.muted)
  drawText(page, x + 12, y - 46, value, 21, "F2", COLORS.text)
  drawText(page, x + 12, y - 70, caption, 9.5, "F1", COLORS.muted)
}

function drawAnalyticsCard(
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  value: string,
  caption: string,
  accent: string
) {
  drawRect(page, x, y - height, width, height, COLORS.white, COLORS.border)
  drawRect(page, x, y - 4, width, 4, accent)
  drawText(page, x + 12, y - 20, title, 10, "F2", COLORS.muted)
  drawText(page, x + 12, y - 38, value, 15, "F2", COLORS.text)
  drawText(page, x + 12, y - 58, caption, 8.8, "F1", COLORS.muted)
}

function drawAnalyticsChart(
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  rows: Array<{
    label: string
    value: number
    sales?: number
    expenses?: number
    quantity?: number
  }>,
  maxValue: number,
  primaryColor: string,
  secondaryColor: string,
  mode: "trend" | "products"
) {
  drawRect(page, x, y - height, width, height, COLORS.white, COLORS.border)
  drawText(page, x + 12, y - 22, title, 11, "F2", COLORS.primaryDark)
  drawText(page, x + 12, y - 38, subtitle, 8.8, "F1", COLORS.muted)

  const legendY = y - 53
  drawRect(page, x + 12, legendY - 8, 8, 8, primaryColor, primaryColor)
  drawText(page, x + 24, legendY, mode === "trend" ? "Ventas" : "Unidades", 8.1, "F1", COLORS.muted)
  if (mode === "trend") {
    drawRect(page, x + 78, legendY - 8, 8, 8, secondaryColor, secondaryColor)
    drawText(page, x + 90, legendY, "Egresos", 8.1, "F1", COLORS.muted)
  }

  const contentTop = y - 76
  const rowGap = mode === "trend" ? 40 : 36
  const rowHeight = mode === "trend" ? 32 : 24
  const barAreaWidth = width - 40
  let cursorY = contentTop

  if (rows.length === 0) {
    drawText(page, x + 12, cursorY - 8, "Aun no hay datos para graficar.", 9.2, "F1", COLORS.muted)
    return
  }

  for (const row of rows.slice(0, 4)) {
    drawText(page, x + 12, cursorY + 3, row.label, 8.1, "F2", COLORS.text)
    const normalized = Math.max(0.08, row.value / Math.max(1, maxValue))
    const barWidth = Math.max(14, barAreaWidth * normalized)
    drawRect(page, x + 12, cursorY - 18, barAreaWidth, rowHeight, COLORS.soft, COLORS.border)

    if (mode === "trend") {
      const salesWidth = Math.max(8, barAreaWidth * Math.max(0.06, (row.sales ?? 0) / Math.max(1, maxValue)))
      const expensesWidth = Math.max(6, barAreaWidth * Math.max(0.04, (row.expenses ?? 0) / Math.max(1, maxValue)))
      drawText(page, x + width - 72, cursorY + 3, formatSignedCurrency((row.sales ?? 0) - (row.expenses ?? 0)), 7.8, "F2", COLORS.muted)
      drawRect(page, x + 12, cursorY - 14, salesWidth, 7, primaryColor)
      drawRect(page, x + 12, cursorY - 5, expensesWidth, 6, secondaryColor)
    } else {
      drawText(page, x + width - 66, cursorY + 3, `${row.quantity ?? row.value}`, 7.8, "F2", COLORS.white)
      drawRect(page, x + 12, cursorY - 13, barWidth, 10, primaryColor)
    }

    cursorY -= rowGap
  }
}

function drawTableHeader(page: PdfPage, headers: string[], widths: number[], accent: string, topY = 648) {
  const headerHeight = 28
  let x = PDF.marginX
  drawRect(page, PDF.marginX, topY - headerHeight, widths.reduce((sum, width) => sum + width, 0), headerHeight, accent)

  headers.forEach((header, index) => {
    drawText(page, x + 8, topY - 18, header, 9.2, "F2", COLORS.white)
    x += widths[index] ?? 0
  })
}

function drawTableRow(
  page: PdfPage,
  row: string[],
  widths: number[],
  boldColumns: number[],
  rowIndex: number,
  topY: number,
  rowHeight: number
) {
  const fill = rowIndex % 2 === 0 ? COLORS.white : COLORS.soft
  drawRect(page, PDF.marginX, topY - rowHeight, widths.reduce((sum, width) => sum + width, 0), rowHeight, fill, COLORS.border)

  let x = PDF.marginX
  row.forEach((cell, index) => {
    const width = widths[index] ?? 0
    const paddingX = 8
    const paddingTop = 11
    const fontSize = 9.5
    const lineHeight = 11.3
    const lines = wrapText(cell, estimateCharsForWidth(width - paddingX * 2, fontSize))
    const textTop = topY - paddingTop
    let textY = textTop

    for (const line of lines) {
      drawText(page, x + paddingX, textY, line, fontSize, boldColumns.includes(index) ? "F2" : "F1", COLORS.text)
      textY -= lineHeight
    }

    x += width
  })
}

function drawEmptyTableRow(page: PdfPage, columnCount: number, label: string) {
  const width = PDF.width - PDF.marginX * 2
  drawRect(page, PDF.marginX, 556, width, 52, COLORS.soft, COLORS.border)
  drawText(page, 68, 586, label, 11, "F1", COLORS.muted)
  if (columnCount > 1) {
    drawText(page, 68, 570, "El reporte mantiene la estructura para cuando existan registros.", 9.5, "F1", COLORS.muted)
  }
}

function drawFooter(page: PdfPage, pageNumber: number) {
  drawLine(page, PDF.marginX, 26, PDF.width - PDF.marginX, 26, COLORS.border, 1)
  drawText(page, PDF.marginX, 14, `Pagina ${pageNumber}`, 9, "F1", COLORS.muted)
}

function drawBadge(page: PdfPage, x: number, y: number, width: number, height: number, label: string, color: string) {
  drawRect(page, x, y - height, width, height, color, color)
  drawText(page, x + 10, y - 14, label, 9, "F2", COLORS.white)
}

function addPage(pages: PdfPage[]) {
  const page = { ops: [] as string[] }
  pages.push(page)
  return page
}

function assemblePdf(pages: PdfPage[]) {
  const objects: string[] = []
  const addObject = (content: string) => {
    objects.push(content)
    return objects.length
  }

  const fontRegularRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  const fontBoldRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
  const pageRefs: number[] = []

  for (const page of pages) {
    const content = page.ops.join("\n")
    const contentRef = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    const pageRef = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PDF.width} ${PDF.height}] /Resources << /Font << /F1 ${fontRegularRef} 0 R /F2 ${fontBoldRef} 0 R >> >> /Contents ${contentRef} 0 R >>`
    )
    pageRefs.push(pageRef)
  }

  const pagesRef = addObject(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`)
  const catalogRef = addObject(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`)
  const fixedObjects = objects.map((object) => object.replace("/Parent 0 0 R", `/Parent ${pagesRef} 0 R`))

  let pdf = "%PDF-1.4\n"
  const offsets = [0]

  fixedObjects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${fixedObjects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")
  pdf += `trailer\n<< /Size ${fixedObjects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: "application/pdf" })
}

function buildReportFileName(payload: ReportExportPayload, extension: string) {
  const safeBusiness = payload.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const range = payload.dateFrom && payload.dateTo ? `${payload.dateFrom}-${payload.dateTo}` : "historial"
  return `cuadre-${safeBusiness || "reporte"}-${range}.${extension}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildSaleSummary(details: SaleItem[]) {
  if (details.length === 0) return "Sin detalle"

  const names = details.slice(0, 2).map((detail) => detail.producto_nombre)
  const label = details.length === 1 ? "1 producto" : `${details.length} productos`
  const suffix = names.length > 0 ? `: ${names.join(", ")}${details.length > 2 ? "..." : ""}` : ""
  return `${label}${suffix}`
}

function formatReportDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-")
  if (!year || !month || !day) return dateKey
  return `${day}/${month}/${year}`
}

function formatVoidedAt(value: string | null) {
  if (!value) return "Sin fecha"
  return formatDateTime(value)
}

function formatSignedCurrency(value: number) {
  if (value < 0) return `-${formatCurrency(Math.abs(value))}`
  if (value > 0) return `+${formatCurrency(value)}`
  return formatCurrency(0)
}

function capitalizeWord(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function estimateRowHeight(row: string[], widths: number[]) {
  const fontSize = 9.5
  const lineHeight = 11.3
  const paddingY = 11
  const heights = row.map((cell, index) => {
    const maxChars = estimateCharsForWidth(widths[index] - 16, fontSize)
    const lines = wrapText(cell, maxChars)
    return lines.length * lineHeight + paddingY * 2 - 1
  })
  return Math.max(28, ...heights)
}

function estimateCharsForWidth(width: number, fontSize: number) {
  if (width <= 0) return 8
  return Math.max(8, Math.floor(width / (fontSize * 0.55)))
}

function wrapText(text: string, maxChars: number) {
  const wrapped: string[] = []

  for (const segment of String(text ?? "").split("\n")) {
    const trimmed = segment.trim()
    if (!trimmed) {
      wrapped.push("")
      continue
    }

    const words = trimmed.split(/\s+/)
    let current = ""

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word

      if (candidate.length <= maxChars) {
        current = candidate
        continue
      }

      if (current) {
        wrapped.push(current)
      }

      if (word.length > maxChars) {
        wrapped.push(...splitLongWord(word, maxChars))
        current = ""
      } else {
        current = word
      }
    }

    if (current) {
      wrapped.push(current)
    }
  }

  return wrapped.length > 0 ? wrapped : [""]
}

function splitLongWord(word: string, maxChars: number) {
  const parts: string[] = []
  let remaining = word

  while (remaining.length > maxChars) {
    parts.push(remaining.slice(0, maxChars))
    remaining = remaining.slice(maxChars)
  }

  if (remaining.length > 0) {
    parts.push(remaining)
  }

  return parts
}

function drawRect(
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  fill?: string,
  stroke?: string
) {
  page.ops.push("q")
  if (fill) page.ops.push(`${toPdfColor(fill)} rg`)
  if (stroke) page.ops.push(`${toPdfColor(stroke)} RG`)
  page.ops.push(`${x} ${y} ${width} ${height} re`)
  if (fill && stroke) page.ops.push("B")
  else if (fill) page.ops.push("f")
  else if (stroke) page.ops.push("S")
  page.ops.push("Q")
}

function drawLine(
  page: PdfPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width: number
) {
  page.ops.push("q")
  page.ops.push(`${width} w`)
  page.ops.push(`${toPdfColor(stroke)} RG`)
  page.ops.push(`${x1} ${y1} m`)
  page.ops.push(`${x2} ${y2} l`)
  page.ops.push("S")
  page.ops.push("Q")
}

function drawText(
  page: PdfPage,
  x: number,
  y: number,
  text: string,
  size: number,
  font: "F1" | "F2",
  color: string
) {
  page.ops.push("q")
  page.ops.push(`${toPdfColor(color)} rg`)
  page.ops.push(`/${font} ${size} Tf`)
  page.ops.push(`1 0 0 1 ${x} ${y} Tm`)
  page.ops.push(`(${escapePdfText(sanitizePdfText(text))}) Tj`)
  page.ops.push("Q")
}

function toPdfColor(hex: string) {
  const normalized = hex.replace("#", "")
  const value = normalized.length === 3 ? normalized.split("").map((part) => `${part}${part}`).join("") : normalized
  const red = Number.parseInt(value.slice(0, 2), 16) / 255
  const green = Number.parseInt(value.slice(2, 4), 16) / 255
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function sanitizePdfText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[·•]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
