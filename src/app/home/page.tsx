import Link from "next/link"
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  MessageCircle,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  TrendingUp
} from "lucide-react"
import { HomeNav } from "@/components/home/HomeNav"
import { HomePreviewCard } from "@/components/home/HomePreviewCard"
import { HomeSalesExperience } from "@/components/home/HomeSalesExperience"
import { HomeSectionHeading } from "@/components/home/HomeSectionHeading"

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

          <HomePreviewCard />
        </div>
      </section>

      <section className="landing-band landing-intro" id="flujo">
        <HomeSectionHeading
          eyebrow="Tecnología al alcance"
          title="Digitaliza tu negocio sin instalaciones ni inversiones costosas."
        >
          <p>
            Cuadre funciona desde el navegador: abre sesión desde tu celular, computador o tableta
            y empieza con lo que necesitas hoy. Sin equipos especiales ni una implementación pesada
            para dar el siguiente paso.
          </p>
        </HomeSectionHeading>

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
              <HomeSectionHeading
                eyebrow="Preparado para crecer"
                title="Una base comercial flexible, no una plantilla amarrada a un solo negocio."
              />
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
