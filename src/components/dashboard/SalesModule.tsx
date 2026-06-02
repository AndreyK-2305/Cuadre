"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Minus,
  PackageSearch,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Trash2,
  X
} from "lucide-react"
import { formatCurrency, saleLabel } from "@/lib/format"
import { supabase } from "@/lib/supabase/client"
import type { CartItem, Product, RegisterSaleResult } from "@/types/app"

type MobileCartState = {
  quantity: number
  total: number
  hasItems: boolean
}

type SalesModuleProps = {
  refreshSignal: number
  cartOpenSignal?: number
  onCartStateChange?: (state: MobileCartState) => void
  onSaleCompleted: () => void
}

const quickCashValues = [2000, 5000, 10000, 20000, 50000, 100000]

export function SalesModule({
  refreshSignal,
  cartOpenSignal = 0,
  onCartStateChange,
  onSaleCompleted
}: SalesModuleProps) {
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
  const lowStockCount = useMemo(
    () => products.filter((product) => product.cantidad_stock > 0 && product.cantidad_stock <= 5).length,
    [products]
  )

  const visibleProductsLabel = search.trim()
    ? `${filteredProducts.length} resultados`
    : `${filteredProducts.length} disponibles`

  const change = Math.max(cashReceived - cartTotal, 0)
  const canCharge = cart.length > 0 && cashReceived >= cartTotal && !saving

  useEffect(() => {
    onCartStateChange?.({
      quantity: cartQuantity,
      total: cartTotal,
      hasItems: cart.length > 0
    })
  }, [cart.length, cartQuantity, cartTotal, onCartStateChange])

  useEffect(() => {
    if (cartOpenSignal > 0 && cart.length > 0) {
      setIsCheckoutOpen(true)
    }
  }, [cart.length, cartOpenSignal])

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
    <div className={`module sales-module ${cart.length > 0 ? "has-mobile-cart" : ""}`}>
      <section className="sales-command sales-command-compact" aria-label="Datos utiles para vender">
        <div className="sales-insights" aria-label="Resumen de inventario para vender">
          <div className="insight-card">
            <ShoppingBag size={18} aria-hidden="true" />
            <span>Catalogo</span>
            <strong>{products.length}</strong>
            <small>{visibleProductsLabel}</small>
          </div>
          <div className="insight-card warn">
            <PackageSearch size={18} aria-hidden="true" />
            <span>Stock bajo</span>
            <strong>{lowStockCount}</strong>
            <small>{lowStockCount === 1 ? "producto por revisar" : "productos por revisar"}</small>
          </div>
        </div>

        <label className="search-box desktop-sales-search" htmlFor="buscar-venta-escritorio">
          <Search size={18} aria-hidden="true" />
          <input
            id="buscar-venta-escritorio"
            className="search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto o unidad"
          />
        </label>
      </section>

      {error && <div className="alert">{error}</div>}
      {receipt && (
        <div className="notice">
          {saleLabel(receipt.folio_diario, receipt.fecha_dia)} guardada por {" "}
          {formatCurrency(receipt.total)}. Cambio: {formatCurrency(receipt.cambio)}.
        </div>
      )}

      <div className="sales-layout">
        <section className="panel product-list" aria-label="Catalogo de productos para vender">
          <div className="catalog-header mobile-catalog-header">
            <div>
              <span className="module-kicker">Catalogo activo</span>
              <h2 id="catalogo-heading">Productos para vender</h2>
              <p>{visibleProductsLabel}</p>
            </div>

            <label className="search-box" htmlFor="buscar-venta-movil">
              <Search size={18} aria-hidden="true" />
              <input
                id="buscar-venta-movil"
                className="search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto o unidad"
              />
            </label>
          </div>

          {loading && <div className="empty-state">Cargando productos activos...</div>}
          {!loading && filteredProducts.length === 0 && (
            <div className="empty-state">No hay productos activos para vender.</div>
          )}

          <div className="product-sale-grid">
            {!loading &&
              filteredProducts.map((product) => {
                const stockState =
                  product.cantidad_stock <= 0 ? "off" : product.cantidad_stock <= 5 ? "low" : "active"
                const stockLabel =
                  product.cantidad_stock <= 0
                    ? "Sin stock"
                    : product.cantidad_stock <= 5
                      ? "Stock bajo"
                      : "Disponible"

                return (
                  <article className="sale-card" key={product.id}>
                    <div className="sale-card-topline">
                      <span className={`stock-badge ${stockState}`}>{stockLabel}</span>
                      <span className="muted">{product.cantidad_stock} en stock</span>
                    </div>

                    <div className="product-name">
                      <h3>{product.nombre}</h3>
                      <p className="muted">{product.descripcion || product.tipo_unidad}</p>
                    </div>

                    <footer>
                      <div>
                        <strong>{formatCurrency(product.precio)}</strong>
                        <div className="muted">por {product.tipo_unidad}</div>
                      </div>
                      <button
                        className="button primary add-sale-button"
                        type="button"
                        onClick={() => addToCart(product)}
                        title={`Agregar ${product.nombre}`}
                      >
                        <Plus size={18} />
                        Agregar
                      </button>
                    </footer>
                  </article>
                )
              })}
          </div>
        </section>

        <aside className="panel cart-panel" aria-labelledby="venta-actual-heading">
          <div className="section-title cart-title-row">
            <div>
              <span className="module-kicker">Caja</span>
              <h2 id="venta-actual-heading">Venta actual</h2>
              <p>{cart.length === 0 ? "Agrega productos para cobrar." : "Resumen listo para pago."}</p>
            </div>
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

          {cart.length === 0 && (
            <div className="cart-empty-state">
              <ReceiptText size={24} />
              <strong>Sin productos todavia</strong>
              <span>Elige un producto del catalogo para iniciar la venta.</span>
            </div>
          )}

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

          <div className="actions-row cart-actions-row">
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

      {cart.length > 0 && (
        <div className="mobile-sale-bar" role="region" aria-label="Venta actual">
          <div>
            <span>{cartQuantity} unidades</span>
            <strong>{formatCurrency(cartTotal)}</strong>
          </div>
          <button className="button mint" type="button" onClick={() => setIsCheckoutOpen(true)}>
            <ReceiptText size={18} />
            Proceder al pago
          </button>
        </div>
      )}

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
                      {formatCurrency(item.product.precio)} x {item.quantity} = {" "}
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

              <button
                className="button mint checkout-charge-main"
                type="button"
                onClick={onCharge}
                disabled={!canCharge}
              >
                {saving ? <ReceiptText size={18} /> : <CheckCircle2 size={18} />}
                {saving ? "Guardando..." : "Cobrar y guardar venta"}
              </button>
            </div>
          </aside>
        </div>

        <div className="checkout-mobile-footer">
          <div>
            <span>Total</span>
            <strong>{formatCurrency(cartTotal)}</strong>
          </div>
          <button className="button mint" type="button" onClick={onCharge} disabled={!canCharge}>
            {saving ? <ReceiptText size={18} /> : <CheckCircle2 size={18} />}
            {saving ? "Guardando..." : "Cobrar y guardar"}
          </button>
        </div>
      </section>
    </div>
  )
}
