import { formatCurrency, formatDateTime, saleLabel } from "@/lib/format"
import { getRangeLabel, type Metric } from "@/lib/dashboard/reports"
import type { Expense, Product, Sale } from "@/types/app"

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

export function downloadReportAsPdf(payload: ReportExportPayload) {
  const lines = buildReportLines(payload)
  downloadBlob(buildPdfBlob(lines), buildReportFileName(payload, "pdf"))
}

export function downloadReportAsExcel(payload: ReportExportPayload) {
  const html = buildExcelHtml(payload)
  downloadBlob(
    new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }),
    buildReportFileName(payload, "xls")
  )
}

function buildReportLines(payload: ReportExportPayload) {
  const lines = [
    `Reporte Cuadre - ${payload.businessName}`,
    `Plan: ${payload.planName}`,
    `Rango: ${getRangeLabel(payload.dateFrom, payload.dateTo)}`,
    `Generado: ${formatDateTime(new Date().toISOString())}`,
    ""
  ]

  if (payload.sections.includes("summary")) {
    lines.push("Resumen")
    for (const metric of payload.metrics) {
      lines.push(`${metric.label}: ${metric.value} (${metric.caption})`)
    }
    lines.push("")
  }

  if (payload.sections.includes("sales")) {
    lines.push("Ventas")
    if (payload.sales.length === 0) lines.push("Sin ventas registradas.")
    for (const sale of payload.sales) {
      lines.push(`${saleLabel(sale.folio_diario, sale.fecha_dia)} - ${formatCurrency(sale.total)} - ${formatDateTime(sale.fecha)}`)
      for (const detail of sale.detalle_ventas ?? []) {
        lines.push(`  ${detail.cantidad} x ${detail.producto_nombre} - ${formatCurrency(detail.subtotal)}`)
      }
    }
    lines.push("")
  }

  if (payload.sections.includes("expenses")) {
    lines.push("Egresos")
    if (payload.expenses.length === 0) lines.push("Sin egresos registrados.")
    for (const expense of payload.expenses) {
      lines.push(`${expense.descripcion} - ${formatCurrency(expense.valor)} - ${formatDateTime(expense.created_at)}`)
    }
    lines.push("")
  }

  if (payload.sections.includes("inventory")) {
    lines.push("Inventario")
    if (payload.products.length === 0) lines.push("Sin productos registrados.")
    for (const product of payload.products) {
      lines.push(`${product.nombre} - ${product.tipo_item} - ${product.cantidad_stock} ${product.tipo_unidad} - ${product.activo ? "Activo" : "Suspendido"}`)
    }
    lines.push("")
  }

  if (payload.sections.includes("voided")) {
    lines.push("Anulaciones")
    if (payload.voidedSales.length === 0 && payload.voidedExpenses.length === 0) {
      lines.push("Sin anulaciones registradas.")
    }
    for (const sale of payload.voidedSales) {
      lines.push(`${saleLabel(sale.folio_diario, sale.fecha_dia)} anulada - ${formatCurrency(sale.total)} - ${sale.eliminado_motivo ?? "Sin motivo"}`)
    }
    for (const expense of payload.voidedExpenses) {
      lines.push(`${expense.descripcion} anulado - ${formatCurrency(expense.valor)} - ${expense.eliminado_motivo ?? "Sin motivo"}`)
    }
  }

  return lines
}

function buildExcelHtml(payload: ReportExportPayload) {
  const tables = [
    `<h1>Reporte Cuadre - ${escapeHtml(payload.businessName)}</h1>`,
    `<p><strong>Plan:</strong> ${escapeHtml(payload.planName)}</p>`,
    `<p><strong>Rango:</strong> ${escapeHtml(getRangeLabel(payload.dateFrom, payload.dateTo))}</p>`
  ]

  if (payload.sections.includes("summary")) {
    tables.push(tableHtml("Resumen", ["Metrica", "Valor", "Detalle"], payload.metrics.map((metric) => [
      metric.label,
      metric.value,
      metric.caption
    ])))
  }

  if (payload.sections.includes("sales")) {
    tables.push(tableHtml("Ventas", ["Folio", "Fecha", "Total", "Recibido", "Cambio"], payload.sales.map((sale) => [
      saleLabel(sale.folio_diario, sale.fecha_dia),
      formatDateTime(sale.fecha),
      formatCurrency(sale.total),
      formatCurrency(sale.dinero_recibido),
      formatCurrency(sale.cambio)
    ])))
  }

  if (payload.sections.includes("expenses")) {
    tables.push(tableHtml("Egresos", ["Descripcion", "Fecha", "Valor"], payload.expenses.map((expense) => [
      expense.descripcion,
      formatDateTime(expense.created_at),
      formatCurrency(expense.valor)
    ])))
  }

  if (payload.sections.includes("inventory")) {
    tables.push(tableHtml("Inventario", ["Nombre", "Tipo", "Stock", "Unidad", "Estado"], payload.products.map((product) => [
      product.nombre,
      product.tipo_item,
      String(product.cantidad_stock),
      product.tipo_unidad,
      product.activo ? "Activo" : "Suspendido"
    ])))
  }

  if (payload.sections.includes("voided")) {
    const rows = [
      ...payload.voidedSales.map((sale) => [
        "Venta",
        saleLabel(sale.folio_diario, sale.fecha_dia),
        formatCurrency(sale.total),
        sale.eliminado_motivo ?? "Sin motivo"
      ]),
      ...payload.voidedExpenses.map((expense) => [
        "Egreso",
        expense.descripcion,
        formatCurrency(expense.valor),
        expense.eliminado_motivo ?? "Sin motivo"
      ])
    ]
    tables.push(tableHtml("Anulaciones", ["Tipo", "Detalle", "Valor", "Motivo"], rows))
  }

  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${tables.join("\n")}</body></html>`
}

function tableHtml(title: string, headers: string[], rows: string[][]) {
  const bodyRows = rows.length > 0 ? rows : [["Sin registros"]]

  return `
    <h2>${escapeHtml(title)}</h2>
    <table border="1" cellspacing="0" cellpadding="6">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `
}

function buildPdfBlob(lines: string[]) {
  const pages = chunk(lines, 42)
  const objects: string[] = []
  const addObject = (content: string) => {
    objects.push(content)
    return objects.length
  }
  const pageRefs: number[] = []
  const fontRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      "14 TL",
      ...pageLines.map((line) => `(${escapePdfText(line.slice(0, 105))}) Tj T*`),
      "ET"
    ].join("\n")
    const contentRef = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    const pageRef = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`)
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

function buildReportFileName(payload: ReportExportPayload, extension: string) {
  const safeBusiness = payload.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const range = payload.dateFrom && payload.dateTo ? `${payload.dateFrom}-${payload.dateTo}` : "historial"
  return `cuadre-${safeBusiness || "reporte"}-${range}.${extension}`
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks.length > 0 ? chunks : [[]]
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
