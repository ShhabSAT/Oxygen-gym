import { useEffect, useState } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import { TextField } from './fields'
import { addActivityLog, addFreeze, getSubscriptionTypes, updateSubscription } from '../../lib/store'
import { formatNumber } from '../../lib/format'
import { addDays } from '../../lib/status'
import { todayLocal } from '../../lib/date'
import { useSupervisor } from '../../context/SupervisorContext'
import type { Member, Subscription, SubscriptionType } from '../../types'

interface FreezeSheetProps {
  open: boolean
  member: Member | null
  sub: Subscription | null
  onClose: () => void
  onFrozen: () => void
}

type FreezeMode = 'fixed' | 'open'

export function FreezeSheet({
  open,
  member,
  sub,
  onClose,
  onFrozen,
}: FreezeSheetProps) {
  const { supervisor } = useSupervisor()
  const [types, setTypes] = useState<SubscriptionType[]>([])
  const [mode, setMode] = useState<FreezeMode>('fixed')
  const [days, setDays] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setMode('fixed')
      setDays('')
      void getSubscriptionTypes().then(setTypes)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const typeName = (typeId: string) =>
    types.find((t) => t.id === typeId)?.name ?? '—'

  async function handleFreeze() {
    if (!sub || !member) return
    const duration = mode === 'fixed' ? Number(days) || 0 : 0
    if (mode === 'fixed' && !(duration > 0)) return
    const startDate = todayLocal()
    const endDate = mode === 'fixed' ? addDays(startDate, duration) : null

    setSaving(true)
    setSaveError(null)
    // All writes below queue into the local cache instantly (fire-and-forget
    // inside store.ts). The `await`s only wait on instant cache reads, so the
    // freeze reflects via the listener right away; we close immediately.
    // Suppress addFreeze's internal log so the freeze is a single activity entry.
    await addFreeze(
      {
        subscription_id: sub.id,
        start_date: startDate,
        duration_days: mode === 'fixed' ? duration : null,
        end_date: endDate,
        actual_unfreeze_date: null,
        supervisor_name: supervisor,
      },
      supervisor,
      true,
    )
    await updateSubscription(sub.id, { status: 'frozen' }, supervisor)
    await addActivityLog({
      action_type: 'freeze',
      description: `تم تجميد اشتراك العضو ${member.name} - ${typeName(sub.type_id)}${
        mode === 'fixed' ? ` لمدة ${formatNumber(duration)} يوم` : ' (مفتوح)'
      }`,
      supervisor_name: supervisor,
      entity_id: sub.id,
    })
    setSaving(false)
    onFrozen()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="تجميد الاشتراك">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void handleFreeze()
        }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-oxygen-silver-light">نوع التجميد</span>
          <div className="grid grid-cols-2 gap-3">
            <FreezeOption
              selected={mode === 'fixed'}
              label="مدة محددة"
              onClick={() => setMode('fixed')}
            />
            <FreezeOption
              selected={mode === 'open'}
              label="مفتوح"
              onClick={() => setMode('open')}
            />
          </div>
        </div>

        {mode === 'fixed' && (
          <TextField
            label="عدد الأيام"
            value={days}
            onChange={setDays}
            type="number"
            placeholder="مثال: 30"
            required
          />
        )}

        {mode === 'open' && (
          <p className="rounded-xl bg-oxygen-black-deep px-4 py-3 text-sm text-oxygen-silver">
            سيبقى الاشتراك مجمداً حتى يتم إلغاء التجميد يدوياً.
          </p>
        )}

        {saveError && (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-400 ring-1 ring-red-500/30">
            {saveError}
          </div>
        )}
        <button
          type="submit"
          disabled={
            saving ||
            (mode === 'fixed' && !(Number(days) > 0))
          }
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-red font-bold text-white transition-colors hover:bg-oxygen-red-dark disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ…' : 'تأكيد التجميد'}
        </button>
      </form>
    </BottomSheet>
  )
}

function FreezeOption({
  selected,
  label,
  onClick,
}: {
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-xl font-bold transition-colors ring-1 ${
        selected
          ? 'bg-oxygen-red/20 text-oxygen-red-light ring-oxygen-red'
          : 'bg-oxygen-black-deep text-oxygen-silver ring-oxygen-silver/30 hover:ring-oxygen-red'
      }`}
    >
      {label}
    </button>
  )
}
