"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IceCreamBowl, LogIn } from "lucide-react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState("")

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
        router.replace("/dashboard")
      } else {
        setCheckingSession(false)
      }
    }

    void checkSession()

    return () => {
      mounted = false
    }
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!isSupabaseConfigured) {
      setError(
        "Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local."
      )
      return
    }

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.replace("/dashboard")
  }

  if (checkingSession) {
    return <main className="loading-screen">Verificando sesion...</main>
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <img src="/img/logo.jpeg" alt="Isa Cream" />
          <div>
            <h1>Isa Cream</h1>
            <p>Control de inventario, ventas y reportes diarios.</p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="alert">
            Falta configurar Supabase. Crea `.env.local` con las variables de `.env.example`.
          </div>
        )}

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@isacream.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="alert">{error}</div>}

          <button className="button primary" type="submit" disabled={loading}>
            {loading ? <IceCreamBowl size={18} /> : <LogIn size={18} />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  )
}
