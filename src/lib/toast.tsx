import { useEffect, useState } from 'react'

/* ------------------------------------------------------------------
 * Lightweight imperative toast for NON-BLOCKING notifications.
 *
 * Used specifically for *late* Firestore write failures: because writes
 * are now fire-and-forget (the UI updates immediately from the local
 * cache, not after server ack), a write that is rejected by the server
 * AFTER reconnecting (e.g. a security-rule rejection, not just "offline")
 * must still surface somewhere. We show a small non-blocking toast so
 * silent permanent failures don't go unnoticed.
 * ------------------------------------------------------------------ */

export type ToastKind = 'error' | 'info' | 'success'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

let pushFn: ((t: Omit<ToastItem, 'id'>) => void) | null = null

/** Imperative API usable from anywhere (sheets, store helpers, etc.). */
export function toast(message: string, kind: ToastKind = 'error') {
  pushFn?.({
    kind,
    message: String(message),
  })
}

/**
 * Mount this ONCE near the app root (e.g. inside AppLayout) so toasts
 * have a place to render. It renders a fixed bottom-center stack.
 */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    pushFn = (t) => {
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { ...t, id }])
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id))
      }, 6000)
    }
    return () => {
      pushFn = null
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 md:top-16 z-[100] flex flex-col items-center gap-2 px-4">
      {items.map((it) => (
        <div
          key={it.id}
          className={
            'pointer-events-auto max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ' +
            (it.kind === 'error'
              ? 'bg-oxygen-black-deep/95 text-oxygen-silver-light ring-red-500/40'
              : it.kind === 'success'
                ? 'bg-oxygen-black-deep/95 text-oxygen-silver-light ring-green-500/30'
                : 'bg-oxygen-black-deep/95 text-oxygen-silver-light ring-oxygen-silver/30')
          }
          role="alert"
        >
          {it.message}
        </div>
      ))}
    </div>
  )
}
