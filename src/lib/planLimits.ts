import type { SubscriptionLevel } from "@/types/app"

export type ReportExportFormat = "pdf" | "excel"

export type PlanCapabilities = {
  productLimit: number | null
  employeeLimit: number | null
  reportHistoryDays: number | null
  reportTodayOnly: boolean
  exportFormats: ReportExportFormat[]
  advancedReportInsights: boolean
}

export const planCapabilities: Record<SubscriptionLevel, PlanCapabilities> = {
  Gratis: {
    productLimit: 10,
    employeeLimit: 0,
    reportHistoryDays: null,
    reportTodayOnly: true,
    exportFormats: [],
    advancedReportInsights: false
  },
  Basico: {
    productLimit: null,
    employeeLimit: 2,
    reportHistoryDays: 92,
    reportTodayOnly: false,
    exportFormats: ["pdf"],
    advancedReportInsights: false
  },
  Completo: {
    productLimit: null,
    employeeLimit: 5,
    reportHistoryDays: null,
    reportTodayOnly: false,
    exportFormats: ["pdf", "excel"],
    advancedReportInsights: true
  },
  Emprendedor: {
    productLimit: null,
    employeeLimit: null,
    reportHistoryDays: null,
    reportTodayOnly: false,
    exportFormats: ["pdf", "excel"],
    advancedReportInsights: true
  }
}

export function getPlanCapabilities(level: SubscriptionLevel | null | undefined): PlanCapabilities {
  return planCapabilities[level ?? "Basico"] ?? planCapabilities.Basico
}

export function getPlanDisplayName(level: SubscriptionLevel | null | undefined) {
  if (!level) return "Sin plan"
  return level === "Basico" ? "Basico" : level
}

export function getEmployeeLimitLabel(limit: number | null) {
  return limit === null ? "usuarios sin limite" : `${limit} usuario${limit === 1 ? "" : "s"}`
}

export function getProductLimitLabel(limit: number | null) {
  return limit === null ? "productos ilimitados" : `hasta ${limit} productos`
}

export function getReportHistoryLabel(capabilities: PlanCapabilities) {
  if (capabilities.reportTodayOnly) return "reportes del dia"
  if (capabilities.reportHistoryDays) return "historial hasta 3 meses"
  return "historial global"
}

export function getReportHistoryStartDate(todayKey: string, days: number | null) {
  if (!days) return ""

  const [year, month, day] = todayKey.split("-").map(Number)
  if (!year || !month || !day) return ""

  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - (days - 1))

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-")
}

export function clampReportRangeByPlan(options: {
  capabilities: PlanCapabilities
  today: string
  dateFrom: string
  dateTo: string
}) {
  const { capabilities, today } = options

  if (capabilities.reportTodayOnly) {
    return {
      dateFrom: today,
      dateTo: today,
      clamped: options.dateFrom !== today || options.dateTo !== today
    }
  }

  const minDate = getReportHistoryStartDate(today, capabilities.reportHistoryDays)

  if (!minDate) {
    return {
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      clamped: false
    }
  }

  const nextDateFrom = !options.dateFrom || options.dateFrom < minDate ? minDate : options.dateFrom
  const nextDateTo = options.dateTo || today

  return {
    dateFrom: nextDateFrom,
    dateTo: nextDateTo,
    clamped: nextDateFrom !== options.dateFrom || nextDateTo !== options.dateTo
  }
}
