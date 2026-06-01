"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, BarChart3, Boxes, CalendarDays, LogOut, ShoppingCart } from "lucide-react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"
import { SalesModule } from "./SalesModule"
import { InventoryModule } from "./InventoryModule"
import { ReportsModule } from "./ReportsModule"

type ActiveModule = "ventas" | "inventario" | "reportes"

const modules: { id: ActiveModule; label: string; icon: typeof ShoppingCart }[] = [
  { id: "ventas", label: "Ventas", icon: ShoppingCart },
  { id: "inventario", label: "Inventario", icon: Boxes },
  { id: "reportes", label: "Reportes", icon: BarChart3 }
]

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#155e75",
  "accentWarm": "#d97706",
  "density": 1,
  "panelRadius": 16
}/*EDITMODE-END*/

export function DashboardShell() {
  const router = useRouter()
  const [activeModule, setActiveModule] = useState<ActiveModule>("ventas")
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      router.replace("/login")
      return
    }

    let mounted = true

    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      if (!data.session) {
        router.replace("/login")
        return
      }

      setLoading(false)
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        router.replace("/login")
        return
      }

      if (mounted) setLoading(false)
    })

    void loadSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    const { error } = await supabase.auth.signOut()

    if (error) {
      setIsSigningOut(false)
      window.alert("No se pudo cerrar la sesion. Intenta nuevamente.")
      return
    }

    router.replace("/login")
  }

  const handleDataChanged = useCallback(() => {
    setRefreshSignal((current) => current + 1)
  }, [])

  const title = useMemo(() => {
    if (activeModule === "inventario") return "Inventario"
    if (activeModule === "reportes") return "Reportes"
    return "Registro de venta"
  }, [activeModule])

  const subtitle = useMemo(() => {
    if (activeModule === "inventario") return "Controla existencias, ajustes y productos activos desde un solo lugar."
    if (activeModule === "reportes") return "Consulta ventas, caja y movimientos para tomar decisiones rapidas."
    return "Ventas rapidas, inventario visible y cierre de caja sin friccion."
  }, [activeModule])

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
    return <SalesModule refreshSignal={refreshSignal} onSaleCompleted={handleDataChanged} />
  }, [activeModule, handleDataChanged, refreshSignal])

  if (loading) {
    return <main className="loading-screen">Cargando Cuadre...</main>
  }

  return (
    <main className="dashboard" data-design-density={TWEAK_DEFAULTS.density}>
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
                onClick={() => setActiveModule(module.id)}
                aria-pressed={isActive}
              >
                <Icon size={19} />
                {module.label}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status" aria-label="Estado de sesion">
            <span className="sidebar-dot" aria-hidden="true" />
            <div>
              <strong>Sesion activa</strong>
              <small>Listo para vender</small>
            </div>
          </div>

          <button className="button subtle" type="button" onClick={handleSignOut} disabled={isSigningOut}>
            <LogOut size={18} />
            {isSigningOut ? "Saliendo..." : "Salir"}
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <div>
            <span className="topbar-eyebrow">Dashboard inicial</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="topbar-actions" aria-label="Estado operativo">
            <span className="status-pill">
              <BadgeCheck size={16} />
              Caja lista
            </span>
            <span className="date-pill">
              <CalendarDays size={16} />
              {todayLabel}
            </span>
          </div>
        </header>

        {activeContent}
      </section>
    </main>
  )
}
