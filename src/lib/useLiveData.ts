import { useCallback, useEffect, useRef, useState } from 'react'
import type { Unsubscribe } from 'firebase/firestore'
import { whenAuthReady } from './firebase'

export interface LiveSource<Data> {
  /** Subscribe; the hook injects onData (first-emit tracking) + onError. */
  subscribe: (
    onData: (data: Data) => void,
    onError: (err: unknown) => void,
  ) => Unsubscribe
  /** The page's own data handler. */
  onData: (data: Data) => void
}

interface LiveDataState {
  loading: boolean
  error: string | null
  /** Re-attempt after an error / offline state. */
  retry: () => void
}

const CONNECTION_ERROR = 'تعذر الاتصال بالخادم — تحقق من اتصال الإنترنت ثم أعد المحاولة'

/**
 * Drives one or more real-time Firestore subscriptions for a page.
 *
 * Key guarantees:
 *  - Waits for Firebase Anonymous Auth.
 *  - Resolves `loading` as soon as EVERY source emits its first snapshot.
 *    With `includeMetadataChanges: true` in the listener, a cache-only
 *    snapshot arrives immediately (ms), so the UI never hangs while offline
 *    — it shows cached data instantly and syncs silently in the background.
 *  - Flips to `error` only if auth fails or a listener fires onError.
 *    A long 30 s safety timeout catches the pathological case where no
 *    snapshot arrives at all (corrupt cache) — but in normal operation
 *    the cache snapshot resolves loading long before this threshold.
 *  - `retry()` tears down and re-subscribes.
 */
export function useLiveData(sources: LiveSource<unknown>[], timeoutMs = 30_000): LiveDataState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setError(null)
    setLoading(true)
    setAttempt((a) => a + 1)
  }, [])

  const sourcesRef = useRef(sources)
  sourcesRef.current = sources

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    void (async () => {
      try {
        await whenAuthReady()
      } catch {
        /* whenAuthReady resolves even on failure; still try to listen */
      }
      if (cancelled) return

      setLoading(true)
      setError(null)

      let resolved = 0
      const total = sourcesRef.current.length

      const markResolved = () => {
        resolved += 1
        if (resolved >= total && !cancelled) {
          if (timer) clearTimeout(timer)
          setLoading(false)
        }
      }

      timer = setTimeout(() => {
        if (!cancelled && loading && !error) {
          setError(CONNECTION_ERROR)
          setLoading(false)
        }
      }, timeoutMs)

      const unsubs: Unsubscribe[] = sourcesRef.current.map((src) =>
        src.subscribe(
          (data) => {
            src.onData(data)
            markResolved()
          },
          (err) => {
            if (cancelled) return
            console.error('[live-data] listener error', err)
            if (timer) clearTimeout(timer)
            setError(CONNECTION_ERROR)
            setLoading(false)
          },
        ),
      )

      cleanup = () => unsubs.forEach((u) => u())
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      cleanup?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, timeoutMs])

  return { loading, error, retry }
}
