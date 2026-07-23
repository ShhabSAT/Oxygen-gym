import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import { TextField } from './fields'
import {
  addActivityLog,
  addPayment,
  addSubscription,
  getSubscriptionTypes,
} from '../../lib/store'
import { addDays } from '../../lib/status'
import { todayLocal } from '../../lib/date'
import { formatNumber } from '../../lib/format'
import { useSupervisor } from '../../context/SupervisorContext'
import type { Member, SubscriptionType } from '../../types'

interface RenewSheetProps {
  open: boolean
  member: Member | null
  onClose: () => void
  onRenewed: () => void
}

const PRESET_DURATIONS = [
  { days: 1, label: 'يوم' },
  { days: 30, label: 'شهر (30 يوم)' },
  { days: 90, label: '3 أشهر (90 يوم)' },
  { days: 180, label: '6 أشهر (180 يوم)' },
  { days: 365, label: 'سنة (365 يوم)' },
]
const CUSTOM_DURATION = -1

export function RenewSheet({ open, member, onClose, onRenewed }: RenewSheetProps) {
  const { supervisor } = useSupervisor()
  const [types, setTypes] = useState<SubscriptionType[]>([])
  const [typeId, setTypeId] = useState('')
  const [durationMode, setDurationMode] = useState<number>(30)
  const [customDays, setCustomDays] = useState('')
  const [overridePrice, setOverridePrice] = useState(false)
  const [actualPrice, setActualPrice] = useState('')
  const [initialPayment, setInitialPayment] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (open) void getSubscriptionTypes().then(setTypes)
  }, [open])

  const selectedType = useMemo(
    () => types.find((t) => t.id === typeId),
    [types, typeId],
  )

  const basePrice = useMemo(() => {
    if (!selectedType || !member) return 0
    return member.gender === 'women' ? selectedType.price_women : selectedType.price_men
  }, [selectedType, member])

  const durationDays = durationMode === CUSTOM_DURATION ? Number(customDays) || 0 : durationMode

  const computedPrice = useMemo(() => {
    if (!basePrice || !durationDays) return 0
    return Math.round(basePrice * (durationDays / 30))
  }, [basePrice, durationDays])

  useEffect(() => {
    if (selectedType && member) {
      if (!overridePrice) setActualPrice(computedPrice ? String(computedPrice) : '')
      const price = overridePrice ? Number(actualPrice) || 0 : computedPrice
      setInitialPayment(price ? String(price) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, member, computedPrice, overridePrice])

  function changeType(id: string) {
    setTypeId(id)
  }

  function toggleOverride(next: boolean) {
    setOverridePrice(next)
    if (!next) {
      setActualPrice(computedPrice ? String(computedPrice) : '')
      setInitialPayment(computedPrice ? String(computedPrice) : '')
    }
  }

  async function handleRenew() {
    if (!member || !typeId || !durationDays) return
    const price = overridePrice ? Number(actualPrice) || 0 : computedPrice
    const paid = Number(initialPayment) || 0
    const startDate = todayLocal()
    const endDate = addDays(startDate, durationDays)

    setSaving(true)
    setSaveError(null)
    // All writes below queue into the local cache instantly (fire-and-forget
    // inside store.ts). The `await`s only wait on instant cache reads, so the
    // new subscription shows up via the listener right away; we close the
    // sheet immediately and never await server ack.
    // Suppress the per-record logs so the whole renewal is ONE activity entry.
    const sub = await addSubscription(
      {
        member_id: member.id,
        type_id: typeId,
        start_date: startDate,
        end_date: endDate,
        base_price: basePrice,
        actual_price: price,
        duration_days: durationDays,
        status: 'active',
      },
      supervisor,
      true,
    )
    if (paid > 0) {
      await addPayment(
        {
          subscription_id: sub.id,
          amount: paid,
          date: startDate,
          supervisor_name: supervisor,
        },
        supervisor,
        true,
      )
    }
    await addActivityLog({
      action_type: 'renew',
      description: `تم تجديد اشتراك العضو ${member.name} - ${selectedType?.name ?? ''} (${formatNumber(price)} ل.س)${paid > 0 ? ` مع دفعة أولى ${formatNumber(paid)} ل.س` : ''}`,
      supervisor_name: supervisor,
      entity_id: sub.id,
    })
    setSaving(false)
    onRenewed()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="تجديد الاشتراك">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void handleRenew()
        }}
      >
        <div className="flex flex-col gap-2">
          <label
            htmlFor="renew-type"
            className="text-sm font-medium text-oxygen-silver-light"
          >
            نوع الاشتراك
          </label>
          <select
            id="renew-type"
            value={typeId}
            onChange={(e) => changeType(e.target.value)}
            className="h-12 rounded-xl bg-oxygen-black-deep px-4 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
          >
            <option value="">اختر النوع</option>
            {types.filter((t) => !t.deleted).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({member?.gender === 'women' ? t.price_women : t.price_men})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="renew-duration"
            className="text-sm font-medium text-oxygen-silver-light"
          >
            المدة
          </label>
          <select
            id="renew-duration"
            value={durationMode}
            onChange={(e) => setDurationMode(Number(e.target.value))}
            className="h-12 rounded-xl bg-oxygen-black-deep px-4 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
          >
            {PRESET_DURATIONS.map((d) => (
              <option key={d.days} value={d.days}>
                {d.label}
              </option>
            ))}
            <option value={CUSTOM_DURATION}>مخصص</option>
          </select>
        </div>

        {durationMode === CUSTOM_DURATION && (
          <TextField
            label="عدد الأيام"
            value={customDays}
            onChange={setCustomDays}
            type="number"
            placeholder="مثال: 45"
            required
          />
        )}

        <div className="flex items-center gap-3 rounded-xl bg-oxygen-black-deep px-4 py-3 ring-1 ring-oxygen-silver/10">
          <input
            id="renew-override"
            type="checkbox"
            checked={overridePrice}
            onChange={(e) => toggleOverride(e.target.checked)}
            className="h-5 w-5 accent-oxygen-red"
          />
          <label htmlFor="renew-override" className="text-sm text-oxygen-silver-light">
            تجاوز السعر المحسوب
          </label>
        </div>

        <TextField
          label={overridePrice ? 'السعر الفعلي (يدوي)' : 'السعر الفعلي (محسوب)'}
          value={actualPrice}
          onChange={setActualPrice}
          type="number"
          placeholder="0"
          disabled={!overridePrice}
          required
        />
        {!overridePrice && (
          <p className="text-xs text-oxygen-silver">
            السعر المحسوب تلقائياً: {formatNumber(computedPrice)} ل.س
            (السعر الأساسي × {durationDays} يوم ÷ 30)
          </p>
        )}

        <TextField
          label="الدفعة الأولى (0 مسموح)"
          value={initialPayment}
          onChange={setInitialPayment}
          type="number"
          placeholder="0"
        />

        {saveError && (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-400 ring-1 ring-red-500/30">
            {saveError}
          </div>
        )}
        <button
          type="submit"
          disabled={saving || !typeId || !durationDays}
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-red font-bold text-white transition-colors hover:bg-oxygen-red-dark disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ…' : 'تأكيد التجديد'}
        </button>
      </form>
    </BottomSheet>
  )
}
