import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lockScroll, unlockScroll } from '../../lib/scrollLock'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  icon?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  danger,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // Lock background scroll while any dialog is open.
  useEffect(() => {
    if (open) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [open])

  if (!open) return null

  const dialog = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-dialog-overlay"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm animate-dialog-in rounded-2xl bg-oxygen-black p-5 ring-1 ring-oxygen-silver/20 shadow-xl shadow-black/60">
        {icon && (
          <div
            className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
              danger ? 'bg-oxygen-red/15 text-oxygen-red-light' : 'bg-oxygen-silver/15 text-oxygen-silver-light'
            }`}
          >
            {icon}
          </div>
        )}
        <h3 className="text-center text-lg font-bold text-oxygen-silver-light">{title}</h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-oxygen-silver">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl bg-oxygen-black-deep font-semibold text-oxygen-silver ring-1 ring-oxygen-silver/30 hover:ring-oxygen-silver"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`h-11 flex-1 rounded-xl font-bold text-white transition-colors ${
              danger ? 'bg-oxygen-red hover:bg-oxygen-red-dark' : 'bg-oxygen-red hover:bg-oxygen-red-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}

