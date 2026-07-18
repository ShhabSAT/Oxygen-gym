import type { Member, Subscription } from '../types'
import { getActiveSubscription } from './status'

export interface MemberWithSubs {
  member: Member
  subs: Subscription[]
  active: Subscription | undefined
}

function todayDateOnly(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function addDaysOnly(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Groups members by how many days until their active subscription expires.
 * Returns arrays of members expiring in exactly 0, 1, 2 days.
 */
export function groupExpiringSoon(
  members: Member[],
  subsByMember: Map<string, Subscription[]>,
): { today: MemberWithSubs[]; in2: MemberWithSubs[]; in3: MemberWithSubs[] } {
  const today = todayDateOnly()
  const in2Set = new Set([today, addDaysOnly(today, 1), addDaysOnly(today, 2)])
  const in3Set = new Set([
    today,
    addDaysOnly(today, 1),
    addDaysOnly(today, 2),
    addDaysOnly(today, 3),
  ])

  const today2: MemberWithSubs[] = []
  const in2: MemberWithSubs[] = []
  const in3: MemberWithSubs[] = []

  for (const member of members) {
    const subs = subsByMember.get(member.id) ?? []
    const active = getActiveSubscription(subs)
    if (!active || active.status === 'frozen') continue
    if (!in3Set.has(active.end_date)) continue

    const entry: MemberWithSubs = { member, subs, active }
    if (active.end_date === today) {
      today2.push(entry)
      in2.push(entry)
      in3.push(entry)
    } else if (in2Set.has(active.end_date)) {
      in2.push(entry)
      in3.push(entry)
    } else {
      in3.push(entry)
    }
  }

  return { today: today2, in2, in3 }
}

/**
 * Computes outstanding debt per member (per subscription remaining balance).
 * Returns members with total debt > 0, sorted by oldest active/most-recent
 * subscription start_date ascending.
 */
export function getOutstandingDebts(
  members: Member[],
  subsByMember: Map<string, Subscription[]>,
  paymentsBySub: Map<string, number>,
): { member: Member; debt: number; oldestStart: string }[] {
  const result: { member: Member; debt: number; oldestStart: string }[] = []

  for (const member of members) {
    const subs = subsByMember.get(member.id) ?? []
    let debt = 0
    let oldestStart = ''
    for (const s of subs) {
      const paid = paymentsBySub.get(s.id) ?? 0
      const remaining = s.actual_price - paid
      if (remaining > 0) debt += remaining
      if (!oldestStart || s.start_date < oldestStart) oldestStart = s.start_date
    }
    if (debt > 0) {
      result.push({ member, debt, oldestStart: oldestStart || todayDateOnly() })
    }
  }

  result.sort((a, b) => (a.oldestStart < b.oldestStart ? -1 : 1))
  return result
}
