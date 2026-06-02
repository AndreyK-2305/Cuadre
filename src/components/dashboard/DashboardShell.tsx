"use client"

import { useCallback, useMemo, useState } from "react"
import { BadgeCheck, BarChart3, Boxes, CalendarDays, ChevronDown, LogOut, ShoppingCart, UserRound } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { SalesModule } from "./SalesModule"
import { InventoryModule } from "./InventoryModule"
import { ReportsModule } from "./ReportsModule"
import { useDashboardSession } from "./useDashboardSession"
import type { MobileCartState } from "@/types/app"

type ActiveModule = "ventas" | "inventario" | "reportes"

const modules: { id: ActiveModule; label: string; icon: typeof ShoppingCart }[] = [
  { id: "ventas", label: "Ventas", icon: ShoppingCart },
  { id: "inventario", label: "Inventario", icon: Boxes },
  { id: "reportes", label: "Reportes", icon: BarChart3 }
]

export function DashboardShell() {
  const { handleSignOut, isSigningOut, loading, sessionLabel } = useDashboardSession()
  const [activeModule, setActiveModule] = useState<ActiveModule>("ventas")
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [mobileCartState, setMobileCartState] = useState<MobileCartState>({
    quantity: 0,
    total: 0,
    hasItems: false
  })
  const [cartOpenSignal, setCartOpenSignal] = useState(0)

  const handleDataChanged = useCallback(() => {
    setRefreshSignal((current) => current + 1)
  }, [])

  const showModule = (moduleId: ActiveModule) => {
    setSessionMenuOpen(false)
    setActiveModule(moduleId)
  }

  const activeModuleConfig = useMemo(
    () => modules.find((module) => module.id === activeModule) ?? modules[0],
    [activeModule]
  )

  const activeDescription = useMemo(() => {
    if (activeModule === "inventario") return "Existencias, ajustes y productos activos en una vista operativa."
    if (activeModule === "reportes") return "Ventas, caja y movimientos listos para consulta rapida."
    return "Cobro rapido con catalogo visible y resumen de caja persistente."
  }, [activeModule])

  const ActiveModuleIcon = activeModuleConfig.icon

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "short"
      }).format(new Date()),
    []
  )

  const activeContent = useMemo(() => {
    if (activeModule === "inventario") return <InventoryModule onChanged={handleDataChanged} />
    if (activeModule === "reportes") return <ReportsModule refreshSignal={refreshSignal} />
    return (
      <SalesModule
        refreshSignal={refreshSignal}
        cartOpenSignal={cartOpenSignal}
        onCartStateChange={setMobileCartState}
        onSaleCompleted={handleDataChanged}
      />
    )
  }, [activeModule, cartOpenSignal, handleDataChanged, refreshSignal])

  const openMobileCart = () => {
    setSessionMenuOpen(false)
    if (!mobileCartState.hasItems) return
    setCartOpenSignal((current) => current + 1)
  }

  const sessionPopover = (
    <div className="session-popover" role="dialog" aria-label="Datos de sesion">
      <div className="session-popover-heading">
        <span className="session-popover-icon" aria-hidden="true">
          <UserRound size={16} />
        </span>
        <div>
          <strong>Sesion iniciada</strong>
          <small>Cuenta actual</small>
        </div>
      </div>
      <p className="session-email" title={sessionLabel}>{sessionLabel}</p>
      <button className="button session-signout" type="button" onClick={handleSignOut} disabled={isSigningOut}>
        <LogOut size={17} aria-hidden="true" />
        {isSigningOut ? "Cerrando sesion..." : "Cerrar sesion"}
      </button>
    </div>
  )

  if (loading) {
    return <main className="loading-screen">Cargando Cuadre...</main>
  }

  return (
    <main className="dashboard">
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <div>
            <strong>Cuadre</strong>
            <small>Operaciones comerciales</small>
          </div>
        </div>

        <nav className="nav-list" aria-label="Modulos">
          {modules.map((module) => {
            const Icon = module.icon
            const isActive = activeModule === module.id

            return (
              <button
                key={module.id}
                type="button"
                className={isActive ? "nav-item active" : "nav-item"}
                onClick={() => showModule(module.id)}
                aria-pressed={isActive}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{module.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status" aria-label="Sesion activa">
            <button
              className="sidebar-status session-trigger"
              type="button"
              onClick={() => setSessionMenuOpen((current) => !current)}
              aria-expanded={sessionMenuOpen}
              aria-haspopup="dialog"
            >
              <span className="sidebar-dot" aria-hidden="true" />
              <div>
                <strong>Sesion activa</strong>
                <span className="sidebar-session-label">Conectado como</span>
                <small title={sessionLabel}>{sessionLabel}</small>
              </div>
              <ChevronDown className="session-trigger-chevron" size={16} aria-hidden="true" />
            </button>
            {sessionMenuOpen && sessionPopover}
          </div>

          <button className="button sidebar-logout" type="button" onClick={handleSignOut} disabled={isSigningOut}>
            <LogOut size={17} aria-hidden="true" />
            {isSigningOut ? "Cerrando sesion..." : "Cerrar sesion"}
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <div className="mobile-command-bar" aria-label="Acciones rapidas moviles">
          <div className="session-menu-container mobile-session-menu">
            <button
              className="mobile-session-chip session-trigger"
              type="button"
              onClick={() => setSessionMenuOpen((current) => !current)}
              aria-expanded={sessionMenuOpen}
              aria-haspopup="dialog"
            >
              <span className="sidebar-dot" aria-hidden="true" />
              <div>
                <strong>Sesion iniciada</strong>
                <small title={sessionLabel}>{sessionLabel}</small>
              </div>
              <ChevronDown className="session-trigger-chevron" size={15} aria-hidden="true" />
            </button>
            {sessionMenuOpen && sessionPopover}
          </div>

          {activeModule === "ventas" && (
            <button
              className="button mobile-cart-button"
              type="button"
              onClick={openMobileCart}
              disabled={!mobileCartState.hasItems}
              aria-label={`Abrir carrito con ${mobileCartState.quantity} unidades`}
            >
              <ShoppingCart size={18} aria-hidden="true" />
              <span>{mobileCartState.quantity}</span>
              <strong>{formatCurrency(mobileCartState.total)}</strong>
            </button>
          )}
        </div>

        <header className="topbar" aria-label="Contexto del dashboard">
          <div className="topbar-context">
            <span className="topbar-eyebrow">Seccion activa</span>
            <div className="topbar-module-pill" aria-live="polite">
              <ActiveModuleIcon size={18} aria-hidden="true" />
              <strong>{activeModuleConfig.label}</strong>
            </div>
            <p>{activeDescription}</p>
          </div>

          <div className="topbar-actions" aria-label="Estado operativo">
            <span className="status-pill">
              <BadgeCheck size={16} aria-hidden="true" />
              Caja lista
            </span>
            <span className="date-pill">
              <CalendarDays size={16} aria-hidden="true" />
              {todayLabel}
            </span>
          </div>
        </header>

        {activeContent}
      </section>

      <nav className="mobile-tabbar" aria-label="Modulos principales">
        {modules.map((module) => {
          const Icon = module.icon
          const isActive = activeModule === module.id

          return (
            <button
              key={module.id}
              type="button"
              className={isActive ? "mobile-tabbar-item active" : "mobile-tabbar-item"}
              onClick={() => showModule(module.id)}
              aria-pressed={isActive}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{module.label}</span>
            </button>
          )
        })}
      </nav>
    </main>
  )
}
