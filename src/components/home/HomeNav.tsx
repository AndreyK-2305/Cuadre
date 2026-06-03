"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LogIn } from "lucide-react"

export function HomeNav() {
  const [isPageEndVisible, setIsPageEndVisible] = useState(false)

  useEffect(() => {
    const pageEnd = document.querySelector("#page-end")
    if (!pageEnd) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsPageEndVisible(entry.isIntersecting)
      },
      { threshold: 0.6 }
    )

    observer.observe(pageEnd)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`landing-nav-dock ${isPageEndVisible ? "is-page-end-visible" : ""}`}>
      <nav className="landing-nav" aria-label="Navegación principal">
        <Link className="landing-brand" href="/home">
          <img src="/img/cuadreapp.png" alt="Logo de Cuadre" />
          <span>
            <strong>Cuadre</strong>
            <small>Operaciones comerciales</small>
          </span>
        </Link>
        <div className="landing-nav-actions">
          <a className="landing-nav-link" href="#planes">Planes</a>
          <a className="landing-nav-link" href="#nosotros">Nosotros</a>
          <Link className="button landing-login" href="/login">
            <LogIn size={17} />
            Acceder
          </Link>
        </div>
      </nav>
    </div>
  )
}
