import { formatCurrency, formatDateTime, saleLabel } from "@/lib/format"
import { getRangeLabel, type Metric } from "@/lib/dashboard/reports"
import type { Expense, Product, Sale, SaleItem } from "@/types/app"

export type ReportExportSection = "summary" | "sales" | "expenses" | "inventory" | "voided"

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
  const pages: PdfPage[] = []
  const specs = buildTableSpecs(payload)
  const includeSummary = payload.sections.includes("summary")

  if (includeSummary) {
    renderSummaryPage(pages, payload, overview)
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
  const specs = buildTableSpecs(payload)
  const includeSummary = payload.sections.includes("summary")

  const summaryCards = includeSummary
    ? `
      <section class="summary-grid">
        ${summaryCardHtml("Resultado neto", formatSignedCurrency(overview.netResult), "Ventas menos egresos", overview.netResult >= 0 ? "success" : "danger")}
        ${summaryCardHtml("Ventas filtradas", formatCurrency(overview.salesTotal), `${overview.salesCount} ventas registradas`, "primary")}
        ${summaryCardHtml("Egresos filtrados", formatCurrency(overview.expensesTotal), `${overview.expensesCount} registros`, "accent")}
        ${summaryCardHtml("Productos vendidos", String(overview.unitsSold), "Unidades en detalle", "soft")}
      </section>
      <section class="summary-strip">
        <div><strong>Ventana:</strong> ${escapeHtml(overview.rangeLabel)}</div>
        <div><strong>Anulaciones:</strong> ${overview.voidedSalesCount + overview.voidedExpensesCount}</div>
        <div><strong>Generado:</strong> ${escapeHtml(overview.generatedAt)}</div>
      </section>
    `
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

        ${
          includeSummary
            ? `
          <div class="summary-title">Resumen neto del periodo del informe</div>
          <section class="summary-grid">
            ${summaryCardHtml("Resultado neto", formatSignedCurrency(overview.netResult), "Ventas menos egresos del periodo.", overview.netResult >= 0 ? "success" : "danger")}
            ${summaryCardHtml("Ventas filtradas", formatCurrency(overview.salesTotal), `${overview.salesCount} ventas registradas.`, "primary")}
            ${summaryCardHtml("Egresos filtrados", formatCurrency(overview.expensesTotal), `${overview.expensesCount} egresos registrados.`, "accent")}
            ${summaryCardHtml("Productos vendidos", String(overview.unitsSold), "Unidades detalladas en el periodo.", "soft")}
          </section>
          <section class="summary-strip">
            <div><strong>Anulaciones:</strong> ${overview.voidedSalesCount + overview.voidedExpensesCount}</div>
            <div><strong>Ventas anuladas:</strong> ${overview.voidedSalesCount}</div>
            <div><strong>Egresos anulados:</strong> ${overview.voidedExpensesCount}</div>
          </section>
        `
            : ""
        }

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
    const maxLines = Math.max(1, lines.length)
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
  page.ops.push(`(${escapePdfText(text)}) Tj`)
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
