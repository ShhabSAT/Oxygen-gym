import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-oxygen-black p-5 ring-1 ring-oxygen-silver/20 shadow-2xl shadow-black/60">
        <h3 className="text-lg font-bold text-oxygen-silver-light">{title}</h3>
        <p className="mt-2 text-sm text-oxygen-silver">{message}</p>
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
              danger
                ? 'bg-oxygen-red hover:bg-oxygen-red-dark'
                : 'bg-oxygen-red hover:bg-oxygen-red-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
