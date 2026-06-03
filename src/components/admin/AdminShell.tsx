"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Building2, Check, Edit3, KeyRound, Plus, ShieldCheck } from "lucide-react"
import { useDashboardSession } from "@/components/dashboard/useDashboardSession"
import { createRestaurant, fetchRestaurants, updateRestaurant } from "@/lib/data/restaurants"
import type { Restaurant, RestaurantCreatePayload, RestaurantWritePayload, SubscriptionLevel } from "@/types/app"

type RestaurantForm = {
  nombre: string
  admin_email: string
  telefono: string
  nivel_suscripcion: SubscriptionLevel
  fecha_suscripcion: string
  admin_password: string
  activo: boolean
}

const emptyForm: RestaurantForm = {
  nombre: "",
  admin_email: "",
  telefono: "",
  nivel_suscripcion: "Basico",
  fecha_suscripcion: new Date().toISOString().slice(0, 10),
  admin_password: "",
  activo: true
}

const subscriptionLevels: SubscriptionLevel[] = ["Gratis", "Basico", "Completo", "Emprendedor"]

export function AdminShell() {
  const { canAccessAdmin, handleSignOut, isSigningOut, loading, profileError, sessionLabel } = useDashboardSession()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [form, setForm] = useState<RestaurantForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadRestaurants = useCallback(async () => {
    setLoadingRestaurants(true)
    setError("")

    const { data, error: loadError } = await fetchRestaurants()

    if (loadError) {
      setError(loadError.message)
      setLoadingRestaurants(false)
      return
    }

    setRestaurants((data ?? []) as Restaurant[])
    setLoadingRestaurants(false)
  }, [])

  useEffect(() => {
    if (canAccessAdmin) {
      void loadRestaurants()
    }
  }, [canAccessAdmin, loadRestaurants])

  const activeCount = useMemo(() => restaurants.filter((restaurant) => restaurant.activo).length, [restaurants])
  const submitLabel = saving ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar restaurante"

  function updateForm<K extends keyof RestaurantForm>(key: K, value: RestaurantForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function resetForm() {
    setForm({ ...emptyForm, fecha_suscripcion: new Date().toISOString().slice(0, 10) })
    setEditingId(null)
  }

  function editRestaurant(restaurant: Restaurant) {
    setEditingId(restaurant.id)
    setNotice("")
    setError("")
    setForm({
      nombre: restaurant.nombre,
      admin_email: restaurant.admin_email,
      telefono: restaurant.telefono,
      nivel_suscripcion: restaurant.nivel_suscripcion,
      fecha_suscripcion: restaurant.fecha_suscripcion,
      admin_password: "",
      activo: restaurant.activo
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")

    const payload: RestaurantWritePayload = {
      nombre: form.nombre.trim(),
      admin_email: form.admin_email.trim().toLowerCase(),
      telefono: form.telefono.trim(),
      nivel_suscripcion: form.nivel_suscripcion,
      fecha_suscripcion: form.fecha_suscripcion,
      activo: form.activo
    }

    if (!payload.nombre || !payload.admin_email || !payload.telefono || !payload.fecha_suscripcion) {
      setError("Completa nombre, correo, telefono y fecha de suscripcion.")
      setSaving(false)
      return
    }

    if (!editingId && form.admin_password.trim().length < 6) {
      setError("La contrasena del administrador debe tener minimo 6 caracteres.")
      setSaving(false)
      return
    }

    const response = editingId
      ? await updateRestaurant(editingId, payload)
      : await createRestaurant({
        ...payload,
        admin_password: form.admin_password.trim()
      } satisfies RestaurantCreatePayload)

    setSaving(false)

    if (response.error) {
      setError(response.error.message)
      return
    }

    setNotice(editingId ? "Restaurante actualizado." : "Restaurante registrado.")
    resetForm()
    await loadRestaurants()
  }

  if (loading) {
    return <main className="loading-screen">Cargando panel administrador...</main>
  }

  if (profileError) {
    return <main className="loading-screen">No se pudo cargar el perfil: {profileError}</main>
  }

  if (!canAccessAdmin) {
    return (
      <main className="admin-page">
        <section className="panel admin-empty">
          <ShieldCheck size={26} aria-hidden="true" />
          <h1>Acceso restringido</h1>
          <p>Solo un SuperAdministrador puede gestionar restaurantes.</p>
          <a className="button primary" href="/dashboard">Volver al dashboard</a>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <span className="topbar-eyebrow">Panel administrador</span>
          <h1>Restaurantes suscritos</h1>
          <p>Gestiona clientes, correos administradores y planes activos de Cuadre.</p>
        </div>
        <div className="actions-row">
          <a className="button subtle" href="/dashboard">
            <ArrowLeft size={17} aria-hidden="true" />
            Dashboard
          </a>
          <button className="button primary" type="button" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? "Cerrando..." : "Cerrar sesion"}
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <section className="admin-grid">
        <form className="panel form-grid admin-form" onSubmit={handleSubmit}>
          <div className="admin-form-heading">
            <div className="section-title">
              <h2>{editingId ? "Editar restaurante" : "Nuevo restaurante"}</h2>
              <p>El correo administrador sera el acceso operativo del negocio.</p>
            </div>
            <button className="button primary admin-form-submit" type="submit" disabled={saving}>
              {editingId ? <Check size={18} /> : <Plus size={18} />}
              {submitLabel}
            </button>
          </div>

          <div className="field">
            <label htmlFor="restaurant-name">Nombre del restaurante</label>
            <input
              id="restaurant-name"
              value={form.nombre}
              onChange={(event) => updateForm("nombre", event.target.value)}
              placeholder="La Terraza"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="restaurant-email">Correo administrador</label>
            <input
              id="restaurant-email"
              type="email"
              value={form.admin_email}
              onChange={(event) => updateForm("admin_email", event.target.value)}
              placeholder="admin@restaurante.com"
              required
            />
          </div>

          {!editingId && (
            <div className="field">
              <label htmlFor="restaurant-password">Contrasena inicial</label>
              <div className="admin-password-field">
                <KeyRound size={18} aria-hidden="true" />
                <input
                  id="restaurant-password"
                  type="password"
                  value={form.admin_password}
                  onChange={(event) => updateForm("admin_password", event.target.value)}
                  placeholder="Minimo 6 caracteres"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
            </div>
          )}

          <div className="inline-grid">
            <div className="field">
              <label htmlFor="restaurant-phone">Telefono</label>
              <input
                id="restaurant-phone"
                value={form.telefono}
                onChange={(event) => updateForm("telefono", event.target.value)}
                placeholder="+57 300 000 0000"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="subscription-date">Fecha de suscripcion</label>
              <input
                id="subscription-date"
                type="date"
                value={form.fecha_suscripcion}
                onChange={(event) => updateForm("fecha_suscripcion", event.target.value)}
                required
              />
            </div>
          </div>

          <div className="inline-grid">
            <div className="field">
              <label htmlFor="subscription-level">Nivel de suscripcion</label>
              <select
                id="subscription-level"
                value={form.nivel_suscripcion}
                onChange={(event) => updateForm("nivel_suscripcion", event.target.value as SubscriptionLevel)}
              >
                {subscriptionLevels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <label className="check-row admin-active-check">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(event) => updateForm("activo", event.target.checked)}
              />
              <span>
                <strong>{form.activo ? "Activo" : "Inactivo"}</strong>
                <small>Controla el estado comercial del cliente</small>
              </span>
            </label>
          </div>

          <div className="actions-row admin-form-actions">
            <button className="button primary" type="submit" disabled={saving}>
              {editingId ? <Check size={18} /> : <Plus size={18} />}
              {submitLabel}
            </button>
            {editingId && (
              <button className="button subtle" type="button" onClick={resetForm} disabled={saving}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <aside className="admin-summary">
          <article className="metric">
            <span>Restaurantes activos</span>
            <strong>{activeCount}</strong>
            <small>{restaurants.length} registrados</small>
          </article>
          <article className="metric">
            <span>Sesion</span>
            <strong>{sessionLabel}</strong>
            <small>SuperAdministrador</small>
          </article>
        </aside>
      </section>

      <section className="panel admin-list">
        <div className="section-title">
          <h2>Clientes registrados</h2>
          <p>Restaurantes que pueden operar en el dashboard con su correo administrador.</p>
        </div>

        {loadingRestaurants && <div className="empty-state">Cargando restaurantes...</div>}
        {!loadingRestaurants && restaurants.length === 0 && (
          <div className="empty-state">Aun no hay restaurantes registrados.</div>
        )}

        {!loadingRestaurants &&
          restaurants.map((restaurant) => (
            <article className="restaurant-row" key={restaurant.id}>
              <div className="restaurant-row-main">
                <Building2 size={19} aria-hidden="true" />
                <div>
                  <strong>{restaurant.nombre}</strong>
                  <span>{restaurant.admin_email}</span>
                </div>
              </div>
              <span>{restaurant.telefono}</span>
              <span className="badge active">{restaurant.nivel_suscripcion}</span>
              <span>{formatDateForAdmin(restaurant.fecha_suscripcion)}</span>
              <span className={`badge ${restaurant.activo ? "active" : "off"}`}>
                {restaurant.activo ? "Activo" : "Inactivo"}
              </span>
              <button className="button subtle" type="button" onClick={() => editRestaurant(restaurant)}>
                <Edit3 size={16} aria-hidden="true" />
                Editar
              </button>
            </article>
          ))}
      </section>
    </main>
  )
}

function formatDateForAdmin(dateKey: string) {
  const [year, month, day] = dateKey.split("-")
  if (!year || !month || !day) return dateKey
  return `${day}/${month}/${year}`
}
