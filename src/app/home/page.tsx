import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileText,
  LogIn,
  MessageCircle,
  PhoneCall,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  TrendingUp
} from "lucide-react"

const activationHref = "/login"

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

const plans = [
  {
    name: "Gratis",
    price: "$0",
    caption: "Para validar el flujo con un catálogo pequeño.",
    features: ["Hasta 10 productos", "Ventas del día", "Inventario base", "Incluye anuncios"]
  },
  {
    name: "Básico",
    price: "$20.000 COP",
    caption: "Para negocios que ya necesitan operar sin límite de productos.",
    featured: true,
    features: ["Inventario ilimitado", "Reportes semanales", "2 descargas PDF", "Soporte de arranque"]
  },
  {
    name: "Lite",
    price: "$30.000 COP",
    caption: "Para equipos que consultan y descargan reportes con frecuencia.",
    features: ["Todo lo del Básico", "PDF ilimitados", "Consulta hasta 1 mes", "Mejor lectura de caja"]
  },
  {
    name: "Emprendedor",
    price: "A medida",
    caption: "Para negocios que necesitan histórico, gráficos e implementación guiada.",
    features: ["Historial global", "Métricas avanzadas", "Productos destacados", "Acompañamiento"]
  }
]

const workflow = [
  "Abre sesión con tu correo autorizado",
  "Registra ventas desde el catálogo",
  "Revisa stock bajo y reportes clave"
]

export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-glow landing-glow-left" aria-hidden="true" />
        <div className="landing-glow landing-glow-right" aria-hidden="true" />

        <nav className="landing-nav" aria-label="Navegación principal">
          <Link className="landing-brand" href="/home">
            <img src="/img/logo.png" alt="Logo de Cuadre" />
            <span>
              <strong>Cuadre</strong>
              <small>Operaciones comerciales</small>
            </span>
          </Link>
          <div className="landing-nav-actions">
            <a className="landing-nav-link" href="#planes">Planes</a>
            <Link className="button landing-login" href="/login">
              <LogIn size={17} />
              Acceder
            </Link>
          </div>
        </nav>

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
          <span className="landing-eyebrow">Operación diaria</span>
          <h2>Todo empieza en un flujo claro: vender, revisar y decidir.</h2>
          <p>
            La página inicial presenta Cuadre como una herramienta de uso real, conectada con el
            dashboard optimizado para ventas, sesión segura y navegación móvil.
          </p>
        </div>

        <div className="workflow-strip" aria-label="Flujo de uso">
          {workflow.map((step, index) => (
            <div className="workflow-step" key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
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

      <section className="landing-band landing-plans" id="planes">
        <div className="landing-section-heading split">
          <div>
            <span className="landing-eyebrow">Planes competitivos</span>
            <h2>Empieza con lo necesario y escala cuando el negocio lo pida.</h2>
          </div>
          <p>
            Las opciones mantienen una promesa simple: ordenar la operación diaria y luego sumar
            reportes, histórico y acompañamiento según el tamaño del cliente.
          </p>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`pricing-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
              {plan.featured ? <span className="plan-badge">Recomendado</span> : null}
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

      <Link className="whatsapp-sales-card" href={activationHref}>
        <span className="whatsapp-sales-note">¿Ya tienes acceso autorizado?</span>
        <span className="whatsapp-sales-box">
          <span className="whatsapp-sales-icon">
            <PhoneCall size={28} />
          </span>
          <span className="whatsapp-sales-copy">
            <strong>Entrar a Cuadre</strong>
            <span>Acceso seguro</span>
            <b>Usa tu correo autorizado</b>
          </span>
          <MessageCircle className="whatsapp-sales-mark" size={18} />
        </span>
      </Link>
    </main>
  )
}
