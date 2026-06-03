"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Building2, Check, Edit3, KeyRound, Plus, RotateCcw, ShieldCheck } from "lucide-react"
import { useDashboardSession } from "@/components/dashboard/useDashboardSession"
import {
  changeRestaurantAdminPassword,
  createRestaurant,
  fetchRestaurants,
  resetRestaurantAdminPassword,
  updateRestaurant
} from "@/lib/data/restaurants"
import type { Restaurant, RestaurantWritePayload, SubscriptionLevel } from "@/types/app"

type RestaurantForm = {
  nombre: string
  admin_email: string
  telefono: string
  nivel_suscripcion: SubscriptionLevel
  fecha_suscripcion: string
  activo: boolean
}

const emptyForm: RestaurantForm = {
  nombre: "",
  admin_email: "",
  telefono: "",
  nivel_suscripcion: "Basico",
  fecha_suscripcion: new Date().toISOString().slice(0, 10),
  activo: true
}

const subscriptionLevels: SubscriptionLevel[] = ["Gratis", "Basico", "Completo", "Emprendedor"]

export function AdminShell() {
  const { canAccessAdmin, handleSignOut, isSigningOut, loading, profileError } = useDashboardSession()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [form, setForm] = useState<RestaurantForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingAccess, setUpdatingAccess] = useState(false)
  const [passwordRestaurant, setPasswordRestaurant] = useState<Restaurant | null>(null)
  const [newPassword, setNewPassword] = useState("")
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
  const recentActiveRestaurants = useMemo(
    () => restaurants.filter((restaurant) => restaurant.activo).slice(0, 6),
    [restaurants]
  )
  const submitLabel = saving ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar emprendimiento"

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
      activo: restaurant.activo
    })
  }

  function openPasswordDialog(restaurant: Restaurant) {
    setPasswordRestaurant(restaurant)
    setNewPassword("")
    setError("")
    setNotice("")
  }

  function closePasswordDialog() {
    setPasswordRestaurant(null)
    setNewPassword("")
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

    const response = editingId
      ? await updateRestaurant(editingId, payload)
      : await createRestaurant(payload)

    setSaving(false)

    if (response.error) {
      setError(response.error.message)
      return
    }

    setNotice(editingId ? "Emprendimiento actualizado." : "Emprendimiento registrado. El administrador creara su contrasena al ingresar.")
    resetForm()
    await loadRestaurants()
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!passwordRestaurant) return

    if (newPassword.trim().length < 6) {
      setError("La nueva contrasena debe tener minimo 6 caracteres.")
      return
    }

    setUpdatingAccess(true)
    setError("")
    setNotice("")

    const response = await changeRestaurantAdminPassword(passwordRestaurant.id, newPassword.trim())
    setUpdatingAccess(false)

    if (response.error) {
      setError(response.error.message)
      return
    }

    setNotice(`Contrasena actualizada para ${passwordRestaurant.nombre}.`)
    closePasswordDialog()
  }

  async function handleResetPassword(restaurant: Restaurant) {
    setUpdatingAccess(true)
    setError("")
    setNotice("")

    const response = await resetRestaurantAdminPassword(restaurant.id)
    setUpdatingAccess(false)

    if (response.error) {
      setError(response.error.message)
      return
    }

    setNotice(`Clave restablecida para ${restaurant.nombre}. El administrador creara una nueva al ingresar.`)
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
          <p>Solo un SuperAdministrador puede gestionar emprendimientos.</p>
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
          <h1>Emprendimientos suscritos</h1>
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
              <h2>{editingId ? "Editar emprendimiento" : "Nuevo emprendimiento"}</h2>
              <p>El correo administrador activara su contrasena en el primer ingreso.</p>
            </div>
          </div>

          <div className="field">
            <label htmlFor="restaurant-name">Nombre del emprendimiento</label>
            <input
              id="restaurant-name"
              value={form.nombre}
              onChange={(event) => updateForm("nombre", event.target.value)}
              placeholder="La Terraza Creativa"
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
              placeholder="admin@emprendimiento.com"
              required
            />
          </div>

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
            <span>Emprendimientos activos</span>
            <strong>{activeCount}</strong>
            <small>{restaurants.length} registrados</small>
          </article>
          <article className="panel admin-recent-card">
            <div className="section-title">
              <h2>Activos recientes</h2>
              <p>Vista rapida para validar clientes operativos.</p>
            </div>
            <div className="admin-recent-list">
              {recentActiveRestaurants.length === 0 && <span className="muted">Aun no hay emprendimientos activos.</span>}
              {recentActiveRestaurants.map((restaurant) => (
                <div className="admin-recent-item" key={restaurant.id}>
                  <strong>{restaurant.nombre}</strong>
                  <span>{restaurant.admin_email}</span>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="panel admin-list">
        <div className="section-title">
          <h2>Clientes registrados</h2>
          <p>Emprendimientos que pueden operar en el dashboard con su correo administrador.</p>
        </div>

        {loadingRestaurants && <div className="empty-state">Cargando emprendimientos...</div>}
        {!loadingRestaurants && restaurants.length === 0 && (
          <div className="empty-state">Aun no hay emprendimientos registrados.</div>
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
              <div className="restaurant-row-actions">
                <button className="button subtle" type="button" onClick={() => editRestaurant(restaurant)}>
                  <Edit3 size={16} aria-hidden="true" />
                  Editar
                </button>
                <button className="button subtle" type="button" onClick={() => openPasswordDialog(restaurant)}>
                  <KeyRound size={16} aria-hidden="true" />
                  Cambiar clave
                </button>
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => handleResetPassword(restaurant)}
                  disabled={updatingAccess}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Restablecer
                </button>
              </div>
            </article>
          ))}
      </section>

      {passwordRestaurant && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel form-grid" onSubmit={handlePasswordSubmit}>
            <div className="modal-header">
              <div>
                <h2>Cambiar clave</h2>
                <p>{passwordRestaurant.nombre}</p>
              </div>
              <button className="button subtle icon" type="button" onClick={closePasswordDialog}>
                x
              </button>
            </div>
            <div className="field">
              <label htmlFor="admin-new-password">Nueva contrasena</label>
              <input
                id="admin-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimo 6 caracteres"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="actions-row">
              <button className="button primary" type="submit" disabled={updatingAccess}>
                <Check size={18} aria-hidden="true" />
                {updatingAccess ? "Guardando..." : "Guardar clave"}
              </button>
              <button className="button subtle" type="button" onClick={closePasswordDialog} disabled={updatingAccess}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function formatDateForAdmin(dateKey: string) {
  const [year, month, day] = dateKey.split("-")
  if (!year || !month || !day) return dateKey
  return `${day}/${month}/${year}`
}
