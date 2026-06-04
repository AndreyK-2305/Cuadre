"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type CSSProperties } from "react"

const mobileDesignSrc = encodeURI("/img/Dise\u00f1o movil.png")
const desktopDesignSrc = encodeURI("/img/Dise\u00f1o escritorio.png")

export function HomeMobileShowcase() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const section = sectionRef.current

    if (!section || typeof window === "undefined") {
      return
    }

    const thresholds = Array.from({ length: 21 }, (_, index) => index / 20)
    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextProgress = Math.max(0, Math.min(1, entry.intersectionRatio))
        setProgress(nextProgress)
      },
      {
        threshold: thresholds,
        rootMargin: "0px 0px -10% 0px"
      }
    )

    observer.observe(section)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <section className="landing-band landing-showcase" ref={sectionRef}>
      <div
        className="landing-showcase-frame"
        style={{ "--reveal-progress": progress.toFixed(3) } as CSSProperties}
      >
        <div className="landing-showcase-image-wrap landing-showcase-image-wrap-mobile">
          <Image
            className="landing-showcase-image"
            src={mobileDesignSrc}
            alt="Vista movil de Cuadre"
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1200px) 56vw, 460px"
            priority={false}
          />
        </div>
        <div className="landing-showcase-image-wrap landing-showcase-image-wrap-desktop">
          <Image
            className="landing-showcase-image landing-showcase-image-desktop"
            src={desktopDesignSrc}
            alt="Vista de escritorio de Cuadre"
            fill
            sizes="(min-width: 981px) 720px, 100vw"
            priority={false}
          />
        </div>
      </div>
    </section>
  )
}
