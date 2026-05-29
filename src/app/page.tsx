import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  FileText,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  TrendingUp
} from "lucide-react"

const benefits = [
  {
    title: "Inventario claro",
    text: "Registra productos, existencias y movimientos sin procesos pesados.",
    icon: Boxes
  },
  {
    title: "Ventas al dia",
    text: "Consulta lo vendido y toma mejores decisiones desde la rutina diaria.",
    icon: TrendingUp
  },
  {
    title: "Reportes utiles",
    text: "Descarga o revisa informes segun el plan, sin perder el control del negocio.",
    icon: FileText
  }
]

const plans = [
  {
    name: "Gratis",
    price: "$0",
    caption: "Para probar Cuadre en un inventario pequeno.",
    features: [
      "Hasta 10 productos",
      "Estado de ventas del dia",
      "Incluye anuncios",
      "Sin descarga de informes PDF"
    ]
  },
  {
    name: "Basico",
    price: "$20.000 COP",
    caption: "Para negocios que ya necesitan operar sin limite de productos.",
    featured: true,
    features: [
      "Inventario ilimitado",
      "Informes semanales desde la web",
      "Hasta 2 descargas PDF",
      "Base lista para crecer"
    ]
  },
  {
    name: "Lite",
    price: "$30.000 COP",
    caption: "Para equipos que consultan y descargan reportes con frecuencia.",
    features: [
      "Todo lo del plan Basico",
      "Descargas PDF ilimitadas",
      "Consulta web hasta 1 mes",
      "Mas libertad operativa"
    ]
  },
  {
    name: "Emprendedor",
    price: "A medida",
    caption: "Para negocios que quieren historico completo y lectura avanzada.",
    features: [
      "Historial global",
      "Descargas ilimitadas",
      "Estadisticas de interes",
      "Graficos y productos destacados"
    ]
  }
]

export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-nav" aria-label="Navegacion principal">
          <Link className="landing-brand" href="/">
            <img src="/img/logo.png" alt="Cuadre" />
            <span>Cuadre</span>
          </Link>
          <Link className="button landing-login" href="/login">
            <LogIn size={18} />
            Acceder
          </Link>
        </div>

        <div className="landing-hero-content">
          <span className="landing-eyebrow">Control simple para pequenos negocios</span>
          <h1>Ventas, inventario y reportes con precios pensados para emprender.</h1>
          <p>
            Cuadre ayuda a llevar el control diario del negocio sin herramientas costosas ni
            procesos complejos. Empieza con inventario basico y crece hacia reportes, graficos e
            integraciones segun tu operacion.
          </p>
          <div className="landing-actions">
            <Link className="button gold" href="/login">
              Acceder a Cuadre
              <ArrowRight size={18} />
            </Link>
            <a
              className="button ghost"
              href="https://wa.me/573000000000?text=Hola%2C%20quiero%20conocer%20Cuadre"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} />
              Contactarnos
            </a>
          </div>
        </div>
      </section>

      <section className="landing-band landing-intro">
        <div className="landing-section-heading">
          <span className="landing-eyebrow">Utilidad real</span>
          <h2>Una base comercial para vender, controlar y decidir mejor.</h2>
          <p>
            La primera version mantiene lo importante: inventario, ventas e informes. Desde ahi,
            Cuadre queda listo para adaptarse por planes, integraciones y necesidades de cada
            cliente.
          </p>
        </div>

        <div className="benefit-grid">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <article className="benefit-card" key={benefit.title}>
                <Icon size={24} />
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="landing-band landing-plans" id="planes">
        <div className="landing-section-heading">
          <span className="landing-eyebrow">Planes competitivos</span>
          <h2>Opciones para empezar barato y crecer con el negocio.</h2>
          <p>
            Cuadre se plantea como una alternativa accesible para emprendimientos que necesitan
            orden sin pagar herramientas sobredimensionadas.
          </p>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`pricing-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
              <div>
                <h3>{plan.name}</h3>
                <strong>{plan.price}</strong>
                <p>{plan.caption}</p>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <CheckCircle2 size={17} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-band landing-proof">
        <div className="proof-panel">
          <div>
            <span className="landing-eyebrow">Pensado para operar rapido</span>
            <h2>Menos friccion para equipos pequenos.</h2>
          </div>
          <div className="proof-grid">
            <div>
              <ShieldCheck size={24} />
              <strong>Control diario</strong>
              <span>Ventas, inventario y caja en una misma base.</span>
            </div>
            <div>
              <Smartphone size={24} />
              <strong>Ruta movil</strong>
              <span>Flujos preparados para vender desde pantallas pequenas.</span>
            </div>
            <div>
              <BarChart3 size={24} />
              <strong>Lectura de negocio</strong>
              <span>Reportes y estadisticas segun el nivel del plan.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-band landing-contact" id="contacto">
        <div className="landing-section-heading">
          <span className="landing-eyebrow">Contactanos</span>
          <h2>Hablemos de como Cuadre puede encajar en tu negocio.</h2>
          <p>
            Si tienes un emprendimiento o quieres adaptar Cuadre para un cliente, podemos revisar
            el flujo, el plan y los proximos ajustes.
          </p>
        </div>
        <a
          className="button gold"
          href="https://wa.me/573000000000?text=Hola%2C%20quiero%20conocer%20Cuadre"
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={18} />
          Escribir por WhatsApp
        </a>
      </section>
    </main>
  )
}
