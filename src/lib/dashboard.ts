import type { Member, Subscription } from '../types'
import { getActiveSubscription } from './status'
import { todayLocal, addDaysLocal } from './date'

export interface MemberWithSubs {
  member: Member
  subs: Subscription[]
  active: Subscription | undefined
}

function todayDateOnly(): string {
  return todayLocal()
}

function addDaysOnly(dateStr: string, days: number): string {
  return addDaysLocal(dateStr, days)
}

/**
 * Returns members whose most recent subscription has expired (end_date < today).
 * Each result carries the most-recently-expired subscription in `active`.
 * Sorted by end_date descending (most recently expired first).
 */
export function getExpiredMembers(
  members: Member[],
  subsByMember: Map<string, Subscription[]>,
): MemberWithSubs[] {
  const result: MemberWithSubs[] = []

  for (const member of members) {
    const subs = subsByMember.get(member.id) ?? []
    if (subs.length === 0) continue
    const active = getActiveSubscription(subs)
    if (active) continue

    // Most recently expired subscription
    const expired = subs
      .filter((s) => s.end_date < todayLocal())
      .sort((a, b) => (a.end_date < b.end_date ? 1 : -1))[0]

    if (!expired) continue
    result.push({ member, subs, active: expired })
  }

  result.sort((a, b) => (a.active!.end_date < b.active!.end_date ? 1 : -1))
  return result
}

/**
 * Groups members who still have an active subscription, partitioned into
 * mutually‑exclusive buckets so each member appears in exactly one alert:
 *   today  – ends exactly today (0 days remaining)
 *   in2    – ends tomorrow or the day after (1‑2 days remaining)
 *   in3    – ends exactly 3 days from now (3 days remaining)
 */
export function groupExpiringSoon(
  members: Member[],
  subsByMember: Map<string, Subscription[]>,
): { today: MemberWithSubs[]; in2: MemberWithSubs[]; in3: MemberWithSubs[] } {
  const today = todayDateOnly()
  const tomorrow = addDaysOnly(today, 1)
  const dayAfterTomorrow = addDaysOnly(today, 2)
  const threeDaysOut = addDaysOnly(today, 3)

  const todayList: MemberWithSubs[] = []
  const in2List: MemberWithSubs[] = []
  const in3List: MemberWithSubs[] = []

  for (const member of members) {
    const subs = subsByMember.get(member.id) ?? []
    const active = getActiveSubscription(subs)
    if (!active || active.status === 'frozen') continue

    const entry: MemberWithSubs = { member, subs, active }

    if (active.end_date === today) {
      todayList.push(entry)
    } else if (active.end_date === tomorrow || active.end_date === dayAfterTomorrow) {
      in2List.push(entry)
    } else if (active.end_date === threeDaysOut) {
      in3List.push(entry)
    }
  }

  return { today: todayList, in2: in2List, in3: in3List }
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
