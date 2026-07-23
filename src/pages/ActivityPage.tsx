import { useEffect, useMemo, useState } from 'react'
import {
  Pencil,
  Tag,
  Receipt,
  RefreshCw,
  Snowflake,
  Sun,
  Trash2,
  UserPlus,
  ScrollText,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { onActivityLogChange } from '../lib/store'
import { useLiveData, type LiveSource } from '../lib/useLiveData'
import { PTR_EVENT } from '../components/PullToRefresh'
import { useSupervisor } from '../context/SupervisorContext'
import type { ActivityActionType, ActivityLog } from '../types'

const ICONS: Record<ActivityActionType, LucideIcon> = {
  register: UserPlus,
  member_add: UserPlus,
  member_update: Pencil,
  member_delete: Trash2,
  renew: RefreshCw,
  subscription_add: RefreshCw,
  subscription_update: Pencil,
  subscription_delete: Trash2,
  payment_add: Receipt,
  freeze: Snowflake,
  unfreeze: Sun,
  freeze_add: Snowflake,
  freeze_update: Sun,
  price_update: Tag,
  type_delete: Trash2,
  sync: RefreshCw,
  seed: Tag,
  other: ScrollText,
}

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString('ar-SY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ActivityPage() {
  const { supervisor, allowedSupervisors } = useSupervisor()
  const [logs, setLogs] = useState<ActivityLog[]>([])

  const sources: LiveSource<unknown>[] = [
    {
      subscribe: (onData, onError) =>
        onActivityLogChange(onData as (l: ActivityLog[]) => void, onError),
      onData: (data) => setLogs(data as ActivityLog[]),
    },
  ]
  const { loading, error, retry } = useLiveData(sources)

  // Pull-to-refresh: re-fetch this page's data when the gesture fires.
  useEffect(() => {
    const onPtr = () => {
      retry()
      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent(PTR_EVENT + ':done')),
        800,
      )
    }
    window.addEventListener(PTR_EVENT, onPtr)
    return () => window.removeEventListener(PTR_EVENT, onPtr)
  }, [retry])

  // Multi‑supervisor accounts (طارق / رامي) see all logs.
  // Single‑supervisor accounts only see their own activity.
  const visibleLogs = useMemo(() => {
    if (allowedSupervisors.length > 1) return logs
    return logs.filter((l) => l.supervisor_name === supervisor)
  }, [logs, supervisor, allowedSupervisors])

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-2xl font-extrabold text-oxygen-silver-light">
        سجل النشاطات
      </h2>

      {error ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <WifiOff className="h-10 w-10 text-oxygen-red-light" />
          <p className="text-oxygen-silver-light">{error}</p>
          <button
            onClick={retry}
            className="flex items-center gap-2 rounded-xl bg-oxygen-red px-4 py-2 font-bold text-white hover:bg-oxygen-red-dark"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </button>
        </div>
      ) : loading ? (
        <p className="py-10 text-center text-oxygen-silver">جارٍ التحميل…</p>
      ) : visibleLogs.length === 0 ? (
        <p className="rounded-xl bg-oxygen-black p-6 text-center text-oxygen-silver">
          لا يوجد نشاطات بعد
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleLogs.map((log) => {
            const Icon = ICONS[log.action_type] ?? ScrollText
            return (
              <li
                key={log.id}
                className="flex items-start gap-3 rounded-xl bg-oxygen-black p-4 ring-1 ring-oxygen-silver/10"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oxygen-red/15 text-oxygen-red-light">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-oxygen-silver-light">
                    {log.description}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-oxygen-silver">
                    <span>بواسطة: {log.supervisor_name}</span>
                    <span>{formatDateTime(log.timestamp)}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
