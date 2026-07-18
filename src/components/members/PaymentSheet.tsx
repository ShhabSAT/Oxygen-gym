import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import { TextField } from './fields'
import { addPayment, getPaymentsBySubscription } from '../../lib/store'
import { useSupervisor } from '../../context/SupervisorContext'
import { formatNumber } from '../../lib/format'
import type { Member, Subscription } from '../../types'

interface PaymentSheetProps {
  open: boolean
  member: Member | null
  subs?: Subscription[]
  onClose: () => void
  onPaid?: () => void
}

export function PaymentSheet({ open, member, subs, onClose, onPaid }: PaymentSheetProps) {
  const { supervisor } = useSupervisor()
  const [subId, setSubId] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [paidTotal, setPaidTotal] = useState(0)
  const [error, setError] = useState('')

  const selectedSub = useMemo(
    () => (subs ?? []).find((s) => s.id === subId),
    [subs, subId],
  )

  useEffect(() => {
    if (!open || !member) return
    const source = subs ?? []
    const target = subId && source.some((s) => s.id === subId)
      ? subId
      : source[0]?.id ?? ''
    setSubId(target)
    setAmount('')
  }, [open, member, subs, subId])

  useEffect(() => {
    if (!open || !selectedSub) {
      setPaidTotal(0)
      return
    }
    let active = true
    getPaymentsBySubscription(selectedSub.id).then((payments) => {
      if (!active) return
      setPaidTotal(payments.reduce((sum, p) => sum + (p.amount || 0), 0))
    })
    return () => {
      active = false
    }
  }, [open, selectedSub])

  useEffect(() => {
    setError('')
  }, [amount, subId, selectedSub])

  const outstandingDebt = selectedSub
    ? Math.max(0, selectedSub.actual_price - paidTotal)
    : 0

  async function handlePay() {
    if (!member || !subId) return
    const value = Number(amount) || 0
    if (value <= 0) return
    if (selectedSub && value > outstandingDebt) {
      setError(`المبلغ يتجاوز الدين المستحق البالغ ${formatNumber(outstandingDebt)} ل.س`)
      return
    }
    setError('')
    setSaving(true)
    const date = new Date().toISOString().slice(0, 10)
    // addPayment queues into the local cache instantly (the await only waits
    // on the instant cache read for the member name). Close right away.
    await addPayment(
      {
        subscription_id: subId,
        amount: value,
        date,
        supervisor_name: supervisor,
      },
      supervisor,
    )
    setSaving(false)
    onPaid?.()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="تسجيل دفعة">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void handlePay()
        }}
      >
        {member && (
          <p className="rounded-xl bg-oxygen-black-deep px-4 py-3 text-oxygen-silver-light">
            {member.name}
          </p>
        )}

        {(subs ?? []).length > 1 && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-oxygen-silver-light">
              الاشتراك
            </label>
            <select
              value={subId}
              onChange={(e) => setSubId(e.target.value)}
              className="h-12 rounded-xl bg-oxygen-black-deep px-4 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
            >
              {(subs ?? []).map((s, i) => (
                <option key={s.id} value={s.id}>
                  اشتراك {i + 1} ({s.end_date})
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedSub && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-oxygen-silver">
              السعر الإجمالي: {formatNumber(selectedSub.actual_price)} ل.س
            </p>
            <p className="text-xs text-oxygen-silver">
              الدين المستحق: {formatNumber(outstandingDebt)} ل.س
            </p>
          </div>
        )}

        <TextField
          label="مبلغ الدفعة"
          value={amount}
          onChange={setAmount}
          type="number"
          placeholder="0"
        />

        {error && <p className="text-sm text-oxygen-red-light">{error}</p>}

        <button
          type="submit"
          disabled={saving || !subId || (Number(amount) || 0) <= 0 || !!error}
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-red font-bold text-white transition-colors hover:bg-oxygen-red-dark disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ…' : 'تأكيد الدفعة'}
        </button>
      </form>
    </BottomSheet>
  )
}
