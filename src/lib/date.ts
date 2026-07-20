/**
 * Local-date helpers.
 *
 * Several places previously used `new Date().toISOString().slice(0, 10)`,
 * which is UTC — in Syria (UTC+3) that makes the app's idea of "today"
 * drift by up to 3 hours at day boundaries, breaking "expiring today"
 * and freeze/end-date logic. Always compare against the device's LOCAL
 * date instead.
 */

/** Local `YYYY-MM-DD` (device timezone). */
export function todayLocal(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse a `YYYY-MM-DD` string as LOCAL midnight (not UTC). */
function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Add `days` to a `YYYY-MM-DD` string, returning a local `YYYY-MM-DD`. */
export function addDaysLocal(dateStr: string, days: number): string {
  const d = parseLocal(dateStr)
  d.setDate(d.getDate() + days)
  return todayLocal(d)
}

/** Whole-day difference (to - from) using local midnight. */
export function dayDiffLocal(from: string, to: string): number {
  const a = parseLocal(from)
  const b = parseLocal(to)
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}
