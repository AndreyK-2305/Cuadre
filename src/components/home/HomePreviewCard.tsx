import { ReceiptText } from "lucide-react"

const previewProducts = [
  ["Café especial", "$18.000", "Listo"],
  ["Brownie cacao", "$9.000", "Listo"],
  ["Pan artesanal", "$12.000", "Bajo stock"]
]

export function HomePreviewCard() {
  return (
    <aside className="landing-product-card" aria-label="Vista previa del panel Cuadre">
      <div className="landing-product-card-top">
        <span className="landing-product-card-dot" />
        <div>
          <strong>Ventas</strong>
          <small>Hoy - caja activa</small>
        </div>
        <b>$156.000</b>
      </div>
      <div className="landing-product-metrics">
        <div>
          <span>Catálogo</span>
          <strong>34</strong>
        </div>
        <div>
          <span>Stock bajo</span>
          <strong>4</strong>
        </div>
      </div>
      <div className="landing-product-list">
        {previewProducts.map(([name, price, state]) => (
          <div key={name}>
            <span>
              <strong>{name}</strong>
              <small>{state}</small>
            </span>
            <b>{price}</b>
          </div>
        ))}
      </div>
      <div className="landing-product-checkout">
        <span>
          <ReceiptText size={17} /> Venta en curso
        </span>
        <strong>5 unidades</strong>
      </div>
    </aside>
  )
}
