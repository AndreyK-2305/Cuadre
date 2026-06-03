"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client"
import { fetchCurrentUserProfile } from "@/lib/data/restaurants"
import type { UserProfile } from "@/types/app"

type DashboardSessionOptions = {
  allowUnauthenticated?: boolean
  loginPath?: string
}

export function useDashboardSession(options: DashboardSessionOptions = {}) {
  const { allowUnauthenticated = false, loginPath = "/login" } = options
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sessionEmail, setSessionEmail] = useState("")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileError, setProfileError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
      if (!isSupabaseConfigured) {
        if (allowUnauthenticated) {
          setLoading(false)
        } else {
          router.replace(loginPath)
        }
        return
      }

    let mounted = true

    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      if (!data.session) {
        setIsAuthenticated(false)
        if (allowUnauthenticated) {
          setLoading(false)
        } else {
          router.replace(loginPath)
        }
        return
      }

      setIsAuthenticated(true)
      setSessionEmail(data.session.user.email ?? "Cuenta autenticada")

      const { data: profileData, error } = await fetchCurrentUserProfile()
      if (!mounted) return

      if (error) {
        setProfileError(error.message)
        setLoading(false)
        return
      }

      setProfile(normalizeProfile(profileData))
      setLoading(false)
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        setSessionEmail("")
        setIsAuthenticated(false)
        setProfile(null)
        if (allowUnauthenticated) {
          setLoading(false)
        } else {
          router.replace(loginPath)
        }
        return
      }

      if (mounted) {
        setIsAuthenticated(true)
        setSessionEmail(nextSession.user.email ?? "Cuenta autenticada")
        void loadSession()
      }
    })

    void loadSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [allowUnauthenticated, loginPath, router])

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
  const businessName = profile?.restaurante?.nombre ?? (profile?.rol === "SuperAdministrador" ? "Todos los emprendimientos" : "Negocio sin asignar")
  const restaurantId = profile?.restaurante_id ?? ""
  const canAccessAdmin = profile?.rol === "SuperAdministrador"

  return {
    businessName,
    canAccessAdmin,
    handleSignOut,
    isAuthenticated,
    isSigningOut,
    loading,
    profile,
    profileError,
    restaurantId,
    sessionEmail,
    sessionLabel
  }
}

function normalizeProfile(data: unknown): UserProfile {
  const profile = data as UserProfile & { restaurante?: UserProfile["restaurante"] | UserProfile["restaurante"][] }
  return {
    ...profile,
    restaurante: Array.isArray(profile.restaurante) ? profile.restaurante[0] ?? null : profile.restaurante ?? null
  }
}
