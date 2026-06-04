"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Building2, KeyRound, RotateCcw, Search, ShieldCheck, UserPlus, Users } from "lucide-react"
import {
  createEmployee,
  fetchEmployees,
  resetEmployeePassword,
  toggleEmployee,
  updateEmployee
} from "@/lib/data/employees"
import { fetchRestaurants } from "@/lib/data/restaurants"
import {
  getEmployeeLimitLabel,
  getPlanCapabilities,
  getPlanDisplayName
} from "@/lib/planLimits"
import type { EmployeeUser, OperationalUserRole, Restaurant, SubscriptionLevel } from "@/types/app"

type EmployeesModuleProps = {
  restaurantId: string
  subscriptionLevel?: SubscriptionLevel | null
  isGlobal?: boolean
}

type EmployeeForm = {
  nombre: string
  email: string
  rol: OperationalUserRole
}

const emptyForm: EmployeeForm = {
  nombre: "",
  email: "",
  rol: "Empleado"
}

const operationalRoles: OperationalUserRole[] = ["Empleado", "Gerente"]

export function EmployeesModule({ restaurantId, subscriptionLevel, isGlobal = false }: EmployeesModuleProps) {
  const [employees, setEmployees] = useState<EmployeeUser[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(restaurantId)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [searchTerm, setSearchTerm] = useState("")
  const [loadingRestaurants, setLoadingRestaurants] = useState(isGlobal)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!isGlobal) {
      setSelectedRestaurantId(restaurantId)
      return
    }

    let mounted = true

    async function loadRestaurants() {
      setLoadingRestaurants(true)
      const { data, error: restaurantsError } = await fetchRestaurants()

      if (!mounted) return

      if (restaurantsError) {
        setError(restaurantsError.message)
        setRestaurants([])
        setLoadingRestaurants(false)
        return
      }

      const nextRestaurants = (data ?? []) as Restaurant[]
      setRestaurants(nextRestaurants)
      setSelectedRestaurantId((current) => current || nextRestaurants[0]?.id || "")
      setLoadingRestaurants(false)
    }

    void loadRestaurants()

    return () => {
      mounted = false
    }
  }, [isGlobal, restaurantId])

  const loadEmployees = useCallback(async () => {
    const targetRestaurantId = isGlobal ? selectedRestaurantId : restaurantId

    if (!targetRestaurantId) {
      setEmployees([])
      setLoadingEmployees(false)
      return
    }

    setLoadingEmployees(true)
    setError("")

    const { data, error: loadError } = await fetchEmployees(isGlobal ? targetRestaurantId : undefined)

    if (loadError) {
      setError(loadError.message)
      setEmployees([])
      setLoadingEmployees(false)
      return
    }

    setEmployees(data ?? [])
    setLoadingEmployees(false)
  }, [isGlobal, restaurantId, selectedRestaurantId])

  useEffect(() => {
    void loadEmployees()
  }, [loadEmployees])

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  )

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) return employees

    return employees.filter((employee) =>
      employee.email.toLowerCase().includes(normalizedSearch) ||
      (employee.nombre ?? "").toLowerCase().includes(normalizedSearch)
    )
  }, [employees, searchTerm])

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.activo).length,
    [employees]
  )
  const managerCount = useMemo(
    () => employees.filter((employee) => employee.rol === "Gerente").length,
    [employees]
  )
  const activePlanLevel = isGlobal ? selectedRestaurant?.nivel_suscripcion : subscriptionLevel
  const planCapabilities = useMemo(() => getPlanCapabilities(activePlanLevel), [activePlanLevel])
  const employeeLimit = planCapabilities.employeeLimit
  const employeesLockedByPlan = employeeLimit === 0
  const employeeLimitReached = employeeLimit !== null && activeEmployees >= employeeLimit
  const canCreateEmployee = !employeesLockedByPlan && !employeeLimitReached
  const employeePlanMessage = employeesLockedByPlan
    ? `El plan ${getPlanDisplayName(activePlanLevel)} no permite crear empleados o gerentes.`
    : employeeLimitReached
      ? `El plan ${getPlanDisplayName(activePlanLevel)} permite ${getEmployeeLimitLabel(employeeLimit)} operativos.`
      : ""

  function updateForm<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setNotice("")

    const targetRestaurantId = isGlobal ? selectedRestaurantId : restaurantId

    if (!canCreateEmployee) {
      setError(employeePlanMessage)
      setSaving(false)
      return
    }

    const payload = {
      restaurante_id: targetRestaurantId,
      nombre: form.nombre.trim(),
      email: form.email.trim().toLowerCase(),
      rol: form.rol
    }

    if (!payload.restaurante_id || !payload.nombre || !payload.email || !payload.rol) {
      setError("Completa emprendimiento, nombre, correo y rol operativo.")
      setSaving(false)
      return
    }

    const { data, error: createError } = await createEmployee(payload)
    setSaving(false)

    if (createError || !data) {
      setError(createError?.message ?? "No se pudo registrar el empleado.")
      return
    }

    setEmployees((current) => {
      const exists = current.some((employee) => employee.user_id === data.user_id)
      return exists
        ? current.map((employee) => (employee.user_id === data.user_id ? data : employee))
        : [data, ...current]
    })
    setForm(emptyForm)
    setNotice(`${data.nombre ?? data.email} quedo autorizado como ${roleLabel(data.rol)}. Creara su clave en el primer ingreso.`)
  }

  async function handleRoleChange(employee: EmployeeUser, rol: OperationalUserRole) {
    if (employee.rol === rol) return

    setUpdatingId(employee.user_id)
    setError("")
    setNotice("")

    const { data, error: updateError } = await updateEmployee({
      user_id: employee.user_id,
      rol
    })
    setUpdatingId("")

    if (updateError || !data) {
      setError(updateError?.message ?? "No se pudo actualizar el rol operativo.")
      return
    }

    setEmployees((current) => current.map((item) => (item.user_id === data.user_id ? data : item)))
    setNotice(`${data.nombre ?? data.email} ahora tiene rol ${roleLabel(data.rol)}.`)
  }

  async function handleToggleEmployee(employee: EmployeeUser) {
    setUpdatingId(employee.user_id)
    setError("")
    setNotice("")

    const { data, error: toggleError } = await toggleEmployee(employee.user_id, !employee.activo)
    setUpdatingId("")

    if (toggleError || !data) {
      setError(toggleError?.message ?? "No se pudo actualizar el estado del empleado.")
      return
    }

    setEmployees((current) => current.map((item) => (item.user_id === data.user_id ? data : item)))
    setNotice(data.activo ? `${data.nombre ?? data.email} fue habilitado.` : `${data.nombre ?? data.email} fue suspendido.`)
  }

  async function handleResetPassword(employee: EmployeeUser) {
    setUpdatingId(employee.user_id)
    setError("")
    setNotice("")

    const { error: resetError } = await resetEmployeePassword(employee.user_id)
    setUpdatingId("")

    if (resetError) {
      setError(resetError.message)
      return
    }

    setNotice(`${employee.nombre ?? employee.email} creara una nueva clave en el proximo ingreso.`)
  }

  return (
    <div className="module employees-module">
      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}
      {employeeLimit !== null && (
        <div className={canCreateEmployee ? "notice" : "alert"}>
          Plan {getPlanDisplayName(activePlanLevel)}:{" "}
          {employeeLimit === 0 ? "modulo de empleados no incluido" : `${activeEmployees}/${employeeLimit} usuarios operativos activos`}.
        </div>
      )}

      {isGlobal && (
        <section className="panel global-report-selector">
          <div className="filter-title">
            <Building2 size={18} aria-hidden="true" />
            <div>
              <h2>Emprendimiento seleccionado</h2>
            <p>Selecciona el cliente donde se crearan y administraran empleados o gerentes.</p>
            </div>
          </div>
          <div className="filter-grid compact">
            <div className="field">
              <label htmlFor="employees-restaurant">Emprendimiento</label>
              <select
                id="employees-restaurant"
                value={selectedRestaurantId}
                onChange={(event) => setSelectedRestaurantId(event.target.value)}
                disabled={loadingRestaurants || restaurants.length === 0}
              >
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.nombre} - {restaurant.nivel_suscripcion}
                  </option>
                ))}
              </select>
            </div>
            <article className="metric global-report-business">
              <span>{selectedRestaurant?.activo ? "Activo" : "Suspendido"}</span>
              <strong>{selectedRestaurant?.nombre ?? "Sin emprendimientos"}</strong>
              <small>{selectedRestaurant?.admin_email ?? "Registra un cliente para agregar empleados."}</small>
            </article>
          </div>
        </section>
      )}

      <section className="admin-grid">
        <form className="panel form-grid admin-form" onSubmit={handleSubmit}>
          <div className="section-title">
            <h2>Nuevo usuario operativo</h2>
            <p>Autoriza empleados limitados o gerentes con permisos operativos elevados.</p>
          </div>

          <div className="field">
            <label htmlFor="employee-name">Nombre</label>
            <input
              id="employee-name"
              value={form.nombre}
              onChange={(event) => updateForm("nombre", event.target.value)}
              placeholder="Nombre del empleado"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="employee-email">Correo de acceso</label>
            <input
              id="employee-email"
              type="email"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
              placeholder="empleado@negocio.com"
              required
            />
          </div>

          <div className="field">
            <span className="field-label" id="employee-role-label">Rol operativo</span>
            <RoleSelector
              labelledBy="employee-role-label"
              value={form.rol}
              onChange={(role) => updateForm("rol", role)}
              disabled={!canCreateEmployee}
            />
          </div>

          <button className="button primary" type="submit" disabled={saving || !canCreateEmployee}>
            <UserPlus size={18} aria-hidden="true" />
            {saving ? "Guardando..." : "Registrar usuario"}
          </button>
        </form>

        <aside className="admin-summary">
          <article className="metric">
            <span>Usuarios activos</span>
            <strong>{activeEmployees}</strong>
            <small>
              {employeeLimit === null ? "Sin limite de usuarios" : `${employeeLimit} cupos por plan`} -{" "}
              {managerCount} gerente(s)
            </small>
          </article>
          <article className="panel admin-recent-card">
            <div className="section-title">
              <h2>Permisos operativos</h2>
              <p>Empleado consulta inventario y reportes del dia. Gerente opera como administrador, sin modificar el administrador principal.</p>
            </div>
          </article>
        </aside>
      </section>

      <section className="panel admin-list">
        <div className="section-title">
          <h2>Usuarios operativos registrados</h2>
          <p>Empleados y gerentes autorizados para entrar por el login general.</p>
        </div>

        <label className="search-box admin-search" htmlFor="employee-search">
          <Search size={17} aria-hidden="true" />
          <input
            id="employee-search"
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre o correo"
          />
        </label>

        {loadingEmployees && <div className="empty-state">Cargando empleados...</div>}

        {!loadingEmployees && employees.length === 0 && (
          <div className="empty-state">Aun no hay usuarios operativos registrados.</div>
        )}

        {!loadingEmployees &&
          filteredEmployees.map((employee) => (
            <article className="restaurant-row employee-row" key={employee.user_id}>
              <div className="restaurant-row-main">
                <Users size={19} aria-hidden="true" />
                <div>
                  <strong>{employee.nombre ?? "Usuario sin nombre"}</strong>
                  <span>{employee.email}</span>
                </div>
              </div>
              <span className={`badge ${employee.activo ? "active" : "off"}`}>
                {employee.activo ? "Activo" : "Suspendido"}
              </span>
              <div className="employee-role-select">
                <span id={`employee-role-${employee.user_id}`}>Rol</span>
                <RoleSelector
                  labelledBy={`employee-role-${employee.user_id}`}
                  value={employee.rol}
                  onChange={(role) => handleRoleChange(employee, role)}
                  disabled={updatingId === employee.user_id || employeesLockedByPlan}
                  compact
                />
              </div>
              <div className="restaurant-row-actions">
                <button
                  className={employee.activo ? "button warn" : "button mint"}
                  type="button"
                  onClick={() => handleToggleEmployee(employee)}
                  disabled={updatingId === employee.user_id || (employee.activo === false && employeeLimitReached)}
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  {employee.activo ? "Suspender" : "Habilitar"}
                </button>
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => handleResetPassword(employee)}
                  disabled={updatingId === employee.user_id}
                >
                  {updatingId === employee.user_id ? (
                    <RotateCcw size={16} aria-hidden="true" />
                  ) : (
                    <KeyRound size={16} aria-hidden="true" />
                  )}
                  Restablecer clave
                </button>
              </div>
            </article>
          ))}
      </section>
    </div>
  )
}

function roleLabel(role: OperationalUserRole) {
  return role === "Gerente" ? "Gerente" : "Empleado"
}

function roleHint(role: OperationalUserRole) {
  return role === "Gerente" ? "Permisos elevados" : "Operacion diaria"
}

function RoleSelector({
  labelledBy,
  value,
  onChange,
  disabled = false,
  compact = false
}: {
  labelledBy: string
  value: OperationalUserRole
  onChange: (role: OperationalUserRole) => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={compact ? "role-selector compact" : "role-selector"}
      role="radiogroup"
      aria-labelledby={labelledBy}
    >
      {operationalRoles.map((role) => {
        const isActive = value === role
        const Icon = role === "Gerente" ? ShieldCheck : Users

        return (
          <button
            key={role}
            className={isActive ? "role-option active" : "role-option"}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(role)}
            disabled={disabled}
          >
            <span className="role-option-icon" aria-hidden="true">
              <Icon size={15} />
            </span>
            <span>
              <strong>{roleLabel(role)}</strong>
              {!compact && <small>{roleHint(role)}</small>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
