import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  type Unsubscribe,
  type QuerySnapshot,
  type DocumentSnapshot,
  type DocumentReference,
  type Query,
} from 'firebase/firestore'

export type { Unsubscribe }
import { db } from './firebase'
import { toast } from './toast'
import { DEFAULT_SUBSCRIPTION_TYPES } from './seed'
import type {
  ActivityActionType,
  ActivityLog,
  EntityName,
  Freeze,
  Member,
  Payment,
  Subscription,
  SubscriptionType,
} from '../types'

/* ==================================================================
 * PERSISTENCE LAYER — Firestore (single source of truth)
 *
 * This module replaces the old IndexedDB `idb` store entirely. Every
 * read/write goes through Firestore, which also provides built-in
 * offline persistence (see firebase.ts). There is NO second local
 * database and NO custom sync queue — Firestore handles local caching,
 * write-queueing while offline, and real-time multi-device sync.
 *
 * The exported function signatures are unchanged from the IndexedDB
 * version so all existing callers (pricing, freeze extension, debt
 * calc, UI, backup, etc.) keep working without modification.
 * ================================================================== */

const ID_PREFIX: Record<EntityName, string> = {
  members: 'mbr',
  subscriptions: 'sub',
  payments: 'pay',
  freezes: 'frz',
  activityLog: 'log',
  subscriptionTypes: 'stp',
}

function now(): number {
  return Date.now()
}

export function makeId(entity: EntityName): string {
  return `${ID_PREFIX[entity]}_${now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function stampUpdatedAt<T>(record: T): T & { updated_at: number } {
  return { ...(record as object), updated_at: now() } as T & { updated_at: number }
}

/* Firestore does NOT accept `undefined` as a field value — it must be
 * either omitted entirely or set to `null`/a real value. Several of our
 * records carry optional fields (member.goal, member.notes, activityLog.
 * entity_id, freeze.end_date, etc.) that can be `undefined` at build time.
 * Passing `undefined` into setDoc/updateDoc throws "Unsupported field value:
 * undefined" and aborts the whole write. This helper recursively strips any
 * `undefined` keys so the object is always safe to write. It is applied at
 * the single write choke-point below, guaranteeing the convention holds for
 * every collection without per-caller ad-hoc fixes. */
type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }
export function stripUndefined<T>(record: T): T {
  const out: Record<string, JsonValue> = {}
  for (const [k, v] of Object.entries(record as object)) {
    if (v === undefined) continue
    out[k] = (v && typeof v === 'object' && !Array.isArray(v))
      ? (stripUndefined(v as object) as JsonValue)
      : (v as JsonValue)
  }
  return out as unknown as T
}

/* ------------------------------------------------------------------
 * FIRE-AND-FORGET WRITE
 *
 * CRITICAL OFFLINE BEHAVIOR:
 * Firestore's `setDoc`/`updateDoc`/`writeBatch.commit()` promises do NOT
 * resolve until the write is acknowledged by the SERVER — this is true
 * even with `persistentLocalCache` enabled. The local cache write (and
 * the local `onSnapshot` emission) happens instantly, but the promise
 * itself stays pending while offline. Therefore we must NEVER block the
 * UI on these promises; otherwise the "Saving…" spinner hangs forever
 * offline.
 *
 * `fireWrite` queues the write into the local cache immediately (so the
 * UI/listener reflects it at once) and resolves the returned record to
 * the caller synchronously. If the write LATER fails on the server
 * (e.g. a security-rule rejection after reconnect — NOT mere offline),
 * the rejection is surfaced via a non-blocking toast instead of hanging
 * the UI. Reads (`getDoc`/`getDocs`) read from cache and stay instant
 * offline, so they are still awaited normally.
 * ------------------------------------------------------------------ */
const LATE_WRITE_FAIL_MSG = 'تعذر حفظ بعض التغييرات على الخادم — تحقق من الاتصال والصلاحيات'
function fireWrite(writePromise: Promise<unknown>): void {
  void writePromise.catch((err) => {
    console.error('[store] write failed (late):', err)
    toast(LATE_WRITE_FAIL_MSG, 'error')
  })
}

/* Helper: Firestore auto-generates IDs for addDoc. For entities that
 * previously used our own makeId (e.g. to derive readable prefixes), we
 * keep using makeId as the document id via setDoc so IDs stay stable and
 * the relations (member_id, subscription_id) keep working. */
function col(name: EntityName) {
  return collection(db, name)
}

function docRef(name: EntityName, id: string) {
  return doc(db, name, id)
}

/* ----------------------------------------------------------------
 * ONLINE STATE TRACKING
 * Firestore syncs automatically; this is kept only so the UI can show
 * a connectivity indicator. It no longer drives a custom sync queue.
 * ---------------------------------------------------------------- */

let online = typeof navigator !== 'undefined' ? navigator.onLine : true

export function isOnline(): boolean {
  return online
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true
  })
  window.addEventListener('offline', () => {
    online = false
  })
}

/* ----------------------------------------------------------------
 * ACTIVITY LOG
 * ---------------------------------------------------------------- */

export async function addActivityLog(input: {
  action_type: ActivityActionType
  description: string
  supervisor_name: string
  entity_id?: string
}): Promise<ActivityLog> {
  const log: ActivityLog = {
    id: makeId('activityLog'),
    action_type: input.action_type,
    description: input.description,
    supervisor_name: input.supervisor_name,
    timestamp: now(),
    entity_id: input.entity_id,
  }
  fireWrite(setDoc(docRef('activityLog', log.id), stripUndefined(log)))
  return log
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const q = query(col('activityLog'), orderBy('timestamp', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ActivityLog)
}

/* ----------------------------------------------------------------
 * MEMBERS
 * ---------------------------------------------------------------- */

export async function getMembers(): Promise<Member[]> {
  const snap = await getDocs(col('members'))
  return snap.docs.map((d) => d.data() as Member)
}

export async function getMember(id: string): Promise<Member | undefined> {
  const snap = await getDoc(docRef('members', id))
  return snap.exists() ? (snap.data() as Member) : undefined
}

export async function addMember(
  member: Omit<Member, 'id' | 'updated_at'>,
  supervisor_name: string = 'النظام',
): Promise<Member> {
  const record = stampUpdatedAt({ ...member, id: makeId('members') })
  fireWrite(setDoc(docRef('members', record.id), stripUndefined(record)))
  // Non-blocking activity log (also fire-and-forget internally).
  void addActivityLog({
    action_type: 'member_add',
    description: `تمت إضافة العضو: ${record.name}`,
    supervisor_name,
    entity_id: record.id,
  })
  return record
}

export async function updateMember(
  id: string,
  patch: Partial<Omit<Member, 'id'>>,
  supervisor_name: string = 'النظام',
): Promise<Member | undefined> {
  const ref = docRef('members', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return undefined
  // Field-level merge (NOT a whole-document setDoc). This prevents an
  // offline edit from clobbering OTHER fields the device didn't touch —
  // e.g. one device editing `notes` won't wipe another device's `phone`.
  // Fire-and-forget: the local cache applies immediately; the UI/listener
  // reflect it via the optimistic getDoc below. Server ack is not awaited.
  fireWrite(updateDoc(ref, stripUndefined(stampUpdatedAt({ ...patch }))))
  const updated = (await getDoc(ref)).data() as Member
  void addActivityLog({
    action_type: 'member_update',
    description: `تم تحديث العضو: ${updated.name}`,
    supervisor_name,
    entity_id: id,
  })
  return updated
}

export async function deleteMember(
  id: string,
  supervisor_name: string = 'النظام',
): Promise<void> {
  const snap = await getDoc(docRef('members', id))
  const name = snap.exists() ? (snap.data() as Member).name : id
  // Fire-and-forget: local cache delete reflects immediately via listener.
  fireWrite(deleteDoc(docRef('members', id)))
  void addActivityLog({
    action_type: 'member_delete',
    description: `تم حذف العضو: ${name}`,
    supervisor_name,
    entity_id: id,
  })
}

/* ----------------------------------------------------------------
 * SUBSCRIPTIONS
 * ---------------------------------------------------------------- */

export async function getSubscriptions(): Promise<Subscription[]> {
  const snap = await getDocs(col('subscriptions'))
  return snap.docs.map((d) => d.data() as Subscription)
}

export async function getSubscription(id: string): Promise<Subscription | undefined> {
  const snap = await getDoc(docRef('subscriptions', id))
  return snap.exists() ? (snap.data() as Subscription) : undefined
}

export async function getSubscriptionsByMember(
  member_id: string,
): Promise<Subscription[]> {
  const q = query(col('subscriptions'), where('member_id', '==', member_id))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Subscription)
}

export async function addSubscription(
  sub: Omit<Subscription, 'id' | 'updated_at'>,
  supervisor_name: string = 'النظام',
  skipLog = false,
): Promise<Subscription> {
  const record = stampUpdatedAt({ ...sub, id: makeId('subscriptions') })
  // Fire-and-forget: the local cache write resolves the UI instantly.
  fireWrite(setDoc(docRef('subscriptions', record.id), stripUndefined(record)))
  if (!skipLog) {
    const [member, type] = await Promise.all([
      getMember(record.member_id),
      getSubscriptionType(record.type_id),
    ])
    const memberName = member?.name ?? record.member_id
    const typeName = type?.name ?? record.type_id
    void addActivityLog({
      action_type: 'subscription_add',
      description: `تمت إضافة اشتراك للعضو ${memberName} - ${typeName}`,
      supervisor_name,
      entity_id: record.id,
    })
  }
  return record
}

export async function updateSubscription(
  id: string,
  patch: Partial<Omit<Subscription, 'id'>>,
  supervisor_name: string = 'النظام',
  skipLog = false,
): Promise<Subscription | undefined> {
  const ref = docRef('subscriptions', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return undefined
  // Field-level merge — see updateMember for rationale. Fire-and-forget.
  fireWrite(updateDoc(ref, stripUndefined(stampUpdatedAt({ ...patch }))))

  const updated = (await getDoc(ref)).data() as Subscription
  if (!skipLog) {
    const member = await getMember(updated.member_id)
    const memberName = member?.name ?? updated.member_id
    void addActivityLog({
      action_type: 'subscription_update',
      description: `تم تحديث اشتراك العضو ${memberName}`,
      supervisor_name,
      entity_id: id,
    })
  }
  return updated
}

export async function deleteSubscription(
  id: string,
  supervisor_name: string = 'النظام',
): Promise<void> {
  const snap = await getDoc(docRef('subscriptions', id))
  const existing = snap.exists() ? (snap.data() as Subscription) : undefined
  const member = existing ? await getMember(existing.member_id) : undefined
  const memberName = member?.name ?? existing?.member_id ?? id
  // Fire-and-forget: local cache delete reflects immediately via listener.
  fireWrite(deleteDoc(docRef('subscriptions', id)))
  void addActivityLog({
    action_type: 'subscription_delete',
    description: `تم حذف اشتراك العضو ${memberName}`,
    supervisor_name,
    entity_id: id,
  })
}

/* ----------------------------------------------------------------
 * PAYMENTS
 * ---------------------------------------------------------------- */

export async function getPayments(): Promise<Payment[]> {
  const snap = await getDocs(col('payments'))
  return snap.docs.map((d) => d.data() as Payment)
}

export async function getPaymentsBySubscription(
  subscription_id: string,
): Promise<Payment[]> {
  const q = query(col('payments'), where('subscription_id', '==', subscription_id))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Payment)
}

export async function addPayment(
  payment: Omit<Payment, 'id' | 'updated_at'>,
  supervisor_name?: string,
  skipLog = false,
): Promise<Payment> {
  const record = stampUpdatedAt({ ...payment, id: makeId('payments') })
  // Fire-and-forget local cache write.
  fireWrite(setDoc(docRef('payments', record.id), stripUndefined(record)))
  if (!skipLog) {
    const [sub, member] = await Promise.all([
      getSubscription(record.subscription_id),
      getSubscription(record.subscription_id).then((s) => (s ? getMember(s.member_id) : undefined)),
    ])
    const memberName = member?.name ?? sub?.member_id ?? record.subscription_id
    const actor = supervisor_name ?? record.supervisor_name ?? 'النظام'
    void addActivityLog({
      action_type: 'payment_add',
      description: `دفعة بقيمة ${record.amount} ل.س للعضو ${memberName}`,
      supervisor_name: actor,
      entity_id: record.id,
    })
  }
  return record
}

/* ----------------------------------------------------------------
 * FREEZES
 * ---------------------------------------------------------------- */

export async function getFreezes(): Promise<Freeze[]> {
  const snap = await getDocs(col('freezes'))
  return snap.docs.map((d) => d.data() as Freeze)
}

export async function getFreezesBySubscription(
  subscription_id: string,
): Promise<Freeze[]> {
  const q = query(col('freezes'), where('subscription_id', '==', subscription_id))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as Freeze)
}

export async function addFreeze(
  freeze: Omit<Freeze, 'id' | 'updated_at'>,
  supervisor_name?: string,
  skipLog = false,
): Promise<Freeze> {
  const record = stampUpdatedAt({ ...freeze, id: makeId('freezes') })
  // Fire-and-forget local cache write.
  fireWrite(setDoc(docRef('freezes', record.id), stripUndefined(record)))
  if (!skipLog) {
    const [sub, member, type] = await Promise.all([
      getSubscription(record.subscription_id),
      getSubscription(record.subscription_id).then((s) => (s ? getMember(s.member_id) : undefined)),
      getSubscription(record.subscription_id).then((s) => (s ? getSubscriptionType(s.type_id) : undefined)),
    ])
    const memberName = member?.name ?? sub?.member_id ?? record.subscription_id
    const typeName = type?.name ?? sub?.type_id ?? ''
    const actor = supervisor_name ?? record.supervisor_name ?? 'النظام'
    await addActivityLog({
      action_type: 'freeze_add',
      description: `تم تجميد اشتراك العضو ${memberName} - ${typeName}`,
      supervisor_name: actor,
      entity_id: record.id,
    })
  }
  return record
}

export async function updateFreeze(
  id: string,
  patch: Partial<Omit<Freeze, 'id'>>,
  supervisor_name: string = 'النظام',
  skipLog = false,
): Promise<Freeze | undefined> {
  const ref = docRef('freezes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return undefined
  // Field-level merge — see updateMember for rationale. Fire-and-forget.
  fireWrite(updateDoc(ref, stripUndefined(stampUpdatedAt({ ...patch }))))

  const updated = (await getDoc(ref)).data() as Freeze
  if (!skipLog) {
    const sub = await getSubscription(updated.subscription_id)
    const member = sub ? await getMember(sub.member_id) : undefined
    const memberName = member?.name ?? sub?.member_id ?? updated.subscription_id
    void addActivityLog({
      action_type: 'freeze_update',
      description: `تم تحديث تجميد العضو ${memberName}`,
      supervisor_name,
      entity_id: id,
    })
  }
  return updated
}

/* ----------------------------------------------------------------
 * SUBSCRIPTION TYPES
 * ---------------------------------------------------------------- */

export async function getSubscriptionTypes(): Promise<SubscriptionType[]> {
  const snap = await getDocs(col('subscriptionTypes'))
  return snap.docs.map((d) => d.data() as SubscriptionType)
}

export async function getSubscriptionType(
  id: string,
): Promise<SubscriptionType | undefined> {
  const snap = await getDoc(docRef('subscriptionTypes', id))
  return snap.exists() ? (snap.data() as SubscriptionType) : undefined
}

export async function addSubscriptionType(
  type: Omit<SubscriptionType, 'id' | 'updated_at'>,
): Promise<SubscriptionType> {
  const record = stampUpdatedAt({ ...type, id: makeId('subscriptionTypes') })
  fireWrite(setDoc(docRef('subscriptionTypes', record.id), stripUndefined(record)))
  return record
}

export async function updateSubscriptionType(
  id: string,
  patch: Partial<Omit<SubscriptionType, 'id'>>,
): Promise<SubscriptionType | undefined> {
  const ref = docRef('subscriptionTypes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return undefined
  // Field-level merge — see updateMember for rationale. Fire-and-forget.
  fireWrite(updateDoc(ref, stripUndefined(stampUpdatedAt({ ...patch }))))
  return (await getDoc(ref)).data() as SubscriptionType
}

/* ----------------------------------------------------------------
 * SEEDING
 * On first run, populate subscriptionTypes from seed data if empty.
 * ---------------------------------------------------------------- */

let seedRunGuard: Promise<void> | null = null

export async function seedIfEmpty(): Promise<void> {
  if (seedRunGuard) return seedRunGuard
  seedRunGuard = (async () => {
    const existing = await getSubscriptionTypes()
    if (existing.length > 0) return
    const batch = writeBatch(db)
    for (const t of DEFAULT_SUBSCRIPTION_TYPES) {
      const record = { ...t, updated_at: now() } as SubscriptionType
      batch.set(docRef('subscriptionTypes', makeId('subscriptionTypes')), stripUndefined(record))
    }
    // Fire-and-forget: batch commits to local cache immediately; the
    // subscriptionTypes listener reflects them at once. Server ack not awaited.
    fireWrite(batch.commit())
    void addActivityLog({
      action_type: 'seed',
      description: 'تم تهيئة أنواع الاشتراكات الافتراضية',
      supervisor_name: 'النظام',
    })
  })()
  return seedRunGuard
}

/* ----------------------------------------------------------------
 * RESET
 * Clears all data (Firestore documents) and re-seeds the default
 * subscription types, returning the app to a fresh state.
 * ---------------------------------------------------------------- */

export async function resetDatabase(): Promise<void> {
  const collections: EntityName[] = [
    'members',
    'subscriptions',
    'payments',
    'freezes',
    'activityLog',
    'subscriptionTypes',
  ]
  for (const name of collections) {
    const snap = await getDocs(col(name))
    if (snap.empty) continue
    const batch = writeBatch(db)
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
  }
  await seedIfEmpty()
}

/* ================================================================
 * REAL-TIME SUBSCRIPTIONS (onSnapshot)
 *
 * These return an Unsubscribe function. Callers attach them in a
 * useEffect and unsubscribe on unmount. This is how changes on one
 * device appear on another automatically — no polling.
 * ================================================================ */

/* Shared wrapper that maps a Firestore snapshot to typed data and forwards
 * listener errors so the UI can show a connection error instead of hanging
 * on the loading spinner forever. */
type Listener<T> = (data: T) => void
type ErrHandler = (err: unknown) => void

function live<T>(
  ref: DocumentReference | Query,
  map: (snap: unknown) => T,
  cb: Listener<T>,
  onError?: ErrHandler,
): Unsubscribe {
  // `include,Changes` is critical for offline support: without it,
  // onSnapshot may suppress cache-only snapshots when the server
  // hasn't responded yet — which means the listener never fires while
  // offline, leaving the UI stuck on loading. With it, we always get
  // the cache snapshot first, so the UI shows data immediately and
  // syncs silently when the server round-trip completes later.
  return onSnapshot(
    ref as never,
    { includeMetadataChanges: true },
    (snap) => cb(map(snap)),
    (err) => onError?.(err),
  )
}

export function onMembersChange(cb: Listener<Member[]>, onError?: ErrHandler): Unsubscribe {
  return live(col('members'), (s) => (s as QuerySnapshot).docs.map((d) => d.data() as Member), cb, onError)
}

export function onSubscriptionsChange(cb: Listener<Subscription[]>, onError?: ErrHandler): Unsubscribe {
  return live(col('subscriptions'), (s) => (s as QuerySnapshot).docs.map((d) => d.data() as Subscription), cb, onError)
}

export function onSubscriptionTypesChange(cb: Listener<SubscriptionType[]>, onError?: ErrHandler): Unsubscribe {
  return live(col('subscriptionTypes'), (s) => (s as QuerySnapshot).docs.map((d) => d.data() as SubscriptionType), cb, onError)
}

export function onActivityLogChange(cb: Listener<ActivityLog[]>, onError?: ErrHandler): Unsubscribe {
  const q = query(col('activityLog'), orderBy('timestamp', 'desc'))
  return live(q, (s) => (s as QuerySnapshot).docs.map((d) => d.data() as ActivityLog), cb, onError)
}

export function onPaymentsChange(cb: Listener<Payment[]>, onError?: ErrHandler): Unsubscribe {
  return live(col('payments'), (s) => (s as QuerySnapshot).docs.map((d) => d.data() as Payment), cb, onError)
}

export function onFreezesChange(cb: Listener<Freeze[]>, onError?: ErrHandler): Unsubscribe {
  return live(col('freezes'), (s) => (s as QuerySnapshot).docs.map((d) => d.data() as Freeze), cb, onError)
}

/* Per-entity real-time helpers (used by the member profile page). */

export function onMemberChange(
  id: string,
  cb: (member: Member | undefined) => void,
  onError?: ErrHandler,
): Unsubscribe {
  return live(
    docRef('members', id),
    (s) => {
      const snap = s as DocumentSnapshot
      return snap.exists() ? (snap.data() as Member) : undefined
    },
    cb,
    onError,
  )
}

export function onSubscriptionsByMemberChange(
  member_id: string,
  cb: Listener<Subscription[]>,
  onError?: ErrHandler,
): Unsubscribe {
  const q = query(col('subscriptions'), where('member_id', '==', member_id))
  return live(q, (s) => (s as QuerySnapshot).docs.map((d) => d.data() as Subscription), cb, onError)
}

export function onFreezesBySubscriptionChange(
  subscription_id: string,
  cb: Listener<Freeze[]>,
  onError?: ErrHandler,
): Unsubscribe {
  const q = query(col('freezes'), where('subscription_id', '==', subscription_id))
  return live(q, (s) => (s as QuerySnapshot).docs.map((d) => d.data() as Freeze), cb, onError)
}

export function onPaymentsBySubscriptionChange(
  subscription_id: string,
  cb: Listener<Payment[]>,
  onError?: ErrHandler,
): Unsubscribe {
  const q = query(col('payments'), where('subscription_id', '==', subscription_id))
  return live(q, (s) => (s as QuerySnapshot).docs.map((d) => d.data() as Payment), cb, onError)
}
