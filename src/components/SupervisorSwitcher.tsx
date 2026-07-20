import { useEffect, useRef, useState } from 'react'
import { ChevronDown, UserCog } from 'lucide-react'
import { useSupervisor } from '../context/SupervisorContext'
import { SUPERVISORS } from '../lib/constants'
import { ConfirmDialog } from './ui/ConfirmDialog'

export function SupervisorSwitcher() {
  const { supervisor, setSupervisor } = useSupervisor()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function pick(name: string) {
    setOpen(false)
    // Tapping the already-active admin (or the same value) needs no confirm.
    if (name === supervisor) return
    setPending(name)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 min-w-[44px] items-center gap-2 rounded-full bg-white/5 px-3 ring-1 ring-white/15 hover:bg-white/10 hover:ring-oxygen-red/80 transition-colors"
      >
        <UserCog className="h-5 w-5 text-oxygen-red" />
        <span className="text-sm font-semibold text-oxygen-silver-light">{supervisor}</span>
        <ChevronDown className={`h-4 w-4 text-oxygen-silver transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-xl bg-black/80 backdrop-blur-xl ring-1 ring-white/10 shadow-xl shadow-black/40">
          <p className="px-4 py-2 text-xs font-medium text-oxygen-silver">اختر المشرف</p>
          {SUPERVISORS.map((name) => (
            <button
              key={name}
              onClick={() => pick(name)}
              className={`flex h-11 w-full items-center px-4 text-sm font-medium transition-colors hover:bg-oxygen-red/20 ${
                name === supervisor ? 'text-oxygen-red-light' : 'text-oxygen-silver-light'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="تبديل المشرف"
        message={
          pending
            ? `هل أنت متأكد من التبديل إلى "${pending}"؟`
            : ''
        }
        confirmLabel="تأكيد"
        cancelLabel="إلغاء"
        onConfirm={() => {
          if (pending) setSupervisor(pending)
          setPending(null)
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
