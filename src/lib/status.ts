import type { Member, MemberStatus, Subscription } from '../types'
import {
  addActivityLog,
  getFreezes,
  getMember,
  getSubscription,
  updateFreeze,
  updateSubscription,
} from './store'

export type { MemberStatus }

function todayDateOnly(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function getActiveSubscription(
  subscriptions: Subscription[],
): Subscription | undefined {
  const today = todayDateOnly()
  return subscriptions
    .filter((s) => s.end_date >= today)
    .sort((a, b) => (a.end_date < b.end_date ? 1 : -1))[0]
}

export function getMemberStatus(
  _member: Member,
  subscriptions: Subscription[],
): MemberStatus {
  const active = getActiveSubscription(subscriptions)
  if (!active) return 'expired'
  if (active.status === 'frozen') return 'frozen'
  return 'active'
}

export function isSubscriptionActive(sub: Subscription): boolean {
  const today = todayDateOnly()
  return sub.end_date >= today && sub.status !== 'frozen'
}

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'نشط',
  expired: 'منتهي',
  frozen: 'مجمد',
}

export function formatDate(d: string): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('ar-SY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function dayDiff(from: string, to: string): number {
  const a = new Date(from)
  a.setHours(0, 0, 0, 0)
  const b = new Date(to)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * Unfreeze any fixed-duration freeze whose scheduled end_date has passed.
 * Extends the linked subscription's end_date by the number of frozen days
 * and restores its status to active (or expired if the new end is past).
 */
export async function processExpiredFreezes(): Promise<void> {
  const today = todayDateOnly()
  const freezes = await getFreezes()
  for (const f of freezes) {
    if (f.actual_unfreeze_date) continue
    if (!f.end_date) continue
    if (f.end_date > today) continue

    const sub = await getSubscription(f.subscription_id)
    if (!sub) continue

    const daysFrozen = Math.max(1, dayDiff(f.start_date, f.end_date))
    const newEndDate = addDays(sub.end_date, daysFrozen)
    const newStatus: Subscription['status'] =
      newEndDate >= today ? 'active' : 'expired'

    await updateSubscription(
      sub.id,
      {
        end_date: newEndDate,
        status: newStatus,
      },
      'النظام',
      true,
    )
    await updateFreeze(f.id, { actual_unfreeze_date: f.end_date }, 'النظام', true)
    const member = await getMember(sub.member_id)
    const memberName = member?.name ?? sub.member_id
    await addActivityLog({
      action_type: 'unfreeze',
      description: `تم إلغاء تجميد اشتراك العضو ${memberName} تلقائياً - تم تمديد حتى ${formatDate(
        newEndDate,
      )}`,
      supervisor_name: 'النظام',
      entity_id: sub.id,
    })
  }
}
