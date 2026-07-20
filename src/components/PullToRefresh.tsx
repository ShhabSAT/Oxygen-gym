import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/*
 * Custom pull-to-refresh — replaces Chrome's native (ugly) overscroll refresh.
 *
 * How it works:
 *  - Engages ONLY when the window is scrolled to the very top (scrollY <= 0) and
 *    the user drags DOWN. Otherwise the native scroll is left untouched.
 *  - Touch handlers are attached non-passively so we can `preventDefault()` the
 *    native bounce/PTR while pulling — combined with `overscroll-behavior-y:
 *    contain` on <html>/<body> this fully suppresses Chrome's built-in refresh.
 *  - The content is translated with `transform: translate3d` (compositor-only),
 *    damped with resistance so it never feels rubbery. `will-change` is applied
 *    ONLY while actually moving, so no permanent GPU layer is kept.
 *  - Branded indicator: a red progress ring with the Oxygen Gym logo at its
 *    center. Pulling fills the arc; releasing past the threshold locks it and
 *    spins while `onRefresh` runs, then collapses smoothly.
 *
 * onRefresh should fire the current page's data re-fetch. We dispatch a window
 * event ('app:pull-refresh') so each page can run its own `retry()` without the
 * PTR needing to know which route is active.
 */

const THRESHOLD = 72
const MAX_PULL = 130
const RESISTANCE = 0.55
const RING_R = 18
const RING_C = 2 * Math.PI * RING_R
export const PTR_EVENT = 'app:pull-refresh'

interface PullToRefreshProps {
  children: ReactNode
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const startY = useRef(0)
  const pulling = useRef(false)
  const refreshingRef = useRef(false)
  const pullRef = useRef(0)
  pullRef.current = pull

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const atTop = () => window.scrollY <= 0

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return
      if (!atTop()) {
        pulling.current = false
        return
      }
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    const onMove = (e: TouchEvent) => {
      if (!pulling.current || refreshingRef.current) return
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) {
        if (pullRef.current !== 0) setPull(0)
        return
      }
      if (atTop()) {
        // Stop the native overscroll bounce / Chrome PTR while we pull.
        e.preventDefault()
        setDragging(true)
        setPull(Math.min(delta * RESISTANCE, MAX_PULL))
      }
    }

    const finish = () => {
      if (!pulling.current) return
      pulling.current = false
      if (refreshingRef.current) return
      const p = pullRef.current
      if (p >= THRESHOLD) {
        refreshingRef.current = true
        setRefreshing(true)
        setDragging(false)
        setPull(THRESHOLD) // lock open while spinning
        window.dispatchEvent(new CustomEvent(PTR_EVENT))
        // Collapse once the page has re-fetched (or after a safety timeout).
        const collapse = () => {
          refreshingRef.current = false
          setRefreshing(false)
          setDragging(false)
          setPull(0)
        }
        window.addEventListener(PTR_EVENT + ':done', collapse, { once: true })
        setTimeout(collapse, 6000) // safety net if no one signals completion
      } else {
        setDragging(false)
        setPull(0)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', finish, { passive: true })
    el.addEventListener('touchcancel', finish, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', finish)
      el.removeEventListener('touchcancel', finish)
    }
  }, [])

  const progress = Math.min(pull / THRESHOLD, 1)
  const indicatorOffset = pull - 54
  const visible = pull > 2 || refreshing

  const contentStyle: CSSProperties = {
    transform: `translate3d(0, ${pull}px, 0)`,
    transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
    willChange: dragging || refreshing ? 'transform' : 'auto',
  }

  const indicatorStyle: CSSProperties = {
    transform: `translate3d(0, ${indicatorOffset}px, 0)`,
    opacity: visible ? 1 : 0,
    transition: dragging
      ? 'none'
      : 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease-out',
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-center"
        style={indicatorStyle}
        aria-hidden
      >
        <div className={`relative flex h-12 w-12 items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r={RING_R} stroke="rgba(255,255,255,0.10)" strokeWidth="3" fill="none" />
            <circle
              cx="23"
              cy="23"
              r={RING_R}
              stroke="#E53E3E"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - progress)}
              transform="rotate(-90 23 23)"
              style={{ transition: dragging ? 'none' : 'stroke-dashoffset 0.2s ease-out' }}
            />
          </svg>
          <img src="/icon-noBG.png" alt="" className="absolute h-5 w-5 object-contain" draggable={false} onContextMenu={(e) => e.preventDefault()} />
        </div>
      </div>

      <div style={contentStyle} className="relative z-10">
        {children}
      </div>
    </div>
  )
}
