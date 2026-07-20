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

function todayStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
  const filename = `oxygen-gym-backup-${todayStamp()}.json`
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
  const filename = `oxygen-gym-customers-${todayStamp()}.json`
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
    await delBatch.commit()
  }
  // Write imported docs by id
  const batch = writeBatch(firestore)
  for (const rec of records) {
    batch.set(doc(firestore, name, rec.id), stripUndefined(rec))
  }
  await batch.commit()
}

/* ----------------------------------------------------------------
 * DAILY BACKUP REMINDER (per-admin / supervisor-selectable time)
 * Instead of auto-downloading, the app shows a ONE-TIME daily reminder
 * at the supervisor's chosen time (default 03:00) while the app is open,
 * prompting them to download a full backup. The time and the "reminded
 * today" flag are stored PER supervisor in localStorage, so every admin
 * gets their own schedule on their own device. The app never downloads
 * a backup by itself — only when the user taps the button.
 * ---------------------------------------------------------------- */

const AUTO_BACKUP_KEY = 'oxygen_last_auto_backup'
const AUTO_BACKUP_TIMES_KEY = 'oxygen_backup_reminder_times'
const AUTO_BACKUP_REMINDED_KEY = 'oxygen_backup_reminder_reminded'
export const DEFAULT_AUTO_BACKUP_TIME = '03:00'

export function getLastAutoBackup(): string | null {
  return localStorage.getItem(AUTO_BACKUP_KEY)
}

// ---- per-supervisor reminder time ----
function readJsonMap(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function getBackupReminderTime(supervisor: string): string {
  return readJsonMap(AUTO_BACKUP_TIMES_KEY)[supervisor] ?? DEFAULT_AUTO_BACKUP_TIME
}

export function setBackupReminderTime(supervisor: string, time: string): void {
  const map = readJsonMap(AUTO_BACKUP_TIMES_KEY)
  map[supervisor] = time
  localStorage.setItem(AUTO_BACKUP_TIMES_KEY, JSON.stringify(map))
}

// ---- per-supervisor "reminded today" flag ----
function dayStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getRemindedToday(supervisor: string): string | null {
  return readJsonMap(AUTO_BACKUP_REMINDED_KEY)[supervisor] ?? null
}

export function setRemindedToday(supervisor: string, date: Date = new Date()): void {
  const map = readJsonMap(AUTO_BACKUP_REMINDED_KEY)
  map[supervisor] = dayStamp(date)
  localStorage.setItem(AUTO_BACKUP_REMINDED_KEY, JSON.stringify(map))
}

/** True if a full backup was downloaded earlier today. */
export function backedUpToday(): boolean {
  const last = getLastAutoBackup()
  if (!last) return false
  const d = new Date(last)
  if (Number.isNaN(d.getTime())) return false
  return dayStamp(d) === dayStamp(new Date())
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
