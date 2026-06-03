import { formatCurrency } from "@/lib/format"
import type { Expense, Product, Sale } from "@/types/app"

export type Metric = {
  label: string
  value: string
  caption: string
}

export type ReportPreset = "today" | "week" | "month" | "all" | "custom"

export function buildReportMetrics(
  sales: Sale[],
  expenses: Expense[],
  dateFrom: string,
  dateTo: string
): Metric[] {
  const salesTotal = sales.reduce((sum, sale) => sum + sale.total, 0)
  const expensesTotal = expenses.reduce((sum, expense) => sum + expense.valor, 0)
  const netResult = salesTotal - expensesTotal
  const units = sales.reduce(
    (count, sale) =>
      count + (sale.detalle_ventas ?? []).reduce((saleCount, detail) => saleCount + detail.cantidad, 0),
    0
  )

  return [
    { label: "Resultado neto", value: formatCurrency(netResult), caption: "ventas menos egresos" },
    { label: "Ventas filtradas", value: formatCurrency(salesTotal), caption: `${sales.length} ventas` },
    { label: "Egresos filtrados", value: formatCurrency(expensesTotal), caption: `${expenses.length} registros` },
    { label: "Productos vendidos", value: String(units), caption: "unidades en detalle" },
    { label: "Rango", value: getRangeLabel(dateFrom, dateTo), caption: "consulta activa" }
  ]
}

export function getTopProducts(sales: Sale[]) {
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
}

export function getInventorySnapshot(products: Product[]) {
  const inventoryItems = products.filter((product) => product.tipo_item === "inventario")
  const saleProducts = products.filter((product) => product.tipo_item === "producto")
  const inventoryTotal = inventoryItems.reduce((total, product) => total + product.cantidad_stock, 0)
  const suspendedProducts = products.filter((product) => !product.activo).length

  return { inventoryItems, saleProducts, inventoryTotal, suspendedProducts }
}

export function getPresetDateRange(
  preset: ReportPreset,
  options: {
    today: string
    lastSevenDays: string
    currentMonth: string
  }
) {
  if (preset === "today") return { dateFrom: options.today, dateTo: options.today }
  if (preset === "week") return { dateFrom: options.lastSevenDays, dateTo: options.today }
  if (preset === "month") return { dateFrom: `${options.currentMonth}-01`, dateTo: options.today }
  if (preset === "all") return { dateFrom: "", dateTo: "" }
  return null
}

export function getRangeLabel(dateFrom: string, dateTo: string) {
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
