import { supabase } from "@/lib/supabase/client"
import type { Announcement, AnnouncementCreatePayload } from "@/types/app"

type DataResponse<T> = {
  data: T | null
  error: { message: string } | null
}

export function fetchAdminAnnouncements() {
  return supabase.from("avisos_admin").select("*").order("created_at", { ascending: false }).limit(100)
}

export function createAnnouncement(payload: AnnouncementCreatePayload) {
  return supabase
    .from("avisos_admin")
    .insert({
      ...payload,
      target_restaurante_ids: payload.target_type === "restaurants" ? payload.target_restaurante_ids : [],
      target_plan: payload.target_type === "plan" ? payload.target_plan : null
    })
    .select("*")
    .single()
}

export async function fetchPendingAnnouncements(): Promise<DataResponse<Announcement[]>> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const userId = authData.user?.id

  if (authError || !userId) {
    return {
      data: [],
      error: { message: authError?.message ?? "No se encontro una sesion activa." }
    }
  }

  const { data: announcements, error: announcementsError } = await supabase
    .from("avisos_admin")
    .select("*")
    .eq("activo", true)
    .order("created_at", { ascending: true })
    .limit(20)

  if (announcementsError) {
    return {
      data: [],
      error: { message: announcementsError.message }
    }
  }

  const nextAnnouncements = (announcements ?? []) as Announcement[]
  const announcementIds = nextAnnouncements.map((announcement) => announcement.id)

  if (announcementIds.length === 0) {
    return {
      data: [],
      error: null
    }
  }

  const { data: reads, error: readsError } = await supabase
    .from("avisos_lecturas")
    .select("aviso_id")
    .eq("user_id", userId)
    .in("aviso_id", announcementIds)

  if (readsError) {
    return {
      data: [],
      error: { message: readsError.message }
    }
  }

  const readIds = new Set((reads ?? []).map((read) => read.aviso_id as string))

  return {
    data: nextAnnouncements.filter((announcement) => !readIds.has(announcement.id)),
    error: null
  }
}

export async function acknowledgeAnnouncement(announcementId: string): Promise<DataResponse<null>> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const userId = authData.user?.id

  if (authError || !userId) {
    return {
      data: null,
      error: { message: authError?.message ?? "No se encontro una sesion activa." }
    }
  }

  const { error } = await supabase.from("avisos_lecturas").upsert(
    {
      aviso_id: announcementId,
      user_id: userId
    },
    { onConflict: "aviso_id,user_id" }
  )

  return {
    data: null,
    error: error ? { message: error.message } : null
  }
}
