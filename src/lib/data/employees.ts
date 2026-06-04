import { supabase } from "@/lib/supabase/client"
import type { EmployeeCreatePayload, EmployeeUpdatePayload, EmployeeUser } from "@/types/app"

type DataResponse<T> = {
  data: T | null
  error: { message: string } | null
}

type EmployeeListBody = {
  employees?: EmployeeUser[]
  error?: string
}

type EmployeeBody = {
  employee?: EmployeeUser
  error?: string
}

export async function fetchEmployees(restaurantId?: string): Promise<DataResponse<EmployeeUser[]>> {
  const endpoint = restaurantId
    ? `/api/admin/employees?restaurant_id=${encodeURIComponent(restaurantId)}`
    : "/api/admin/employees"

  const response = await requestEmployees(endpoint, { method: "GET" })
  const body = await response.json().catch(() => null) as EmployeeListBody | null

  if (!response.ok) {
    return {
      data: null,
      error: { message: body?.error ?? "No se pudieron cargar los empleados." }
    }
  }

  return {
    data: body?.employees ?? [],
    error: null
  }
}

export async function createEmployee(payload: EmployeeCreatePayload): Promise<DataResponse<EmployeeUser>> {
  const response = await requestEmployees("/api/admin/employees", {
    method: "POST",
    body: JSON.stringify(payload)
  })
  const body = await response.json().catch(() => null) as EmployeeBody | null

  if (!response.ok) {
    return {
      data: null,
      error: { message: body?.error ?? "No se pudo registrar el empleado." }
    }
  }

  return {
    data: body?.employee ?? null,
    error: null
  }
}

export async function updateEmployee(payload: EmployeeUpdatePayload): Promise<DataResponse<EmployeeUser>> {
  const response = await requestEmployees("/api/admin/employees", {
    method: "PATCH",
    body: JSON.stringify({
      action: "update",
      ...payload
    })
  })
  const body = await response.json().catch(() => null) as EmployeeBody | null

  if (!response.ok) {
    return {
      data: null,
      error: { message: body?.error ?? "No se pudo actualizar el empleado." }
    }
  }

  return {
    data: body?.employee ?? null,
    error: null
  }
}

export async function toggleEmployee(userId: string, activo: boolean): Promise<DataResponse<EmployeeUser>> {
  const response = await requestEmployees("/api/admin/employees", {
    method: "PATCH",
    body: JSON.stringify({
      action: "toggle",
      user_id: userId,
      activo
    })
  })
  const body = await response.json().catch(() => null) as EmployeeBody | null

  if (!response.ok) {
    return {
      data: null,
      error: { message: body?.error ?? "No se pudo cambiar el estado del empleado." }
    }
  }

  return {
    data: body?.employee ?? null,
    error: null
  }
}

export async function resetEmployeePassword(userId: string): Promise<DataResponse<EmployeeUser>> {
  const response = await requestEmployees("/api/admin/employees", {
    method: "PATCH",
    body: JSON.stringify({
      action: "reset",
      user_id: userId
    })
  })
  const body = await response.json().catch(() => null) as EmployeeBody | null

  if (!response.ok) {
    return {
      data: null,
      error: { message: body?.error ?? "No se pudo restablecer la clave del empleado." }
    }
  }

  return {
    data: body?.employee ?? null,
    error: null
  }
}

async function requestEmployees(endpoint: string, init: RequestInit) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (sessionError || !accessToken) {
    return new Response(
      JSON.stringify({ error: sessionError?.message ?? "Inicia sesion para gestionar empleados." }),
      { status: 401 }
    )
  }

  return fetch(endpoint, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  })
}
