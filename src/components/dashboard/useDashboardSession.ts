"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"

export function useDashboardSession() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [sessionEmail, setSessionEmail] = useState("")
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

      setSessionEmail(data.session.user.email ?? "Cuenta autenticada")
      setLoading(false)
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        setSessionEmail("")
        router.replace("/login")
        return
      }

      if (mounted) {
        setSessionEmail(nextSession.user.email ?? "Cuenta autenticada")
        setLoading(false)
      }
    })

    void loadSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    const { error } = await supabase.auth.signOut()

    if (error) {
      setIsSigningOut(false)
      window.alert("No se pudo cerrar la sesion. Intenta nuevamente.")
      return
    }

    router.replace("/login")
  }, [isSigningOut, router])

  const sessionLabel = useMemo(() => sessionEmail || "Cuenta autenticada", [sessionEmail])

  return {
    handleSignOut,
    isSigningOut,
    loading,
    sessionEmail,
    sessionLabel
  }
}
