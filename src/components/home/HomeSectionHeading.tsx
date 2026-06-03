import type { ReactNode } from "react"

type HomeSectionHeadingProps = {
  eyebrow: string
  title: string
  children?: ReactNode
  split?: boolean
}

export function HomeSectionHeading({ eyebrow, title, children, split = false }: HomeSectionHeadingProps) {
  if (split) {
    return (
      <div className="landing-section-heading split">
        <div>
          <span className="landing-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="landing-section-heading">
      <span className="landing-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {children}
    </div>
  )
}
