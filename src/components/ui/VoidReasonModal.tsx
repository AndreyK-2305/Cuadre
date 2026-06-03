"use client"

import { FormEvent, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { ModalBackdrop, ModalHeader } from "@/components/ui/Modal"

type VoidReasonModalProps = {
  title: string
  description: string
  confirmLabel: string
  saving: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void> | void
}

export function VoidReasonModal({
  title,
  description,
  confirmLabel,
  saving,
  onClose,
  onConfirm
}: VoidReasonModalProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanReason = reason.trim()

    if (!cleanReason) {
      setError("El motivo es obligatorio para conservar la auditoria.")
      return
    }

    setError("")
    await onConfirm(cleanReason)
  }

  return (
    <ModalBackdrop>
      <form className="modal-panel form-grid" onSubmit={handleSubmit}>
        <ModalHeader title={title} description={description} onClose={onClose} />

        {error && <div className="alert">{error}</div>}

        <div className="notice">
          <AlertTriangle size={18} aria-hidden="true" />
          Este registro no se borrara del sistema, solo dejara de contar en reportes activos.
        </div>

        <div className="field">
          <label htmlFor="void-reason">Motivo de anulacion</label>
          <textarea
            id="void-reason"
            minLength={4}
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ejemplo: venta registrada por error o gasto duplicado"
            required
          />
        </div>

        <div className="actions-row">
          <button className="button subtle" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="button danger" type="submit" disabled={saving}>
            {saving ? "Anulando..." : confirmLabel}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  )
}
