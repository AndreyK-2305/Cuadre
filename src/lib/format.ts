export const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
})

export function formatCurrency(value: number) {
  return COP.format(Number.isFinite(value) ? value : 0)
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date(value))
}

export function formatDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

export function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatDateKey(date)
}

export function getCurrentMonthPrefix() {
  return formatDateKey().slice(0, 7)
}

export function saleLabel(folio: number, dateKey: string) {
  const [year, month, day] = dateKey.split("-")
  return `Venta ${folio} - ${day}/${month}/${year}`
}
