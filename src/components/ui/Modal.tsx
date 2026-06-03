import { X } from "lucide-react"
import type { ReactNode } from "react"

type ModalBackdropProps = {
  children: ReactNode
}

type ModalHeaderProps = {
  title: string
  description?: ReactNode
  onClose: () => void
}

export function ModalBackdrop({ children }: ModalBackdropProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      {children}
    </div>
  )
}

export function ModalHeader({ title, description, onClose }: ModalHeaderProps) {
  return (
    <div className="modal-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <button className="button subtle icon" type="button" onClick={onClose} title="Cerrar">
        <X size={18} />
      </button>
    </div>
  )
}
