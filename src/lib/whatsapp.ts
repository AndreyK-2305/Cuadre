import { salesWhatsappPhone } from "@/lib/plans"

export function buildLoginWhatsappHref(email: string) {
  const normalizedEmail = email.trim()

  const message = normalizedEmail
    ? `Hola, estoy interesado en registrar mi negocio y el correo con el que trato de ingresar es ${normalizedEmail}.`
    : "Hola, estoy interesado en registrar mi negocio y quisiera solicitar activacion de cuenta."

  return `https://wa.me/${salesWhatsappPhone}?text=${encodeURIComponent(message)}`
}
