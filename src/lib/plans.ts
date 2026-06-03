export type PlanFeature = {
  label: string
  included: boolean
}

export type PublicPlan = {
  name: string
  price: string
  caption: string
  features: PlanFeature[]
  featured?: boolean
  hideOnMobile?: boolean
}

export const defaultPublicPlanName = "Completo"

export const salesWhatsappPhone = "573000000000"

export const publicPlans: PublicPlan[] = [
  {
    name: "Gratis",
    price: "$0",
    caption: "Para validar el flujo con un catálogo pequeño.",
    hideOnMobile: true,
    features: [
      { label: "Hasta 10 productos", included: true },
      { label: "Estado de ventas del día", included: true },
      { label: "Descargas PDF", included: false },
      { label: "Historial ampliado", included: false },
      { label: "Estadísticas avanzadas", included: false },
      { label: "Incluye anuncios", included: false }
    ]
  },
  {
    name: "Básico",
    price: "$19.000 COP",
    caption: "Para negocios que ya necesitan operar sin límite de productos.",
    features: [
      { label: "Inventario ilimitado", included: true },
      { label: "Reportes semanales", included: true },
      { label: "Hasta 2 descargas PDF", included: true },
      { label: "Sin anuncios", included: true },
      { label: "Historial superior a 1 semana", included: false },
      { label: "Estadísticas avanzadas", included: false }
    ]
  },
  {
    name: "Completo",
    price: "$29.000 COP",
    caption: "Para equipos que consultan y descargan reportes con frecuencia.",
    featured: true,
    features: [
      { label: "Inventario ilimitado", included: true },
      { label: "Consulta web hasta 1 mes", included: true },
      { label: "Descargas PDF ilimitadas", included: true },
      { label: "Sin anuncios", included: true },
      { label: "Historial global", included: false },
      { label: "Estadísticas avanzadas", included: false }
    ]
  },
  {
    name: "Emprendedor",
    price: "A medida",
    caption: "Para negocios que necesitan histórico, gráficos e implementación guiada.",
    features: [
      { label: "Inventario ilimitado", included: true },
      { label: "Historial global", included: true },
      { label: "Descargas PDF ilimitadas", included: true },
      { label: "Sin anuncios", included: true },
      { label: "Estadísticas avanzadas", included: true },
      { label: "Gráficos de productos", included: true },
      { label: "Acompañamiento personalizado", included: true }
    ]
  }
]

export function getPublicPlan(name: string) {
  return (
    publicPlans.find((plan) => plan.name === name) ??
    publicPlans.find((plan) => plan.name === defaultPublicPlanName) ??
    publicPlans[0]
  )
}

export function buildPlanWhatsappHref(planName: string) {
  const message = `Hola, estoy interesado en el plan ${planName} de Cuadre. ¿Podrías darme más información?`
  return `https://wa.me/${salesWhatsappPhone}?text=${encodeURIComponent(message)}`
}
