"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Home, LogIn, ShieldCheck } from "lucide-react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"
import { fetchCurrentUserProfile } from "@/lib/data/restaurants"

type PasswordMode = "unknown" | "signin" | "setup"
type LoginPurpose = "operator" | "admin"

type LoginFormProps = {
  purpose?: LoginPurpose
}

export function LoginForm({ purpose = "operator" }: LoginFormProps) {
  const router = useRouter()
  const isAdminLogin = purpose === "admin"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordMode, setPasswordMode] = useState<PasswordMode>(isAdminLogin ? "signin" : "unknown")
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const routeAuthenticatedUser = useCallback(async () => {
    const { data: profile, error: profileError } = await fetchCurrentUserProfile()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      setCheckingSession(false)
      setError(isAdminLogin ? profileError?.message ?? "No se pudo validar el perfil de acceso." : "Correo no activado.")
      return
    }

    if (isAdminLogin) {
      if (profile.rol !== "SuperAdministrador") {
        await supabase.auth.signOut()
        setCheckingSession(false)
        setError("Este acceso es exclusivo para SuperAdministrador.")
        return
      }

      router.replace("/admin")
      return
    }

    if (profile.rol === "SuperAdministrador") {
      await supabase.auth.signOut()
      setCheckingSession(false)
      setError("Correo no activado.")
      return
    }

    if (!profile.activo) {
      await supabase.auth.signOut()
      setCheckingSession(false)
      setError("Correo no activado.")
      return
    }

    if (!profile.restaurante_id) {
      await supabase.auth.signOut()
      setCheckingSession(false)
      setError("Correo no activado.")
      return
    }

    router.replace("/dashboard")
  }, [isAdminLogin, router])

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      if (!isSupabaseConfigured) {
        setCheckingSession(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      if (data.session) {
        await routeAuthenticatedUser()
      } else {
        setCheckingSession(false)
      }
    }

    void checkSession()

    return () => {
      mounted = false
    }
  }, [routeAuthenticatedUser, router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")

    if (!isSupabaseConfigured) {
      setError("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.")
      return
    }

    if (passwordMode === "unknown") {
      await checkPasswordStatus()
      return
    }

    setLoading(true)

    if (passwordMode === "setup") {
      const response = await fetch("/api/auth/admin-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      })

      const body = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        setLoading(false)
        setError(body?.error ?? "No se pudo configurar la contrasena.")
        return
      }

      setNotice("Contrasena configurada. Abriendo el panel...")
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    await routeAuthenticatedUser()
  }

  function handleEmailChange(value: string) {
    setEmail(value)
    setPassword("")
    setPasswordMode(isAdminLogin ? "signin" : "unknown")
    setError("")
    setNotice("")
  }

  async function checkPasswordStatus() {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError("Ingresa tu correo autorizado.")
      return
    }

    setLoading(true)
    const response = await fetch(`/api/auth/admin-password?email=${encodeURIComponent(normalizedEmail)}`)
    const body = await response.json().catch(() => null) as { isAuthorized?: boolean; passwordPending?: boolean } | null
    setLoading(false)

    if (!body?.isAuthorized) {
      setPasswordMode("unknown")
      setError("Correo no activado.")
      return
    }

    setPasswordMode(body?.passwordPending ? "setup" : "signin")
    setNotice(body?.passwordPending ? "Crea tu contrasena para activar el acceso." : "")
  }

  if (checkingSession) {
    return <main className="loading-screen">Verificando sesion...</main>
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <img src="/img/cuadreapp.png" alt="Cuadre" />
          <div>
            <span className="login-eyebrow">{isAdminLogin ? "Panel administrador" : "Panel operativo"}</span>
            <h1>Cuadre</h1>
            <p>
              {isAdminLogin
                ? "Gestion central de emprendimientos, planes y reportes globales."
                : "Control de inventario, ventas y reportes para pequenos negocios."}
            </p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="alert">
            Falta configurar Supabase. Crea `.env.local` con las variables de `.env.example`.
          </div>
        )}

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-header login-card-note">
            <p>
              {isAdminLogin
                ? "Usa el correo SuperAdministrador para gestionar Cuadre."
                : "Usa el correo autorizado para abrir el panel de ventas y operacion."}
            </p>
          </div>

          <div className="field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => handleEmailChange(event.target.value)}
              placeholder="correo@tuemprendimiento.com"
              autoComplete="email"
              required
            />
          </div>

          {passwordMode !== "unknown" && (
            <div className="field">
              <label htmlFor="password">{passwordMode === "setup" ? "Crear contrasena" : "Contrasena"}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={passwordMode === "setup" ? "Minimo 6 caracteres" : "Tu contrasena"}
                autoComplete={passwordMode === "setup" ? "new-password" : "current-password"}
                required
                minLength={passwordMode === "setup" ? 6 : undefined}
              />
            </div>
          )}

          {error && <div className="alert">{error}</div>}
          {notice && <div className="notice">{notice}</div>}

          <button className="button primary" type="submit" disabled={loading}>
            {loading ? <ShieldCheck size={18} /> : <LogIn size={18} />}
            {loading ? "Procesando..." : getSubmitLabel(passwordMode)}
          </button>

          <Link className="button subtle login-home-link" href="/home">
            <Home size={18} aria-hidden="true" />
            Ir a inicio
          </Link>
        </form>
      </section>
    </main>
  )
}

function getSubmitLabel(passwordMode: PasswordMode) {
  if (passwordMode === "unknown") return "Continuar"
  if (passwordMode === "setup") return "Crear contrasena y entrar"
  return "Entrar"
}
