import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useMediaQuery } from '../../lib/useMediaQuery'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  if (isDesktop) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-oxygen-black ring-1 ring-oxygen-silver/20 shadow-2xl shadow-black/60 animate-modal-in">
          <SheetHeader title={title} onClose={onClose} />
          <div className="p-5">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-oxygen-black ring-1 ring-oxygen-silver/20 shadow-2xl shadow-black/60 animate-sheet-up">
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-oxygen-silver/30" />
        </div>
        <SheetHeader title={title} onClose={onClose} />
        <div className="p-5 pb-8">{children}</div>
      </div>
    </div>
  )
}

function SheetHeader({ title, onClose }: { title?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pt-2">
      <h3 className="text-lg font-bold text-oxygen-silver-light">
        {title ?? ''}
      </h3>
      <button
        onClick={onClose}
        aria-label="إغلاق"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-oxygen-black-deep text-oxygen-silver hover:text-oxygen-red-light"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
