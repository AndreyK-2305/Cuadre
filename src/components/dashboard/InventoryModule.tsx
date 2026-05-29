"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Check, Edit3, Plus, Power, Search, X } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { supabase } from "@/lib/supabase/client"
import type { Product } from "@/types/app"

type InventoryModuleProps = {
  onChanged: () => void
}

type ProductForm = {
  nombre: string
  descripcion: string
  tipo_item: Product["tipo_item"]
  precio: string
  cantidad_stock: string
  tipo_unidad: string
}

const emptyForm: ProductForm = {
  nombre: "",
  descripcion: "",
  tipo_item: "producto",
  precio: "",
  cantidad_stock: "0",
  tipo_unidad: "unidad"
}

export function InventoryModule({ onChanged }: InventoryModuleProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: loadError } = await supabase
      .from("productos")
      .select("*")
      .order("nombre", { ascending: true })

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
    const term = search.trim().toLowerCase()
    if (!term) return products

    return products.filter((product) => {
      const haystack = `${product.nombre} ${product.descripcion ?? ""} ${product.tipo_unidad}`
      return haystack.toLowerCase().includes(term)
    })
  }, [products, search])

  const saleProducts = filteredProducts.filter((product) => product.tipo_item === "producto")
  const inventoryItems = filteredProducts.filter((product) => product.tipo_item === "inventario")

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
    setForm(emptyForm)
    setEditingId(null)
    setIsModalOpen(false)
  }

  function openCreateModal() {
    setError("")
    setNotice("")
    setForm(emptyForm)
    setEditingId(null)
    setIsModalOpen(true)
  }

  function editProduct(product: Product) {
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
    tipo_movimiento: "entrada" | "ajuste" | "deshabilitado",
    cantidad: number,
    stock_antes: number,
    stock_despues: number,
    nota: string
  ) {
    const { error: movementError } = await supabase.from("movimientos_inventario").insert({
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
    setSaving(true)
    setError("")
    setNotice("")

    const isInventoryItem = form.tipo_item === "inventario"
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      tipo_item: form.tipo_item,
      precio: isInventoryItem ? 0 : Number(form.precio),
      cantidad_stock: isInventoryItem ? Number(form.cantidad_stock) : 0,
      tipo_unidad: form.tipo_unidad.trim() || "unidad"
    }

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
        const { data, error: updateError } = await supabase
          .from("productos")
          .update(payload)
          .eq("id", editingId)
          .select("*")
          .single()

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
        setNotice(updatedProduct.tipo_item === "producto" ? "Producto actualizado." : "Inventario actualizado.")
      } else {
        const { data, error: insertError } = await supabase
          .from("productos")
          .insert(payload)
          .select("*")
          .single()

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
        setNotice(createdProduct.tipo_item === "producto" ? "Producto creado." : "Inventario creado.")
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
    const amount = Number(stockInputs[product.id] ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresa una cantidad mayor a cero para sumar stock.")
      return
    }

    setError("")
    setNotice("")
    const nextStock = product.cantidad_stock + amount

    const { data, error: updateError } = await supabase
      .from("productos")
      .update({ cantidad_stock: nextStock })
      .eq("id", product.id)
      .select("*")
      .single()

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
    setError("")
    setNotice("")

    const { data, error: updateError } = await supabase
      .from("productos")
      .update({ activo: !product.activo })
      .eq("id", product.id)
      .select("*")
      .single()

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
      <div className="module-title">
        <div>
          <h2>Productos e inventario</h2>
          <p>Productos para vender separados de insumos, vasos, cucharas y otros inventarios.</p>
        </div>
        <button className="button primary" type="button" onClick={openCreateModal}>
          <Plus size={18} />
          Agregar
        </button>
      </div>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <section className="panel">
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
          />

          <ProductColumn
            title="Productos"
            emptyText="No hay productos de venta."
            items={saleProducts}
            onEdit={editProduct}
            onToggle={handleToggleProduct}
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
  onToggle
}: {
  title: string
  emptyText: string
  items: Product[]
  stockInputs: Record<string, string>
  onStockInputChange: (id: string, value: string) => void
  onAddStock: (product: Product) => void
  onEdit: (product: Product) => void
  onToggle: (product: Product) => void
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
          </div>

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
  onToggle
}: {
  title: string
  emptyText: string
  items: Product[]
  onEdit: (product: Product) => void
  onToggle: (product: Product) => void
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
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel form-grid" onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <h2>{editing ? "Editar" : "Agregar"}</h2>
            <p>{isProduct ? "Producto de venta" : "Parte de inventario"}</p>
          </div>
          <button className="button subtle icon" type="button" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

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
    </div>
  )
}
