"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import type { LucideIcon } from "lucide-react"
import { BarChart3, Boxes, LogOut, ShoppingCart } from "lucide-react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"
import { InventoryModule } from "@/components/dashboard/InventoryModule"
import { ReportsModule } from "@/components/dashboard/ReportsModule"
import { SalesModule } from "@/components/dashboard/SalesModule"

type ModuleKey = "inventario" | "ventas" | "reportes"

const modules: Array<{
  key: ModuleKey
  label: string
  icon: LucideIcon
}> = [
  { key: "inventario", label: "Inventario", icon: Boxes },
  { key: "ventas", label: "Ventas", icon: ShoppingCart },
  { key: "reportes", label: "Reportes", icon: BarChart3 }
]

export function DashboardShell() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeModule, setActiveModule] = useState<ModuleKey>("ventas")
  const [revision, setRevision] = useState(0)

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

      setSession(data.session)
      setLoading(false)
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        router.replace("/login")
        return
      }
      setSession(nextSession)
    })

    void loadSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  const title = useMemo(() => {
    if (activeModule === "inventario") return "Inventario"
    if (activeModule === "reportes") return "Reportes"
    return "Registro de venta"
  }, [activeModule])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  function refreshData() {
    setRevision((current) => current + 1)
  }

  if (loading) {
    return <main className="loading-screen">Cargando Isa Cream...</main>
  }

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/img/logo.jpeg" alt="Isa Cream" />
          <div>
            <strong>Isa Cream</strong>
            <span>{session?.user.email}</span>
          </div>
        </div>

        <nav className="tabs" aria-label="Modulos principales">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <button
                key={module.key}
                className={`tab-button ${activeModule === module.key ? "active" : ""}`}
                type="button"
                onClick={() => setActiveModule(module.key)}
              >
                <Icon size={19} />
                {module.label}
              </button>
            )
          })}
        </nav>

        <button className="button subtle" type="button" onClick={handleSignOut}>
          <LogOut size={18} />
          Salir
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>Operacion diaria para inventario, ventas y seguimiento de caja.</p>
          </div>
        </header>

        {activeModule === "inventario" && <InventoryModule onChanged={refreshData} />}
        {activeModule === "ventas" && (
          <SalesModule refreshSignal={revision} onSaleCompleted={refreshData} />
        )}
        {activeModule === "reportes" && <ReportsModule refreshSignal={revision} />}
      </section>
    </main>
  )
}
