import Link from "next/link"
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  TrendingUp
} from "lucide-react"
import { HomeNav } from "@/components/home/HomeNav"
import { HomeSalesExperience } from "@/components/home/HomeSalesExperience"

const modules = [
  {
    title: "Ventas rápidas",
    text: "Registra cobros con catálogo visible, caja clara y menos pasos en mostrador.",
    icon: ShoppingCart
  },
  {
    title: "Inventario al día",
    text: "Ubica existencias, detecta bajo stock y evita vender productos agotados.",
    icon: Boxes
  },
  {
    title: "Reportes útiles",
    text: "Lee resultados por periodo y prepara decisiones sin hojas sueltas.",
    icon: FileText
  }
]

const adoptionAdvantages = [
  {
    title: "Empieza gratis",
    text: "Registra hasta 10 productos y valida el flujo antes de asumir un costo mensual.",
    icon: BadgeDollarSign
  },
  {
    title: "Paga por lo que usas",
    text: "Elige un plan según tus reportes e historial, sin comprar un sistema sobredimensionado.",
    icon: SlidersHorizontal
  },
  {
    title: "Acompañamiento cercano",
    text: "Conversa por WhatsApp cuando necesites orientación para dar el siguiente paso.",
    icon: MessageCircle
  }
]

export default function Home() {
  return (
    <main className="landing-page">
      <HomeNav />

      <section className="landing-hero">
        <div className="landing-glow landing-glow-left" aria-hidden="true" />
        <div className="landing-glow landing-glow-right" aria-hidden="true" />

        <div className="landing-hero-grid">
          <div className="landing-hero-content">
            <span className="landing-eyebrow">Punto de venta e inventario para equipos pequeños</span>
            <h1>La entrada simple para vender, controlar stock y cerrar el día.</h1>
            <p>
              Cuadre reúne ventas, inventario y reportes en una experiencia operativa pensada para
              negocios que necesitan orden sin cargar con un software pesado.
            </p>
            <div className="landing-actions">
              <Link className="button gold" href="/login">
                Entrar al panel
                <ArrowRight size={18} />
              </Link>
              <a className="button ghost" href="#flujo">
                Ver cómo funciona
              </a>
            </div>
            <div className="landing-trust-row" aria-label="Beneficios principales">
              <span><ShieldCheck size={16} /> Acceso con correo autorizado</span>
              <span><Smartphone size={16} /> Listo para móvil</span>
            </div>
          </div>

          <aside className="landing-product-card" aria-label="Vista previa del panel Cuadre">
            <div className="product-card-top">
              <span className="product-card-dot" />
              <div>
                <strong>Ventas</strong>
                <small>Hoy · caja activa</small>
              </div>
              <b>$156.000</b>
            </div>
            <div className="product-metrics">
              <div>
                <span>Catálogo</span>
                <strong>34</strong>
              </div>
              <div>
                <span>Stock bajo</span>
                <strong>4</strong>
              </div>
            </div>
            <div className="product-list">
              {[
                ["Café especial", "$18.000", "Listo"],
                ["Brownie cacao", "$9.000", "Listo"],
                ["Pan artesanal", "$12.000", "Bajo stock"]
              ].map(([name, price, state]) => (
                <div key={name}>
                  <span>
                    <strong>{name}</strong>
                    <small>{state}</small>
                  </span>
                  <b>{price}</b>
                </div>
              ))}
            </div>
            <div className="product-checkout">
              <span><ReceiptText size={17} /> Venta en curso</span>
              <strong>5 unidades</strong>
            </div>
          </aside>
        </div>
      </section>

      <section className="landing-band landing-intro" id="flujo">
        <div className="landing-section-heading">
          <span className="landing-eyebrow">Tecnología al alcance</span>
          <h2>Digitaliza tu negocio sin instalaciones ni inversiones costosas.</h2>
          <p>
            Cuadre funciona desde el navegador: abre sesión desde tu celular, computador o tableta
            y empieza con lo que necesitas hoy. Sin equipos especiales ni una implementación pesada
            para dar el siguiente paso.
          </p>
        </div>

        <div className="adoption-strip" aria-label="Ventajas para empezar con Cuadre">
          {adoptionAdvantages.map((advantage) => {
            const Icon = advantage.icon

            return (
              <article className="adoption-card" key={advantage.title}>
                <span>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div>
                  <strong>{advantage.title}</strong>
                  <p>{advantage.text}</p>
                </div>
              </article>
            )
          })}
        </div>

        <div className="benefit-grid">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <article className="benefit-card" key={module.title}>
                <Icon size={24} />
                <h3>{module.title}</h3>
                <p>{module.text}</p>
              </article>
            )
          })}
        </div>
      </section>

      <HomeSalesExperience>
        <section className="landing-band landing-proof">
          <div className="proof-panel">
            <div>
              <span className="landing-eyebrow">Preparado para crecer</span>
              <h2>Una base comercial flexible, no una plantilla amarrada a un solo negocio.</h2>
            </div>
            <div className="proof-grid">
              <div>
                <ClipboardList size={24} />
                <strong>Configuración por cliente</strong>
                <span>Lenguaje y límites listos para adaptarse a cada operación.</span>
              </div>
              <div>
                <BarChart3 size={24} />
                <strong>Lectura accionable</strong>
                <span>Indicadores simples para actuar rápido sin sobrecargar al usuario.</span>
              </div>
              <div>
                <TrendingUp size={24} />
                <strong>Ruta de planes</strong>
                <span>La experiencia puede crecer hacia reportes, histórico e integraciones.</span>
              </div>
            </div>
          </div>
        </section>
      </HomeSalesExperience>
    </main>
  )
}
