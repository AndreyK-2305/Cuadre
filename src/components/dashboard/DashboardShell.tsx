"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronDown,
  LogOut,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  UserRound
} from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { SalesModule } from "./SalesModule"
import { InventoryModule } from "./InventoryModule"
import { ReportsModule } from "./ReportsModule"
import { ExpensesModule } from "./ExpensesModule"
import { useDashboardSession } from "./useDashboardSession"
import type { MobileCartState } from "@/types/app"

type ActiveModule = "ventas" | "inventario" | "egresos" | "reportes" | "admin"

const operatorModules: { id: ActiveModule; label: string; icon: typeof ShoppingCart }[] = [
  { id: "ventas", label: "Ventas", icon: ShoppingCart },
  { id: "inventario", label: "Inventario", icon: Boxes },
  { id: "egresos", label: "Egresos", icon: ReceiptText },
  { id: "reportes", label: "Reportes", icon: BarChart3 }
]

const superAdminModules: { id: ActiveModule; label: string; icon: typeof ShoppingCart }[] = [
  { id: "reportes", label: "Reportes", icon: BarChart3 },
  { id: "admin", label: "Admin", icon: Settings2 }
]

export function DashboardShell() {
  const {
    businessName,
    canAccessAdmin,
    handleSignOut,
    isSigningOut,
    loading,
    profile,
    profileError,
    restaurantId,
    sessionLabel
  } = useDashboardSession()
  const [activeModule, setActiveModule] = useState<ActiveModule>("ventas")
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [mobileCartState, setMobileCartState] = useState<MobileCartState>({
    quantity: 0,
    total: 0,
    hasItems: false
  })
  const [cartOpenSignal, setCartOpenSignal] = useState(0)

  const modules = useMemo(() => (canAccessAdmin ? superAdminModules : operatorModules), [canAccessAdmin])

  useEffect(() => {
    const hasActiveModule = modules.some((module) => module.id === activeModule)

    if (!hasActiveModule) {
      setActiveModule(modules[0].id)
    }
  }, [activeModule, modules])

  const handleDataChanged = useCallback(() => {
    setRefreshSignal((current) => current + 1)
  }, [])

  const showModule = (moduleId: ActiveModule) => {
    setSessionMenuOpen(false)
    setActiveModule(moduleId)
  }

  const activeModuleConfig = useMemo(
    () => modules.find((module) => module.id === activeModule) ?? modules[0],
    [activeModule, modules]
  )

  const activeDescription = useMemo(() => {
    if (canAccessAdmin && !modules.some((module) => module.id === activeModule)) {
      return "Lectura global de ventas, caja y operaciones de los emprendimientos."
    }
    if (activeModule === "admin") return "Configuracion comercial, accesos y emprendimientos suscritos."
    if (activeModule === "inventario") return "Existencias, ajustes y productos activos en una vista operativa."
    if (activeModule === "egresos") return "Gastos diarios listos para descontar del resultado de caja."
    if (activeModule === "reportes") return canAccessAdmin ? "Lectura global de ventas, caja y operaciones de los emprendimientos." : "Ventas, caja y movimientos listos para consulta rapida."
    return "Cobro rapido con catalogo visible y resumen de caja persistente."
  }, [activeModule, canAccessAdmin, modules])

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
    if (canAccessAdmin && !modules.some((module) => module.id === activeModule)) {
      return <ReportsModule refreshSignal={refreshSignal} isGlobal />
    }

    if (!restaurantId && profile?.rol !== "SuperAdministrador") {
      return (
        <section className="panel empty-state">
          Este usuario aun no tiene un emprendimiento asignado. Un SuperAdministrador debe asociarlo desde /admin.
        </section>
      )
    }

    if (activeModule === "admin") {
      return (
        <section className="panel admin-dashboard-cta">
          <ShieldCheck size={28} aria-hidden="true" />
          <div>
            <h2>Administracion de Cuadre</h2>
            <p>Gestiona emprendimientos, correos administradores, planes y accesos desde el panel central.</p>
          </div>
          <a className="button primary" href="/admin">
            Abrir panel administrador
          </a>
        </section>
      )
    }
    if (activeModule === "inventario") return <InventoryModule restaurantId={restaurantId} onChanged={handleDataChanged} />
    if (activeModule === "egresos") {
      return <ExpensesModule restaurantId={restaurantId} refreshSignal={refreshSignal} onChanged={handleDataChanged} />
    }
    if (activeModule === "reportes") return <ReportsModule refreshSignal={refreshSignal} isGlobal={canAccessAdmin} />
    return (
      <SalesModule
        restaurantId={restaurantId}
        refreshSignal={refreshSignal}
        cartOpenSignal={cartOpenSignal}
        onCartStateChange={setMobileCartState}
        onSaleCompleted={handleDataChanged}
      />
    )
  }, [activeModule, canAccessAdmin, cartOpenSignal, handleDataChanged, modules, profile?.rol, refreshSignal, restaurantId])

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

  if (profileError) {
    return <main className="loading-screen">No se pudo cargar el perfil: {profileError}</main>
  }

  return (
    <main className="dashboard">
      <aside className="sidebar" aria-label="Navegacion principal">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <div>
            <strong>{businessName}</strong>
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
          {canAccessAdmin && (
            <a className="button subtle sidebar-admin-link" href="/admin">
              <ShieldCheck size={17} aria-hidden="true" />
              Panel admin
            </a>
          )}

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
                <strong>{businessName}</strong>
                <span className="sidebar-session-label">Cuenta</span>
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
                <strong>{businessName}</strong>
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
              {canAccessAdmin ? "Vista global" : "Caja lista"}
            </span>
            <span className="date-pill">
              <CalendarDays size={16} aria-hidden="true" />
              {todayLabel}
            </span>
          </div>
        </header>

        {activeContent}
      </section>

      <nav className={canAccessAdmin ? "mobile-tabbar admin-mobile-tabbar" : "mobile-tabbar"} aria-label="Modulos principales">
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
