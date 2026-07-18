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
 * MANUAL BACKUP — CSV (members only, optional convenience export)
 * ---------------------------------------------------------------- */

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (val: unknown): string => {
    const s = val === null || val === undefined ? '' : String(val)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = rows.map((r) => headers.map((h) => escape(r[h])).join(','))
  return [headers.join(','), ...lines].join('\n')
}

export async function exportMembersCsv(): Promise<string> {
  const members = await getMembers()
  const csv = toCsv(members as unknown as Record<string, unknown>[])
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const filename = `oxygen-gym-members-${todayStamp()}.csv`
  triggerDownload(blob, filename)
  return filename
}

/* ----------------------------------------------------------------
 * MANUAL BACKUP — IMPORT
 * Parses a previously exported JSON file and overwrites all stores.
 * ---------------------------------------------------------------- */

export interface ImportResult {
  ok: boolean
  counts: Record<string, number>
  error?: string
}

export async function importBackup(json: string): Promise<ImportResult> {
  let parsed: BackupData
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    return { ok: false, counts: {}, error: 'ملف النسخة الاحتياطية غير صالح (JSON)' }
  }

  const data = parsed?.data
  if (!data) {
    return { ok: false, counts: {}, error: 'بنية النسخة الاحتياطية غير مدعومة' }
  }

  const storeList: OxygenGymDBStores[] = [
    'members',
    'subscriptions',
    'payments',
    'freezes',
    'activityLog',
    'subscriptionTypes',
  ]

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
 * AUTOMATIC WEEKLY BACKUP
 * Stores the last-run date in localStorage. When more than 7 days
 * have elapsed, triggers an export download and updates the stamp.
 * ---------------------------------------------------------------- */

const AUTO_BACKUP_KEY = 'oxygen_last_auto_backup'
const AUTO_BACKUP_INTERVAL_DAYS = 7

export function getLastAutoBackup(): string | null {
  return localStorage.getItem(AUTO_BACKUP_KEY)
}

function daysSince(dateIso: string | null): number {
  if (!dateIso) return Infinity
  const then = new Date(dateIso).getTime()
  if (Number.isNaN(then)) return Infinity
  return (Date.now() - then) / (1000 * 60 * 60 * 24)
}

export async function scheduleAutoBackup(): Promise<{ ran: boolean; filename?: string }> {
  const last = getLastAutoBackup()
  if (daysSince(last) < AUTO_BACKUP_INTERVAL_DAYS) {
    return { ran: false }
  }
  const filename = await exportBackup()
  localStorage.setItem(AUTO_BACKUP_KEY, new Date().toISOString())
  return { ran: true, filename }
}
