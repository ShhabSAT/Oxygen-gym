import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import {
  GenderField,
  TextAreaField,
  TextField,
  useDebounced,
} from './fields'
import {
  addActivityLog,
  addMember,
  addPayment,
  addSubscription,
  getMembers,
  getSubscriptionTypes,
} from '../../lib/store'
import { fuzzyArabicIncludes } from '../../lib/arabic'
import { addDays } from '../../lib/status'
import { todayLocal } from '../../lib/date'
import { formatNumber } from '../../lib/format'
import { useSupervisor } from '../../context/SupervisorContext'
import type { Gender, Member, SubscriptionType } from '../../types'

interface RegisterSheetProps {
  open: boolean
  onClose: () => void
  onRegistered?: (member: Member) => void
}

const PRESET_DURATIONS = [
  { days: 1, label: 'يوم' },
  { days: 30, label: 'شهر (30 يوم)' },
  { days: 90, label: '3 أشهر (90 يوم)' },
  { days: 180, label: '6 أشهر (180 يوم)' },
  { days: 365, label: 'سنة (365 يوم)' },
]
const CUSTOM_DURATION = -1

export function RegisterSheet({ open, onClose, onRegistered }: RegisterSheetProps) {
  const { supervisor } = useSupervisor()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('men')
  const [phone, setPhone] = useState('')
  const [goal, setGoal] = useState('')
  const [notes, setNotes] = useState('')
  const [allMembers, setAllMembers] = useState<Member[]>([])

  const [types, setTypes] = useState<SubscriptionType[]>([])
  const [typeId, setTypeId] = useState('')
  const [durationMode, setDurationMode] = useState<number>(30)
  const [customDays, setCustomDays] = useState('')
  const [overridePrice, setOverridePrice] = useState(false)
  const [actualPrice, setActualPrice] = useState('')
  const [initialPayment, setInitialPayment] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const debouncedName = useDebounced(name, 300)

  useEffect(() => {
    if (open) {
      void getMembers().then(setAllMembers)
      void getSubscriptionTypes().then(setTypes)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setName('')
      setPhone('')
      setGoal('')
      setNotes('')
      setGender('men')
      setTypeId('')
      setDurationMode(30)
      setCustomDays('')
      setOverridePrice(false)
      setActualPrice('')
      setInitialPayment('')
      setSubmitting(false)
      setSubmitError(null)
    }
  }, [open])

  const nameSuggestions = useMemo(() => {
    if (!debouncedName.trim()) return []
    const q = debouncedName.trim()
    return allMembers.filter((m) => fuzzyArabicIncludes(m.name, q)).slice(0, 5)
  }, [debouncedName, allMembers])

  const selectedType = useMemo(
    () => types.find((t) => t.id === typeId),
    [types, typeId],
  )

  const basePrice = useMemo(() => {
    if (!selectedType) return 0
    return gender === 'women' ? selectedType.price_women : selectedType.price_men
  }, [selectedType, gender])

  const durationDays =
    durationMode === CUSTOM_DURATION ? Number(customDays) || 0 : durationMode

  const computedPrice = useMemo(() => {
    if (!basePrice || !durationDays) return 0
    return Math.round(basePrice * (durationDays / 30))
  }, [basePrice, durationDays])

  useEffect(() => {
    if (selectedType) {
      const price = overridePrice ? Number(actualPrice) || 0 : computedPrice
      if (!overridePrice) setActualPrice(String(computedPrice))
      setInitialPayment(String(price))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, computedPrice, overridePrice])

  function changeType(id: string) {
    setTypeId(id)
  }

  function toggleOverride(next: boolean) {
    setOverridePrice(next)
    if (!next) {
      setActualPrice(String(computedPrice))
      setInitialPayment(String(computedPrice))
    }
  }

  function fillFromSuggestion(m: Member) {
    setName(m.name)
    if (m.phone) setPhone(m.phone)
    setGender(m.gender)
  }

  async function handleNew() {
    if (!name.trim() || !typeId || !durationDays) return
    setSubmitting(true)
    setSubmitError(null)

    const price = overridePrice ? Number(actualPrice) || 0 : computedPrice
    const paid = Number(initialPayment) || 0
    const startDate = todayLocal()
    const endDate = addDays(startDate, durationDays)

    // The store helpers queue writes into the local cache immediately
    // (fire-and-forget, no server ack awaited). The `await` here only waits
    // on instant cache reads used to build the returned record — so it
    // resolves at once, online OR offline. The list updates via onSnapshot.
    const member = await addMember(
      {
        name: name.trim(),
        gender,
        phone: phone.trim(),
        goal: goal.trim() || undefined,
        notes: notes.trim() || undefined,
        first_registration_date: startDate,
        status: 'active',
      },
      supervisor,
    )

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

    const typeName = selectedType?.name ?? ''
    await addActivityLog({
      action_type: 'register',
      description: `تم تسجيل عضو جديد ${member.name} وبدء اشتراك ${typeName} (${formatNumber(price)} ل.س)${
        paid > 0 ? ` مع دفعة أولى ${formatNumber(paid)} ل.س` : ''
      }`,
      supervisor_name: supervisor,
      entity_id: member.id,
    })

    setSubmitting(false)
    onRegistered?.(member)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="تسجيل عضو جديد">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void handleNew()
        }}
      >
        {submitError && (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-400 ring-1 ring-red-500/30">
            {submitError}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <TextField
            label="الاسم"
            value={name}
            onChange={setName}
            placeholder="أدخل اسم العضو"
            required
          />
          {nameSuggestions.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl bg-oxygen-black-deep p-2 ring-1 ring-oxygen-silver/15">
              <p className="px-2 text-xs font-medium text-oxygen-silver">
                مطابق محتمل
              </p>
              {nameSuggestions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => fillFromSuggestion(m)}
                  className="flex items-center justify-between rounded-lg bg-oxygen-black-deep px-3 py-2 text-start ring-1 ring-oxygen-silver/10 hover:ring-oxygen-red"
                >
                  <div>
                    <p className="font-semibold text-oxygen-silver-light">{m.name}</p>
                    <p className="text-xs text-oxygen-silver">
                      {m.phone || '— هاتف'} — {m.gender === 'men' ? 'ذكر' : 'أنثى'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <GenderField value={gender} onChange={setGender} />
        <TextField
          label="رقم الهاتف"
          value={phone}
          onChange={setPhone}
          placeholder="09xxxxxxxx"
          type="tel"
        />
        <TextField
          label="الهدف (اختياري)"
          value={goal}
          onChange={setGoal}
          placeholder="مثال: بناء عضلي"
        />
        <TextAreaField
          label="ملاحظات (اختياري)"
          value={notes}
          onChange={setNotes}
          placeholder="أي ملاحظات"  
        />

        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm font-bold text-oxygen-silver">إعداد الاشتراك</p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="reg-type"
            className="text-sm font-medium text-oxygen-silver-light"
          >
            نوع الاشتراك
          </label>
          <select
            id="reg-type"
            value={typeId}
            onChange={(e) => changeType(e.target.value)}
            className="h-12 rounded-xl bg-oxygen-black-deep px-4 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
          >
            <option value="">اختر النوع</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({gender === 'women' ? t.price_women : t.price_men})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="reg-duration"
            className="text-sm font-medium text-oxygen-silver-light"
          >
            المدة
          </label>
          <select
            id="reg-duration"
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
            id="reg-override"
            type="checkbox"
            checked={overridePrice}
            onChange={(e) => toggleOverride(e.target.checked)}
            className="h-5 w-5 accent-oxygen-red"
          />
          <label htmlFor="reg-override" className="text-sm text-oxygen-silver-light">
            تجاوز السعر المحسوب
          </label>
        </div>

        <TextField
          label={overridePrice ? 'السعر الفعلي' : 'السعر الفعلي'}
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
          label="الدفعة الأولى"
          value={initialPayment}
          onChange={setInitialPayment}
          type="number"
          placeholder="0"
        />

        <button
          type="submit"
          disabled={submitting || !name.trim() || !typeId || !durationDays}
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-red font-bold text-white transition-colors hover:bg-oxygen-red-dark disabled:opacity-50"
        >
          {submitting ? 'جارٍ الحفظ…' : 'تسجيل العضو وبدء الاشتراك'}
        </button>
      </form>
    </BottomSheet>
  )
}
