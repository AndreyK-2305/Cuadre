"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Check, Edit3, Plus, Power, Search } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { getPlanCapabilities, getPlanDisplayName, getProductLimitLabel } from "@/lib/planLimits"
import { ModalBackdrop, ModalHeader } from "@/components/ui/Modal"
import {
  buildProductPayload,
  emptyProductForm,
  filterProducts,
  getProductCreatedNotice,
  getProductSavedNotice,
  splitProductsByType,
  type ProductForm
} from "@/lib/dashboard/products"
import {
  createInventoryMovement,
  createProduct,
  fetchProducts,
  updateProduct,
  updateProductActiveState,
  updateProductStock
} from "@/lib/data/products"
import type { InventoryMovementType, Product, SubscriptionLevel } from "@/types/app"

type InventoryModuleProps = {
  restaurantId: string
  subscriptionLevel?: SubscriptionLevel | null
  readOnly?: boolean
  onChanged: () => void
}

export function InventoryModule({
  restaurantId,
  subscriptionLevel,
  readOnly = false,
  onChanged
}: InventoryModuleProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyProductForm)
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: loadError } = await fetchProducts()

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const filteredProducts = useMemo(() => {
    return filterProducts(products, search)
  }, [products, search])

  const { inventoryItems, saleProducts } = useMemo(
    () => splitProductsByType(filteredProducts),
    [filteredProducts]
  )
  const planCapabilities = useMemo(() => getPlanCapabilities(subscriptionLevel), [subscriptionLevel])
  const productLimitReached =
    planCapabilities.productLimit !== null && products.length >= planCapabilities.productLimit
  const productLimitMessage = productLimitReached
    ? `El plan ${getPlanDisplayName(subscriptionLevel)} permite ${getProductLimitLabel(planCapabilities.productLimit)} entre productos e inventario.`
    : ""

  function updateForm<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function replaceProduct(updatedProduct: Product) {
    setProducts((current) =>
      current.map((product) => (product.id === updatedProduct.id ? updatedProduct : product))
    )
  }

  function appendProduct(createdProduct: Product) {
    setProducts((current) => [...current, createdProduct])
  }

  function closeModal() {
    setForm(emptyProductForm)
    setEditingId(null)
    setIsModalOpen(false)
  }

  function openCreateModal() {
    if (readOnly) return
    if (productLimitReached) {
      setError(productLimitMessage)
      return
    }

    setError("")
    setNotice("")
    setForm(emptyProductForm)
    setEditingId(null)
    setIsModalOpen(true)
  }

  function editProduct(product: Product) {
    if (readOnly) return

    setError("")
    setNotice("")
    setEditingId(product.id)
    setForm({
      nombre: product.nombre,
      descripcion: product.descripcion ?? "",
      tipo_item: product.tipo_item,
      precio: String(product.precio),
      cantidad_stock: String(product.cantidad_stock),
      tipo_unidad: product.tipo_unidad
    })
    setIsModalOpen(true)
  }

  async function createMovement(
    product: Product,
    tipo_movimiento: InventoryMovementType,
    cantidad: number,
    stock_antes: number,
    stock_despues: number,
    nota: string
  ) {
    const { error: movementError } = await createInventoryMovement({
      restaurante_id: restaurantId,
      producto_id: product.id,
      tipo_movimiento,
      cantidad,
      stock_antes,
      stock_despues,
      nota
    })

    if (movementError) {
      throw new Error(movementError.message)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (readOnly) {
      setError("Tu usuario solo puede consultar inventario.")
      return
    }

    setSaving(true)
    setError("")
    setNotice("")

    const payload = buildProductPayload(form)

    if (!payload.nombre) {
      setError("El nombre es obligatorio.")
      setSaving(false)
      return
    }

    if (payload.precio < 0 || payload.cantidad_stock < 0) {
      setError("Precio y cantidad deben ser valores positivos.")
      setSaving(false)
      return
    }

    try {
      if (editingId) {
        const original = products.find((product) => product.id === editingId)
        const { data, error: updateError } = await updateProduct(editingId, payload)

        if (updateError) throw new Error(updateError.message)

        const updatedProduct = data as Product
        const shouldTrackStock =
          updatedProduct.tipo_item === "inventario" &&
          original &&
          original.cantidad_stock !== payload.cantidad_stock

        if (shouldTrackStock) {
          const diff = payload.cantidad_stock - original.cantidad_stock
          await createMovement(
            updatedProduct,
            diff > 0 ? "entrada" : "ajuste",
            diff,
            original.cantidad_stock,
            payload.cantidad_stock,
            diff > 0 ? "Entrada manual de inventario" : "Ajuste manual de inventario"
          )
        }

        replaceProduct(updatedProduct)
        setNotice(getProductSavedNotice(updatedProduct))
      } else {
        if (productLimitReached) {
          setError(productLimitMessage)
          setSaving(false)
          return
        }

        const { data, error: insertError } = await createProduct(payload, restaurantId)

        if (insertError) throw new Error(insertError.message)

        const createdProduct = data as Product
        if (createdProduct.tipo_item === "inventario" && createdProduct.cantidad_stock > 0) {
          await createMovement(
            createdProduct,
            "entrada",
            createdProduct.cantidad_stock,
            0,
            createdProduct.cantidad_stock,
            "Inventario inicial"
          )
        }

        appendProduct(createdProduct)
        setNotice(getProductCreatedNotice(createdProduct))
      }

      closeModal()
      onChanged()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddStock(product: Product) {
    if (readOnly) {
      setError("Tu usuario solo puede consultar inventario.")
      return
    }

    const amount = Number(stockInputs[product.id] ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresa una cantidad mayor a cero para sumar stock.")
      return
    }

    setError("")
    setNotice("")
    const nextStock = product.cantidad_stock + amount

    const { data, error: updateError } = await updateProductStock(product.id, nextStock)

    if (updateError) {
      setError(updateError.message)
      return
    }

    try {
      await createMovement(
        data as Product,
        "entrada",
        amount,
        product.cantidad_stock,
        nextStock,
        "Entrada rapida de inventario"
      )
      setStockInputs((current) => ({ ...current, [product.id]: "" }))
      replaceProduct(data as Product)
      setNotice(`Se sumaron ${amount} ${product.tipo_unidad} a ${product.nombre}.`)
      onChanged()
    } catch (stockError) {
      setError(stockError instanceof Error ? stockError.message : "No se pudo registrar movimiento.")
    }
  }

  async function handleToggleProduct(product: Product) {
    if (readOnly) {
      setError("Tu usuario solo puede consultar inventario.")
      return
    }

    setError("")
    setNotice("")

    const { data, error: updateError } = await updateProductActiveState(product.id, !product.activo)

    if (updateError) {
      setError(updateError.message)
      return
    }

    const updatedProduct = data as Product
    if (!updatedProduct.activo) {
      try {
        await createMovement(
          updatedProduct,
          "deshabilitado",
          0,
          product.cantidad_stock,
          product.cantidad_stock,
          updatedProduct.tipo_item === "producto"
            ? "Producto deshabilitado para ventas"
            : "Inventario deshabilitado"
        )
      } catch (toggleError) {
        setError(toggleError instanceof Error ? toggleError.message : "No se pudo registrar movimiento.")
      }
    }

    setNotice(updatedProduct.activo ? "Elemento habilitado." : "Elemento deshabilitado.")
    replaceProduct(updatedProduct)
    onChanged()
  }

  return (
    <div className="module">
      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}
      {planCapabilities.productLimit !== null && (
        <div className={productLimitReached ? "alert" : "notice"}>
          Plan {getPlanDisplayName(subscriptionLevel)}: {products.length}/{planCapabilities.productLimit} productos usados.
        </div>
      )}

      <section className="panel inventory-search-panel">
        <div className="field">
          <label htmlFor="buscar-producto">Buscar</label>
          <div className="actions-row">
            <Search size={18} />
            <input
              id="buscar-producto"
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, tipo o descripcion"
            />
          </div>
        </div>
        {readOnly ? (
          <div className="inventory-readonly-note">
            <strong>Solo consulta</strong>
            <span>El administrador del negocio gestiona cambios de inventario.</span>
          </div>
        ) : (
          <button
            className="button primary"
            type="button"
            onClick={openCreateModal}
            disabled={productLimitReached}
            title={productLimitReached ? productLimitMessage : undefined}
          >
            <Plus size={18} />
            Agregar
          </button>
        )}
      </section>

      {loading && <div className="panel empty-state">Cargando productos e inventario...</div>}

      {!loading && (
        <div className="inventory-columns">
          <InventoryColumn
            title="Inventarios"
            emptyText="No hay articulos de inventario."
            items={inventoryItems}
            stockInputs={stockInputs}
            onStockInputChange={(id, value) =>
              setStockInputs((current) => ({
                ...current,
                [id]: value
              }))
            }
            onAddStock={handleAddStock}
            onEdit={editProduct}
            onToggle={handleToggleProduct}
            readOnly={readOnly}
          />

          <ProductColumn
            title="Productos"
            emptyText="No hay productos de venta."
            items={saleProducts}
            onEdit={editProduct}
            onToggle={handleToggleProduct}
            readOnly={readOnly}
          />
        </div>
      )}

      {isModalOpen && (
        <ProductModal
          form={form}
          editing={Boolean(editingId)}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onChange={updateForm}
        />
      )}
    </div>
  )
}

function InventoryColumn({
  title,
  emptyText,
  items,
  stockInputs,
  onStockInputChange,
  onAddStock,
  onEdit,
  onToggle,
  readOnly
}: {
  title: string
  emptyText: string
  items: Product[]
  stockInputs: Record<string, string>
  onStockInputChange: (id: string, value: string) => void
  onAddStock: (product: Product) => void
  onEdit: (product: Product) => void
  onToggle: (product: Product) => void
  readOnly: boolean
}) {
  return (
    <section className="panel product-list">
      <div className="column-heading">
        <h2>{title}</h2>
        <span className="badge">{items.length}</span>
      </div>

      {items.length === 0 && <div className="empty-state">{emptyText}</div>}

      {items.map((item) => (
        <article className="product-row compact" key={item.id}>
          <div className="product-list">
            <ProductHeading product={item} />
            {item.descripcion && <p className="muted">{item.descripcion}</p>}
            <div className="product-meta">
              <span>
                Stock: <strong>{item.cantidad_stock}</strong> {item.tipo_unidad}
              </span>
            </div>
            {!readOnly && (
              <div className="actions-row">
                <button className="button subtle" type="button" onClick={() => onEdit(item)}>
                  <Edit3 size={16} />
                  Editar
                </button>
                <button
                  className={`button ${item.activo ? "warn" : "mint"}`}
                  type="button"
                  onClick={() => onToggle(item)}
                >
                  <Power size={16} />
                  {item.activo ? "Suspender" : "Habilitar"}
                </button>
              </div>
            )}
          </div>

          {!readOnly && (
            <div className="stock-controls">
              <input
                aria-label={`Cantidad para sumar a ${item.nombre}`}
                type="number"
                min="1"
                step="1"
                value={stockInputs[item.id] ?? ""}
                onChange={(event) => onStockInputChange(item.id, event.target.value)}
                placeholder="+ cant."
              />
              <button className="button mint icon" type="button" onClick={() => onAddStock(item)}>
                <Plus size={18} />
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function ProductColumn({
  title,
  emptyText,
  items,
  onEdit,
  onToggle,
  readOnly
}: {
  title: string
  emptyText: string
  items: Product[]
  onEdit: (product: Product) => void
  onToggle: (product: Product) => void
  readOnly: boolean
}) {
  return (
    <section className="panel product-list">
      <div className="column-heading">
        <h2>{title}</h2>
        <span className="badge">{items.length}</span>
      </div>

      {items.length === 0 && <div className="empty-state">{emptyText}</div>}

      {items.map((item) => (
        <article className="product-row compact" key={item.id}>
          <div className="product-list">
            <ProductHeading product={item} />
            {item.descripcion && <p className="muted">{item.descripcion}</p>}
            <div className="product-meta">
              <span>{formatCurrency(item.precio)}</span>
              <span>{item.tipo_unidad}</span>
            </div>
            {!readOnly && (
              <div className="actions-row">
                <button className="button subtle" type="button" onClick={() => onEdit(item)}>
                  <Edit3 size={16} />
                  Editar
                </button>
                <button
                  className={`button ${item.activo ? "warn" : "mint"}`}
                  type="button"
                  onClick={() => onToggle(item)}
                >
                  <Power size={16} />
                  {item.activo ? "Suspender" : "Habilitar"}
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

function ProductHeading({ product }: { product: Product }) {
  return (
    <div className="product-name">
      <h3>{product.nombre}</h3>
      <span className={`badge ${product.activo ? "active" : "off"}`}>
        {product.activo ? "Activo" : "Suspendido"}
      </span>
    </div>
  )
}

function ProductModal({
  form,
  editing,
  saving,
  onClose,
  onSubmit,
  onChange
}: {
  form: ProductForm
  editing: boolean
  saving: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onChange: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void
}) {
  const isProduct = form.tipo_item === "producto"

  return (
    <ModalBackdrop>
      <form className="modal-panel form-grid" onSubmit={onSubmit}>
        <ModalHeader
          title={editing ? "Editar" : "Agregar"}
          description={isProduct ? "Producto de venta" : "Parte de inventario"}
          onClose={onClose}
        />

        <label className="check-row">
          <input
            type="checkbox"
            checked={isProduct}
            onChange={(event) =>
              onChange("tipo_item", event.target.checked ? "producto" : "inventario")
            }
          />
          <span>
            <strong>{isProduct ? "Producto" : "Inventario"}</strong>
            <small>{isProduct ? "Aparece en ventas" : "Maneja cantidades"}</small>
          </span>
        </label>

        <div className="field">
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            value={form.nombre}
            onChange={(event) => onChange("nombre", event.target.value)}
            placeholder={isProduct ? "Banana Split" : "Vasos 12 Oz"}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="descripcion">Descripcion</label>
          <textarea
            id="descripcion"
            value={form.descripcion}
            onChange={(event) => onChange("descripcion", event.target.value)}
            placeholder="Notas visibles para el equipo"
          />
        </div>

        <div className="inline-grid">
          {isProduct && (
            <div className="field">
              <label htmlFor="precio">Precio COP</label>
              <input
                id="precio"
                type="number"
                min="0"
                step="100"
                value={form.precio}
                onChange={(event) => onChange("precio", event.target.value)}
                placeholder="15000"
                required
              />
            </div>
          )}

          {!isProduct && (
            <div className="field">
              <label htmlFor="cantidad">Cantidad</label>
              <input
                id="cantidad"
                type="number"
                min="0"
                step="1"
                value={form.cantidad_stock}
                onChange={(event) => onChange("cantidad_stock", event.target.value)}
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="tipo">Tipo o unidad</label>
            <input
              id="tipo"
              value={form.tipo_unidad}
              onChange={(event) => onChange("tipo_unidad", event.target.value)}
              placeholder={isProduct ? "unidad" : "paquete, caja, unidad"}
              required
            />
          </div>
        </div>

        <button className="button primary" type="submit" disabled={saving}>
          <Check size={18} />
          {saving ? "Guardando..." : editing ? "Guardar cambios" : "Agregar"}
        </button>
      </form>
    </ModalBackdrop>
  )
}
