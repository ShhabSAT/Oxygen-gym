import {
  writeBatch,
  doc,
  getDocs,
  collection,
} from 'firebase/firestore'
import type {
  ActivityLog,
  Freeze,
  Member,
  Payment,
  Subscription,
  SubscriptionType,
} from '../types'
import {
  getMembers,
  getSubscriptions,
  getPayments,
  getFreezes,
  getActivityLogs,
  stripUndefined,
  getSubscriptionTypes,
  fireWrite,
} from './store'
import { db as firestore } from './firebase'

interface BackupData {
  version: number
  exportedAt: string
  data: {
    members: Member[]
    subscriptions: Subscription[]
    payments: Payment[]
    freezes: Freeze[]
    activityLog: ActivityLog[]
    subscriptionTypes: SubscriptionType[]
  }
}

const BACKUP_VERSION = 1

type OxygenGymDBStores =
  | 'members'
  | 'subscriptions'
  | 'payments'
  | 'freezes'
  | 'activityLog'
  | 'subscriptionTypes'

/* ----------------------------------------------------------------
 * MANUAL BACKUP — EXPORT
 * Reads every store from IndexedDB and produces a single JSON file.
 * ---------------------------------------------------------------- */

export async function buildBackup(): Promise<BackupData> {
  const [members, subscriptions, payments, freezes, activityLog, subscriptionTypes] =
    await Promise.all([
      getMembers(),
      getSubscriptions(),
      getPayments(),
      getFreezes(),
      getActivityLogs(),
      getSubscriptionTypes(),
    ])

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { members, subscriptions, payments, freezes, activityLog, subscriptionTypes },
  }
}

// Local (device) date+time stamp for backup filenames so the user can see
// exactly when a backup was made in their own timezone (Syria). Uses local
// getters, NOT toISOString(), which would be UTC and drift by up to 3h.
function fileStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportBackup(): Promise<string> {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const filename = `oxygen-gym-backup-${fileStamp()}.json`
  triggerDownload(blob, filename)
  return filename
}

/* ----------------------------------------------------------------
 * CUSTOMER BACKUP — EXPORT (members + their details only)
 * Exports members, subscriptions, payments and freezes — but NOT the
 * activity log or subscription-type catalog, so restoring customers
 * never wipes system/configuration data.
 * ---------------------------------------------------------------- */

export async function exportCustomersBackup(): Promise<string> {
  const [members, subscriptions, payments, freezes] = await Promise.all([
    getMembers(),
    getSubscriptions(),
    getPayments(),
    getFreezes(),
  ])
  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    scope: 'customers',
    data: { members, subscriptions, payments, freezes },
  }
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const filename = `oxygen-gym-customers-${fileStamp()}.json`
  triggerDownload(blob, filename)
  return filename
}

/* ----------------------------------------------------------------
 * MANUAL BACKUP — IMPORT
 * Parses a previously exported JSON file and overwrites the chosen
 * stores. `importBackup` replaces EVERYTHING; `importCustomersBackup`
 * replaces only the customer data (members/subscriptions/payments/
 * freezes), leaving the activity log and subscription-type catalog
 * untouched.
 * ---------------------------------------------------------------- */

export interface ImportResult {
  ok: boolean
  counts: Record<string, number>
  error?: string
}

const ALL_STORES: OxygenGymDBStores[] = [
  'members',
  'subscriptions',
  'payments',
  'freezes',
  'activityLog',
  'subscriptionTypes',
]

const CUSTOMER_STORES: OxygenGymDBStores[] = [
  'members',
  'subscriptions',
  'payments',
  'freezes',
]

export async function importBackup(json: string): Promise<ImportResult> {
  return doImport(json, ALL_STORES)
}

export async function importCustomersBackup(json: string): Promise<ImportResult> {
  return doImport(json, CUSTOMER_STORES)
}

async function doImport(json: string, storeList: OxygenGymDBStores[]): Promise<ImportResult> {
  let parsed: BackupData
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, counts: {}, error: 'ملف النسخة الاحتياطية غير صالح (JSON)' }
  }

  const data = parsed?.data
  if (!data) {
    return { ok: false, counts: {}, error: 'بنية النسخة الاحتياطية غير مدعومة' }
  }

  const counts: Record<string, number> = {}
  for (const storeName of storeList) {
    const records = (data[storeName] as Array<{ id: string }>) ?? []
    // Overwrite the collection entirely: clear then re-add.
    await overwriteCollection(storeName, records)
    counts[storeName] = records.length
  }

  return { ok: true, counts }
}

async function overwriteCollection(
  name: OxygenGymDBStores,
  records: Array<{ id: string }>,
): Promise<void> {
  // Clear existing docs
  const existingSnap = await getDocs(collection(firestore, name))
  if (!existingSnap.empty) {
    const delBatch = writeBatch(firestore)
    for (const d of existingSnap.docs) delBatch.delete(d.ref)
    // Fire-and-forget: queued to local cache immediately; resolves on the
    // server only, so awaiting would hang the UI while offline.
    fireWrite(delBatch.commit())
  }
  // Write imported docs by id
  const batch = writeBatch(firestore)
  for (const rec of records) {
    batch.set(doc(firestore, name, rec.id), stripUndefined(rec))
  }
  fireWrite(batch.commit())
}

/* ----------------------------------------------------------------
 * WEEKLY AUTOMATIC BACKUP
 * The app downloads a FULL backup automatically — no time picker, no
 * per-admin schedule. It runs the first time the app is opened on a
 * device and then again every 7 days (while the app is open, including
 * immediately on open). The last-run ISO timestamp lives in localStorage;
 * isWeeklyBackupDue() checks the 7-day interval. Elapsed-time math uses
 * Date.now(), which is timezone-independent, so it is correct in Syria.
 * ---------------------------------------------------------------- */

const AUTO_BACKUP_KEY = 'oxygen_last_auto_backup'
const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export function getLastAutoBackup(): string | null {
  return localStorage.getItem(AUTO_BACKUP_KEY)
}

/** True if no backup exists yet, or the last one is ≥ 7 days old. */
export function isWeeklyBackupDue(): boolean {
  const last = getLastAutoBackup()
  if (!last) return true
  const t = new Date(last).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t >= WEEKLY_INTERVAL_MS
}

/** Download a full backup now and stamp the last-run time. */
export async function createFullBackup(): Promise<string> {
  const filename = await exportBackup()
  localStorage.setItem(AUTO_BACKUP_KEY, new Date().toISOString())
  return filename
}

/** Manual "backup now" button. */
export async function runAutoBackupNow(): Promise<{ ran: boolean; filename?: string }> {
  const filename = await createFullBackup()
  return { ran: true, filename }
}
