"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Minus, Plus, ReceiptText, Search, Trash2, X } from "lucide-react"
import { formatCurrency, saleLabel } from "@/lib/format"
import { supabase } from "@/lib/supabase/client"
import type { CartItem, Product, RegisterSaleResult } from "@/types/app"

type SalesModuleProps = {
  refreshSignal: number
  onSaleCompleted: () => void
}

const quickCashValues = [2000, 5000, 10000, 20000, 50000, 100000]

export function SalesModule({ refreshSignal, onSaleCompleted }: SalesModuleProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [cashReceived, setCashReceived] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [receipt, setReceipt] = useState<RegisterSaleResult | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError("")

    const { data, error: loadError } = await supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .eq("tipo_item", "producto")
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
  }, [loadProducts, refreshSignal])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products

    return products.filter((product) => {
      const haystack = `${product.nombre} ${product.descripcion ?? ""} ${product.tipo_unidad}`
      return haystack.toLowerCase().includes(term)
    })
  }, [products, search])

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.precio * item.quantity, 0),
    [cart]
  )
  const cartQuantity = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])

  const change = Math.max(cashReceived - cartTotal, 0)
  const canCharge = cart.length > 0 && cashReceived >= cartTotal && !saving

  function addToCart(product: Product) {
    setReceipt(null)
    setError("")

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }

      return [...current, { product, quantity: 1 }]
    })
  }

  function decreaseItem(productId: string) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  function removeItem(productId: string) {
    setCart((current) => current.filter((item) => item.product.id !== productId))
  }

  function clearCart() {
    setCart([])
    setCashReceived(0)
    setIsCheckoutOpen(false)
  }

  async function handleCharge() {
    setSaving(true)
    setError("")
    setReceipt(null)

    const items = cart.map((item) => ({
      producto_id: item.product.id,
      cantidad: item.quantity
    }))

    const { data, error: saleError } = await supabase.rpc("registrar_venta", {
      p_items: items,
      p_dinero_recibido: cashReceived
    })

    setSaving(false)

    if (saleError) {
      setError(saleError.message)
      return
    }

    const result = data as RegisterSaleResult
    setReceipt(result)
    setCart([])
    setCashReceived(0)
    setIsCheckoutOpen(false)
    await loadProducts()
    onSaleCompleted()
  }

  return (
    <div className="module">
      <div className="module-title">
        <div>
          <h2>Carrito de venta</h2>
          <p>Selecciona productos activos, cobra en efectivo y registra la venta del dia.</p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {receipt && (
        <div className="notice">
          {saleLabel(receipt.folio_diario, receipt.fecha_dia)} guardada por{" "}
          {formatCurrency(receipt.total)}. Cambio: {formatCurrency(receipt.cambio)}.
        </div>
      )}

      <div className="sales-layout">
        <section className="panel product-list">
          <div className="field">
            <label htmlFor="buscar-venta">Buscar para vender</label>
            <div className="actions-row">
              <Search size={18} />
              <input
                id="buscar-venta"
                className="search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Producto o tipo"
              />
            </div>
          </div>

          {loading && <div className="empty-state">Cargando productos activos...</div>}
          {!loading && filteredProducts.length === 0 && (
            <div className="empty-state">No hay productos activos para vender.</div>
          )}

          <div className="product-sale-grid">
            {!loading &&
              filteredProducts.map((product) => {
                return (
                  <article className="sale-card" key={product.id}>
                    <div>
                      <div className="product-name">
                        <h3>{product.nombre}</h3>
                      </div>
                      <p className="muted">{product.descripcion || product.tipo_unidad}</p>
                    </div>

                    <footer>
                      <div>
                        <strong>{formatCurrency(product.precio)}</strong>
                        <div className="muted">{product.tipo_unidad}</div>
                      </div>
                      <button
                        className="button primary icon"
                        type="button"
                        onClick={() => addToCart(product)}
                        title={`Agregar ${product.nombre}`}
                      >
                        <Plus size={18} />
                      </button>
                    </footer>
                  </article>
                )
              })}
          </div>
        </section>

        <aside className="panel cart-panel">
          <div className="section-title">
            <h2>Venta actual</h2>
            <p>{cart.length === 0 ? "Agrega productos para cobrar." : "Resumen del carrito."}</p>
          </div>

          <div className="cart-summary">
            <div className="summary-stat">
              <span>Productos</span>
              <strong>{cart.length}</strong>
            </div>
            <div className="summary-stat">
              <span>Unidades</span>
              <strong>{cartQuantity}</strong>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>{formatCurrency(cartTotal)}</strong>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="cart-summary-list" aria-label="Resumen de productos en el carrito">
              {cart.map((item) => (
                <div className="summary-item" key={item.product.id}>
                  <span>{item.product.nombre}</span>
                  <strong>x{item.quantity}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="actions-row">
            <button
              className="button mint"
              type="button"
              onClick={() => setIsCheckoutOpen(true)}
              disabled={cart.length === 0}
            >
              <ReceiptText size={18} />
              Proceder al pago
            </button>
            {cart.length > 0 && (
              <button className="button subtle" type="button" onClick={clearCart}>
                Vaciar
              </button>
            )}
          </div>
        </aside>
      </div>

      {isCheckoutOpen && (
        <CheckoutModal
          cart={cart}
          cashReceived={cashReceived}
          cartTotal={cartTotal}
          change={change}
          saving={saving}
          canCharge={canCharge}
          onClose={() => setIsCheckoutOpen(false)}
          onAdd={addToCart}
          onDecrease={decreaseItem}
          onRemove={removeItem}
          onClear={clearCart}
          onCashChange={setCashReceived}
          onCharge={handleCharge}
        />
      )}
    </div>
  )
}

function CheckoutModal({
  cart,
  cashReceived,
  cartTotal,
  change,
  saving,
  canCharge,
  onClose,
  onAdd,
  onDecrease,
  onRemove,
  onClear,
  onCashChange,
  onCharge
}: {
  cart: CartItem[]
  cashReceived: number
  cartTotal: number
  change: number
  saving: boolean
  canCharge: boolean
  onClose: () => void
  onAdd: (product: Product) => void
  onDecrease: (productId: string) => void
  onRemove: (productId: string) => void
  onClear: () => void
  onCashChange: (value: number) => void
  onCharge: () => void
}) {
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel checkout-panel">
        <div className="modal-header">
          <div>
            <h2>Confirmar venta</h2>
            <p>
              {cart.length} productos · {cartQuantity} unidades
            </p>
          </div>
          <button className="button subtle icon" type="button" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="checkout-grid">
          <section className="checkout-details">
            <div className="section-title">
              <h2>Detalle</h2>
              <p>Revisa, ajusta o quita productos antes de cobrar.</p>
            </div>

            <div className="cart-list checkout-list">
              {cart.length === 0 && <div className="empty-state">El carrito esta vacio.</div>}
              {cart.map((item) => (
                <article className="cart-row" key={item.product.id}>
                  <div>
                    <h3>{item.product.nombre}</h3>
                    <p className="muted">
                      {formatCurrency(item.product.precio)} x {item.quantity} ={" "}
                      {formatCurrency(item.product.precio * item.quantity)}
                    </p>
                  </div>

                  <div className="cart-actions">
                    <button
                      className="button subtle icon"
                      type="button"
                      onClick={() => onDecrease(item.product.id)}
                      title="Restar unidad"
                    >
                      <Minus size={17} />
                    </button>
                    <div className="qty-box">{item.quantity}</div>
                    <button
                      className="button subtle icon"
                      type="button"
                      onClick={() => onAdd(item.product)}
                      title="Sumar unidad"
                    >
                      <Plus size={17} />
                    </button>
                    <button
                      className="button danger icon"
                      type="button"
                      onClick={() => onRemove(item.product.id)}
                      title="Quitar producto"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {cart.length > 0 && (
              <button className="button subtle" type="button" onClick={onClear}>
                Cancelar venta
              </button>
            )}
          </section>

          <aside className="checkout-calculator">
            <div className="section-title">
              <h2>Pago</h2>
              <p>Calcula recibido y cambio.</p>
            </div>

            <div className="totals">
              <div className="total-line">
                <span>Total</span>
                <strong>{formatCurrency(cartTotal)}</strong>
              </div>

              <div className="field">
                <label htmlFor="checkout-cash">Dinero recibido</label>
                <input
                  id="checkout-cash"
                  type="number"
                  min="0"
                  step="500"
                  value={cashReceived}
                  onChange={(event) => onCashChange(Number(event.target.value))}
                />
              </div>

              <div className="cash-buttons">
                {quickCashValues.map((value) => (
                  <button
                    className="button subtle"
                    key={value}
                    type="button"
                    onClick={() => onCashChange(cashReceived + value)}
                  >
                    {formatCurrency(value)}
                  </button>
                ))}
              </div>

              <div className="actions-row">
                <button className="button subtle" type="button" onClick={() => onCashChange(cartTotal)}>
                  Exacto
                </button>
                <button className="button subtle" type="button" onClick={() => onCashChange(0)}>
                  Limpiar
                </button>
              </div>

              <div className="total-line">
                <span>Cambio</span>
                <strong>{formatCurrency(change)}</strong>
              </div>

              <button className="button mint" type="button" onClick={onCharge} disabled={!canCharge}>
                {saving ? <ReceiptText size={18} /> : <CheckCircle2 size={18} />}
                {saving ? "Guardando..." : "Cobrar y guardar venta"}
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
