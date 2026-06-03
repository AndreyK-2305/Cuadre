"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  MessageCircle,
  PhoneCall,
  XCircle,
} from "lucide-react"
import { buildPlanWhatsappHref, defaultPublicPlanName, getPublicPlan, publicPlans } from "@/lib/plans"
import { HomeSectionHeading } from "./HomeSectionHeading"

export function HomeSalesExperience({ children }: { children: ReactNode }) {
  const [selectedPlanName, setSelectedPlanName] = useState(defaultPublicPlanName)
  const selectedPlan = getPublicPlan(selectedPlanName)
  const whatsappHref = useMemo(() => buildPlanWhatsappHref(selectedPlan.name), [selectedPlan.name])

  return (
    <>
      <section className="landing-band landing-plans" id="planes">
        <HomeSectionHeading
          eyebrow="Planes competitivos"
          title="Empieza con lo necesario y escala cuando el negocio lo pida."
          split
        >
          <p>
            Las opciones mantienen una promesa simple: ordenar la operación diaria y luego sumar
            reportes, histórico y acompañamiento según el tamaño del cliente.
          </p>
        </HomeSectionHeading>

        <div className="pricing-grid" role="radiogroup" aria-label="Selecciona un plan">
          {publicPlans.map((plan) => {
            const isSelected = plan.name === selectedPlan.name

            return (
              <article
                className={`pricing-card ${plan.featured ? "featured" : ""} ${isSelected ? "is-selected" : ""} ${plan.hideOnMobile ? "is-mobile-hidden" : ""}`}
                key={plan.name}
              >
                {plan.featured ? <span className="plan-badge">Recomendado</span> : null}
                <button
                  aria-checked={isSelected}
                  className="pricing-card-select"
                  onClick={() => setSelectedPlanName(plan.name)}
                  role="radio"
                  type="button"
                >
                  <span className="pricing-card-summary">
                    <span className="pricing-card-title-row">
                      <h3>{plan.name}</h3>
                      <CheckCircle2 className="pricing-selection-mark" size={19} aria-hidden="true" />
                    </span>
                    <strong>{plan.price}</strong>
                    <p>{plan.caption}</p>
                  </span>
                </button>
                <ul className="pricing-desktop-features">
                  {plan.features.map((feature) => {
                    const Icon = feature.included ? CheckCircle2 : XCircle

                    return (
                      <li className={feature.included ? "" : "is-unavailable"} key={feature.label}>
                        <Icon size={17} aria-hidden="true" />
                        <span>{feature.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </article>
            )
          })}
        </div>

        <div className="pricing-mobile-details" aria-live="polite">
          <div className="pricing-mobile-details-heading">
            <span>
              <small>Plan seleccionado</small>
              <strong>{selectedPlan.name}</strong>
            </span>
            <b>{selectedPlan.price}</b>
          </div>
          <p>{selectedPlan.caption}</p>
          <ul>
            {selectedPlan.features.map((feature) => {
              const Icon = feature.included ? CheckCircle2 : XCircle

              return (
                <li className={feature.included ? "" : "is-unavailable"} key={feature.label}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{feature.label}</span>
                </li>
              )
            })}
          </ul>
          <a className="button gold" href={whatsappHref} target="_blank" rel="noreferrer">
            Consultar este plan
            <MessageCircle size={17} aria-hidden="true" />
          </a>
        </div>
      </section>

      {children}

      <footer className="landing-footer" id="nosotros">
        <div className="landing-footer-main">
          <div className="landing-footer-about">
            <Link className="landing-footer-brand" href="/home">
              <img src="/img/cuadreapp.png" alt="Logo de Cuadre" />
              <span>
                <strong>Cuadre</strong>
                <small>Operaciones comerciales</small>
              </span>
            </Link>
            <p>
              Somos un equipo pequeño que disfruta convertir tareas repetitivas en herramientas
              claras. Creamos Cuadre para que administrar un negocio se sienta más cercano, menos
              pesado y listo para crecer con cada emprendimiento.
            </p>
            <span className="landing-footer-note">
              <HeartHandshake size={17} aria-hidden="true" />
              Hecho pensando en negocios que avanzan paso a paso.
            </span>
          </div>

          <div className="landing-footer-column">
            <strong>Explora</strong>
            <a href="#flujo">Cómo funciona</a>
            <a href="#planes">Planes</a>
            <Link href="/login">Acceso al panel</Link>
          </div>

          <div className="landing-footer-column landing-footer-contact">
            <strong>Hablemos</strong>
            <p>Cuéntanos qué vendes y qué necesitas ordenar primero.</p>
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle size={17} aria-hidden="true" />
              Consultar plan {selectedPlan.name}
            </a>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} Cuadre. Una base flexible para pequeños negocios.</span>
          <Link href="/login">
            Entrar a Cuadre
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </footer>

      <span className="landing-page-end-sentinel" id="page-end" aria-hidden="true" />

      <a className="whatsapp-sales-card" href={whatsappHref} target="_blank" rel="noreferrer">
        <span className="whatsapp-sales-note">Para cualquier pregunta adicional, estamos aquí.</span>
        <span className="whatsapp-sales-box">
          <span className="whatsapp-sales-icon">
            <PhoneCall size={28} />
          </span>
          <span className="whatsapp-sales-copy">
            <strong>Contactar con ventas</strong>
            <span>Consultar plan {selectedPlan.name}</span>
          </span>
          <MessageCircle className="whatsapp-sales-mark" size={18} />
        </span>
      </a>
    </>
  )
}
