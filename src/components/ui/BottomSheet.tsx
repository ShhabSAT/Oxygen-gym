import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TransitionEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { lockScroll, unlockScroll } from '../../lib/scrollLock'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/*
 * Lightweight bottom sheet — tuned for weak phones.
 *
 * Why it was laggy & what changed:
 *  - The panel had `shadow-2xl` (a large blurred shadow) which gets REPAINTED
 *    every frame while the panel translates → kills low-end GPUs. The shadow is
 *    now applied ONLY once the sheet has settled (`entered`), never during motion.
 *  - The whole heavy form mounted on the SAME frame the slide started, so the
 *    browser did a giant layout + started a compositor animation in one frame.
 *    The form is now injected AFTER the slide-up finishes (`contentReady`), so the
 *    animation runs on a light, near-empty shell.
 *  - Body scroll-lock used to reflow the whole page at open. `scrollbar-gutter:
 *    stable` on <html> (index.css) removes that shift.
 *  - Animation is transform-ONLY (mobile) / transform+opacity (desktop), both
 *    compositor-only. `will-change` is set ONLY while actually moving.
 *  - Drag-to-dismiss: press the handle and swipe down past ~35% of the sheet
 *    height (or flick with enough velocity) to close.
 */
const DURATION = 200
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CLOSE_FALLBACK = DURATION + 140
// Inject the heavy form shortly after the slide-up so the open animation stays
// on a light shell. 60ms < DURATION so it appears as the panel settles.
const CONTENT_DELAY = 60

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const [render, setRender] = useState(open)
  const [entered, setEntered] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const baseY = useRef(0)
  const lastY = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()

  // Mount when opening.
  useEffect(() => {
    if (open) setRender(true)
  }, [open])

  // On the frame after mount (or after open toggles), flip `entered` to drive
  // the enter/exit transition. Reset drag offset when fully open.
  useEffect(() => {
    if (!render) return
    const id = requestAnimationFrame(() => {
      setEntered(open)
      if (open) setDragY(0)
    })
    return () => cancelAnimationFrame(id)
  }, [render, open])

  // Inject the heavy form only after the slide has mostly finished (light shell
  // during motion). Keep it mounted through the exit so it doesn't pop empty.
  useEffect(() => {
    if (!render) return
    if (open) {
      setContentReady(false)
      const t = setTimeout(() => setContentReady(true), CONTENT_DELAY)
      return () => clearTimeout(t)
    }
  }, [render, open])

  // Belt-and-suspenders unmount in case transitionend is missed.
  useEffect(() => {
    if (render && !open) {
      closeTimer.current = setTimeout(() => setRender(false), CLOSE_FALLBACK)
      return () => clearTimeout(closeTimer.current)
    }
  }, [render, open])

  // Lock body scroll + Escape-to-close while mounted (shared ref-counted lock).
  useEffect(() => {
    if (!render) return
    lockScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      unlockScroll()
      document.removeEventListener('keydown', onKey)
    }
  }, [render, onClose])

  if (!render) return null

  // ----- Drag-to-dismiss (mobile only) -----
  function onPointerDown(e: ReactPointerEvent) {
    if (isDesktop) return
    startY.current = e.clientY
    baseY.current = dragY
    lastY.current = e.clientY
    lastT.current = performance.now()
    velocity.current = 0
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!dragging) return
    const ny = Math.max(0, baseY.current + (e.clientY - startY.current))
    setDragY(ny)
    const now = performance.now()
    const dt = now - lastT.current
    if (dt > 0) velocity.current = (e.clientY - lastY.current) / dt
    lastY.current = e.clientY
    lastT.current = now
  }

  function endDrag() {
    if (!dragging) return
    setDragging(false)
    const panelH = panelRef.current?.offsetHeight ?? 0
    const threshold = Math.min(140, panelH * 0.35)
    if (dragY > threshold || velocity.current > 0.6) {
      onClose()
    } else {
      setDragY(0) // snap back
    }
  }

  function onTransitionEnd(e: TransitionEvent) {
    if (e.target !== panelRef.current) return
    if (!entered && !open) setRender(false)
  }

  // ----- Resolve panel transform + transition (transform-only on mobile) -----
  let transform: string
  let transition: string

  if (dragging) {
    transform = `translate3d(0, ${dragY}px, 0)`
    transition = 'none'
  } else if (!entered) {
    // Hidden / exiting: slide fully off-screen (mobile) or scale-down (desktop).
    transform = isDesktop ? 'translate3d(0, 0, 0) scale(0.96)' : 'translate3d(0, 100%, 0)'
    transition = `transform ${DURATION}ms ${EASE}`
  } else {
    transform = isDesktop ? 'translate3d(0, 0, 0) scale(1)' : `translate3d(0, ${dragY}px, 0)`
    transition = `transform ${DURATION}ms ${EASE}`
  }

  const panelStyle: CSSProperties = {
    transform,
    transition,
    // Heavy shadow ONLY once settled — never repainted mid-animation.
    boxShadow: entered ? '0 -10px 30px rgba(0, 0, 0, 0.45)' : 'none',
    willChange: dragging || !entered ? 'transform' : 'auto',
  }

  const backdropStyle: CSSProperties = {
    opacity: open ? 1 : 0,
    transition: `opacity ${DURATION}ms ease-out`,
  }

  // Light placeholder keeps the shell height stable while the form loads in.
  const body = contentReady ? (
    children
  ) : (
    <div className="min-h-[55vh]" aria-hidden />
  )

  const sheet = isDesktop ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/70" style={backdropStyle} onClick={onClose} />
      <div
        ref={panelRef}
        className="relative z-10 max-h-[90vh] max-w-md w-full overflow-y-auto rounded-2xl bg-oxygen-black ring-1 ring-oxygen-silver/20"
        style={panelStyle}
        onTransitionEnd={onTransitionEnd}
      >
        <SheetHeader title={title} onClose={onClose} />
        <div className="p-5">{body}</div>
      </div>
    </div>
  ) : (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/70" style={backdropStyle} onClick={onClose} />
      <div
        ref={panelRef}
        className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-oxygen-black ring-1 ring-oxygen-silver/20"
        style={panelStyle}
        onTransitionEnd={onTransitionEnd}
      >
        <div
          className="flex cursor-grab touch-none flex-col items-center pb-1 pt-3 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="h-1.5 w-12 rounded-full bg-oxygen-silver/40" />
        </div>
        <SheetHeader title={title} onClose={onClose} />
        <div className="p-5 pb-8 pb-safe">{body}</div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}

function SheetHeader({ title, onClose }: { title?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pt-2">
      <h3 className="text-lg font-bold text-oxygen-silver-light">{title ?? ''}</h3>
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
