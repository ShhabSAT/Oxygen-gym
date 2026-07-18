# Scheduled Alerts — Cloud Function Architecture

> Documentation / scaffold only. This file describes a **server-side scheduled task**
> that runs once per day, independent of any device's connectivity, to evaluate
> expiring memberships and notify supervisors.

## Goal

Oxygen Gym is an offline-first PWA. Background evaluation must not depend on a
supervisor's phone being open or online. A daily "cron" job on the backend
provider evaluates which subscriptions end **today** (or within a warning window)
and pushes notifications to supervisors (push notification / email / SMS).

## Supported Providers

Any scheduled-function runtime works. Examples below for **Supabase Edge
Functions** (Deno) and **Firebase Cloud Functions** (Node/TS).

## Trigger (daily)

- Supabase: `cron` extension → `pg_cron` calling an Edge Function at 08:00 (Asia/Baghdad).
- Firebase: `functions.pubsub.schedule('0 8 * * *').timeZone('Asia/Baghdad')`.
- Static host (Vercel/Netlify): external cron ping (e.g. a scheduler calling a
  secured endpoint) or a self-hosted cron.

## Pseudo-code (provider-agnostic)

```
onSchedule("0 8 * * *"):
  today = startOfDay(now())
  windowEnd = today + WARNING_DAYS(1)

  subs = query(subscriptions)
          .where(status == "active")
          .where(end_date >= today)
          .where(end_date <= windowEnd)

  for sub in subs:
    member = get(members, sub.member_id)
    message = `الاشتراك ينتهي اليوم: ${member.name} (${sub.end_date})`

    notifySupervisor(message)
    logAlert(sub.id, member.id, message)

  return { evaluated: subs.length }
```

## Example — Firebase Cloud Function (TypeScript)

```ts
import * as functions from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

export const dailyExpiryAlert = functions.onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Asia/Baghdad' },
  async () => {
    const db = getFirestore()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const windowEnd = new Date(today)
    windowEnd.setDate(windowEnd.getDate() + 1)

    const subs = await db
      .collection('subscriptions')
      .where('status', '==', 'active')
      .where('end_date', '>=', today.toISOString())
      .where('end_date', '<=', windowEnd.toISOString())
      .get()

    const tokens = await getSupervisorTokens() // FCM tokens

    for (const doc of subs.docs) {
      const sub = doc.data()
      const member = await db.collection('members').doc(sub.member_id).get()
      const body = `الاشتراك ينتهي اليوم: ${member.data()?.name} (${sub.end_date})`
      await getMessaging().sendEachForMulticast({ tokens, notification: { title: 'انتهاء اشتراك', body } })
    }
    functions.logger.info(`Evaluated ${subs.size} expiring subscriptions`)
  },
)
```

## Example — Supabase Edge Function (Deno)

```ts
// supabase/functions/daily-expiry-alert/index.ts
Deno.serve(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const windowEnd = new Date(today)
  windowEnd.setDate(windowEnd.getDate() + 1)

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('id, member_id, end_date, status')
    .eq('status', 'active')
    .gte('end_date', today.toISOString())
    .lte('end_date', windowEnd.toISOString())

  for (const sub of subs ?? []) {
    const { data: member } = await supabase
      .from('members')
      .select('name')
      .eq('id', sub.member_id)
      .single()
    const message = `الاشتراك ينتهي اليوم: ${member?.name} (${sub.end_date})`
    await sendPushToSupervisors(message)
  }

  return new Response(JSON.stringify({ evaluated: subs?.length ?? 0 }))
})
```

## Notes

- `end_date` is stored as an ISO string; compare in `Asia/Baghdad` timezone.
- The local app's `processExpiredFreezes` (client) flips `status` to `expired`;
  the cloud job is the alerting layer only and does **not** mutate membership state.
- Keep the cloud job idempotent: re-running the same day should not spam supervisors
  (track a `last_alerted_date` per subscription).
- This scaffold requires no real backend to build or run the PWA.
