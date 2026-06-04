"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type CSSProperties } from "react"

const mobileDesignSrc = "/img/Diseño%20movil.png"

export function HomeMobileShowcase() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let rafId = 0

    const updateProgress = () => {
      const section = sectionRef.current

      if (!section) {
        return
      }

      const rect = section.getBoundingClientRect()
      const viewportHeight = window.innerHeight || 1
      const start = viewportHeight * 0.88
      const end = -rect.height * 0.3
      const rawProgress = (start - rect.top) / (start - end)

      setProgress(Math.min(1, Math.max(0, rawProgress)))
    }

    const onScroll = () => {
      window.cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(updateProgress)
    }

    updateProgress()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    <section className="landing-band landing-showcase" ref={sectionRef}>
      <div
        className="landing-showcase-frame"
        style={{ "--reveal-progress": progress.toFixed(3) } as CSSProperties}
      >
        <div className="landing-showcase-glow" aria-hidden="true" />
        <div className="landing-showcase-fog" aria-hidden="true" />
        <div className="landing-showcase-image-wrap">
          <Image
            className="landing-showcase-image"
            src={mobileDesignSrc}
            alt="Vista movil de Cuadre"
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1200px) 56vw, 460px"
            priority={false}
          />
        </div>
      </div>
    </section>
  )
}
