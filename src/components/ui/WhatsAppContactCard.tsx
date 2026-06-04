import { MessageCircle, PhoneCall } from "lucide-react"

type WhatsAppContactCardProps = {
  href: string
  note: string
  title: string
  subtitle: string
}

export function WhatsAppContactCard({ href, note, title, subtitle }: WhatsAppContactCardProps) {
  return (
    <a className="whatsapp-sales-card" href={href} target="_blank" rel="noreferrer">
      <span className="whatsapp-sales-note">{note}</span>
      <span className="whatsapp-sales-box">
        <span className="whatsapp-sales-icon">
          <PhoneCall size={28} />
        </span>
        <span className="whatsapp-sales-copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </span>
        <MessageCircle className="whatsapp-sales-mark" size={18} />
      </span>
    </a>
  )
}
