import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  CreditCard,
  Pencil,
  RefreshCw,
  Snowflake,
  Trash2,
  WifiOff,
} from 'lucide-react'
import {
  addActivityLog,
  deleteMember,
  getFreezesBySubscription,
  getPaymentsBySubscription,
  updateFreeze,
  updateSubscription,
  onMemberChange,
  onSubscriptionsByMemberChange,
  onSubscriptionTypesChange,
} from '../lib/store'
import { useLiveData, type LiveSource } from '../lib/useLiveData'
import {
  addDays,
  formatDate,
  getMemberStatus,
  STATUS_LABELS,
  type MemberStatus,
} from '../lib/status'
import { formatNumber } from '../lib/format'
import { todayLocal } from '../lib/date'
import { EditSheet } from '../components/members/EditSheet'
import { RenewSheet } from '../components/members/RenewSheet'
import { PaymentSheet } from '../components/members/PaymentSheet'
import { FreezeSheet } from '../components/members/FreezeSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useSupervisor } from '../context/SupervisorContext'
import type {
  Freeze,
  Member,
  Payment,
  Subscription,
  SubscriptionType,
} from '../types'

const STATUS_STYLES: Record<MemberStatus, string> = {
  active: 'bg-green-500/20 text-green-400 ring-green-500/40',
  expired: 'bg-gray-500/20 text-gray-400 ring-gray-500/40',
  frozen: 'bg-blue-500/20 text-blue-400 ring-blue-500/40',
}

const GENDER_LABELS: Record<'men' | 'women', string> = {
  men: 'ذكر',
  women: 'أنثى',
}

export function MemberProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [member, setMember] = useState<Member | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [types, setTypes] = useState<SubscriptionType[]>([])
  const [notFound, setNotFound] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [freezeOpen, setFreezeOpen] = useState(false)
  const [freezeTarget, setFreezeTarget] = useState<Subscription | null>(null)
  const [unfreezeTarget, setUnfreezeTarget] = useState<Subscription | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { supervisor } = useSupervisor()

  const sources: LiveSource<unknown>[] = id
    ? [
        {
          subscribe: (onData, onError) =>
            onMemberChange(id, onData as (m: Member | undefined) => void, onError),
          onData: (m) => {
            const member = m as Member | undefined
            if (!member) {
              setNotFound(true)
              return
            }
            setMember(member)
          },
        },
        {
          subscribe: (onData, onError) =>
            onSubscriptionsByMemberChange(
              id,
              onData as (s: Subscription[]) => void,
              onError,
            ),
          onData: (s) =>
            setSubs(
              (s as Subscription[]).sort((a, b) =>
                a.start_date < b.start_date ? 1 : -1,
              ),
            ),
        },
        {
          subscribe: (onData, onError) =>
            onSubscriptionTypesChange(onData as (t: SubscriptionType[]) => void, onError),
          onData: (t) => setTypes(t as SubscriptionType[]),
        },
      ]
    : []
  const { loading, error, retry } = useLiveData(sources)

  const status = useMemo<MemberStatus>(
    () => (member ? getMemberStatus(member, subs) : 'expired'),
    [member, subs],
  )

  const typeName = (typeId: string) =>
    types.find((t) => t.id === typeId)?.name ?? '—'

  async function handleDelete() {
    if (!member) return
    await deleteMember(member.id, supervisor)
    navigate('/members')
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
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
    )
  }

  if (loading) {
    return <p className="py-10 text-center text-oxygen-silver">جارٍ التحميل…</p>
  }

  if (notFound || !member) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-oxygen-silver">
        <p>العضو غير موجود</p>
        <button
          onClick={() => navigate('/members')}
          className="rounded-xl bg-oxygen-red px-4 py-2 font-bold text-white"
        >
          العودة للقائمة
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => navigate('/members')}
        className="flex items-center gap-1 self-start text-sm font-semibold text-oxygen-silver hover:text-oxygen-red-light"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للقائمة
      </button>

      <div className="flex flex-col gap-4 rounded-2xl bg-oxygen-black p-5 ring-1 ring-oxygen-silver/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-oxygen-silver-light">
              {member.name}
            </h2>
            <p className="text-oxygen-silver">{member.phone || 'لا يوجد رقم'}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ring-1 ${STATUS_STYLES[status]}`}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="الجنس" value={GENDER_LABELS[member.gender]} />
          <Info label="تاريخ أول تسجيل" value={formatDate(member.first_registration_date)} />
          <Info label="الهدف" value={member.goal || '—'} />
          <Info label="ملاحظات" value={member.notes || '—'} />
        </div>

        <MemberDebt
          subs={subs}
          onPay={() => setPayOpen(true)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setRenewOpen(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-red font-bold text-white transition-colors hover:bg-oxygen-red-dark"
        >
          <RefreshCw className="h-5 w-5" />
          تجديد الاشتراك
        </button>
        <button
          onClick={() => setEditOpen(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-black font-bold text-oxygen-silver-light ring-1 ring-oxygen-silver/30 transition-colors hover:ring-oxygen-red"
        >
          <Pencil className="h-5 w-5" />
          تعديل
        </button>
        <button
          onClick={() => setPayOpen(true)}
          className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-black font-bold text-green-400 ring-1 ring-green-500/40 transition-colors hover:bg-green-500/10"
        >
          <CreditCard className="h-5 w-5" />
          تسجيل دفعة
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-bold text-oxygen-silver-light">سجل الاشتراكات</h3>
        {subs.length === 0 ? (
          <p className="rounded-xl bg-oxygen-black p-4 text-oxygen-silver">
            لا يوجد اشتراكات بعد
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {subs.map((s) => (
                <SubscriptionCard
                  key={s.id}
                  sub={s}
                  typeName={typeName(s.type_id)}
                  onFreeze={() => {
                    setFreezeTarget(s)
                    setFreezeOpen(true)
                  }}
                  onUnfreeze={() => setUnfreezeTarget(s)}
                  onPay={() => setPayOpen(true)}
                />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setDeleteOpen(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-black font-bold text-oxygen-red-light ring-1 ring-oxygen-red/40 transition-colors hover:bg-oxygen-red/10"
      >
        <Trash2 className="h-5 w-5" />
        حذف العضو
      </button>

      <EditSheet
        open={editOpen}
        member={member}
        onClose={() => setEditOpen(false)}
        onSaved={(m) => setMember(m)}
      />
      <RenewSheet
        open={renewOpen}
        member={member}
        onClose={() => setRenewOpen(false)}
        onRenewed={() => retry()}
      />
      <PaymentSheet
        open={payOpen}
        member={member}
        subs={subs}
        onClose={() => setPayOpen(false)}
        onPaid={() => retry()}
      />
      <FreezeSheet
        open={freezeOpen}
        member={member}
        sub={freezeTarget}
        onClose={() => {
          setFreezeOpen(false)
          setFreezeTarget(null)
        }}
        onFrozen={() => retry()}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="حذف العضو"
        message={`هل أنت متأكد من حذف العضو "${member.name}"؟ لا يمكن التراجع عن هذه العملية.`}
        confirmLabel="نعم، حذف"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
      <ConfirmDialog
        open={!!unfreezeTarget}
        title="إلغاء التجميد"
        message="هل تريد إلغاء تجميد هذا الاشتراك وتمديد تاريخ نهايته بعدد أيام التجميد؟"
        confirmLabel="تأكيد الإلغاء"
        onConfirm={() => void handleUnfreeze()}
        onCancel={() => setUnfreezeTarget(null)}
      />
    </div>
  )

  async function handleUnfreeze() {
    if (!unfreezeTarget || !member) return
    const sub = unfreezeTarget
    const freezes = await getFreezesBySubscription(sub.id)
    const activeFreeze = freezes.find((f) => !f.actual_unfreeze_date)
    if (!activeFreeze) {
      setUnfreezeTarget(null)
      return
    }
    const today = todayLocal()
    const start = new Date(activeFreeze.start_date)
    start.setHours(0, 0, 0, 0)
    const now = new Date(today)
    now.setHours(0, 0, 0, 0)
    const daysFrozen = Math.max(1, Math.round((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
    const newEndDate = addDays(sub.end_date, daysFrozen)
    const newStatus: MemberStatus = newEndDate >= today ? 'active' : 'expired'

    await updateSubscription(sub.id, {
      end_date: newEndDate,
      status: newStatus,
    }, supervisor)
    // Suppress updateFreeze's internal log; emit a single unfreeze entry below.
    await updateFreeze(activeFreeze.id, { actual_unfreeze_date: today }, supervisor)
    await addActivityLog({
      action_type: 'unfreeze',
      description: `تم إلغاء تجميد اشتراك العضو ${member.name} - تم تمديد حتى ${formatDate(
        newEndDate,
      )}`,
      supervisor_name: supervisor,
      entity_id: sub.id,
    })
    setUnfreezeTarget(null)
    retry()
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-oxygen-black-deep p-3">
      <p className="text-xs text-oxygen-silver">{label}</p>
      <p className="mt-1 font-semibold text-oxygen-silver-light">{value}</p>
    </div>
  )
}

function MemberDebt({
  subs,
  onPay,
}: {
  subs: Subscription[]
  onPay: () => void
}) {
  const [paymentsBySub, setPaymentsBySub] = useState<Record<string, Payment[]>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const map: Record<string, Payment[]> = {}
      for (const s of subs) {
        map[s.id] = await getPaymentsBySubscription(s.id)
      }
      if (!cancelled) setPaymentsBySub(map)
    })()
    return () => {
      cancelled = true
    }
  }, [subs])

  const totalDebt = useMemo(() => {
    let debt = 0
    for (const s of subs) {
      const paid = (paymentsBySub[s.id] ?? []).reduce(
        (sum, p) => sum + p.amount,
        0,
      )
      const remaining = s.actual_price - paid
      if (remaining > 0) debt += remaining
    }
    return debt
  }, [subs, paymentsBySub])

  return (
    <div className="rounded-xl bg-oxygen-black-deep p-4 ring-1 ring-oxygen-silver/10">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-oxygen-silver">
          <CreditCard className="h-4 w-4" />
          إجمالي الدين المستحق
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-red-500">
            {formatNumber(totalDebt)} ل.س
          </span>
          {totalDebt > 0 && (
            <button
              onClick={onPay}
              className="rounded-lg bg-green-500/20 px-3 py-1.5 text-sm font-bold text-green-400 ring-1 ring-green-500/40 hover:bg-green-500/30"
            >
              دفع
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SubscriptionCard({
  sub,
  typeName,
  onFreeze,
  onUnfreeze,
  onPay,
}: {
  sub: Subscription
  typeName: string
  onFreeze: () => void
  onUnfreeze: () => void
  onPay: () => void
}) {
  const [paid, setPaid] = useState(0)
  const [freezes, setFreezes] = useState<Freeze[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [p, f] = await Promise.all([
        getPaymentsBySubscription(sub.id),
        getFreezesBySubscription(sub.id),
      ])
      if (cancelled) return
      setPaid(p.reduce((s, x) => s + x.amount, 0))
      setFreezes(f)
    })()
    return () => {
      cancelled = true
    }
  }, [sub.id])

  const remaining = sub.actual_price - paid
  const hasDebt = remaining > 0

  return (
    <div className="rounded-2xl bg-oxygen-black p-4 ring-1 ring-oxygen-silver/10">
      <div className="flex items-center justify-between">
        <span className="font-bold text-oxygen-silver-light">{typeName}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
            sub.status === 'frozen'
              ? STATUS_STYLES.frozen
              : sub.end_date >= todayLocal()
                ? STATUS_STYLES.active
                : STATUS_STYLES.expired
          }`}
        >
          {sub.status === 'frozen'
            ? STATUS_LABELS.frozen
            : sub.end_date >= todayLocal()
              ? STATUS_LABELS.active
              : STATUS_LABELS.expired}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Info label="تاريخ البداية" value={formatDate(sub.start_date)} />
        <Info label="تاريخ النهاية" value={formatDate(sub.end_date)} />
        <Info label="السعر" value={`${formatNumber(sub.actual_price)} ل.س`} />
        <Info label="المدفوع" value={`${formatNumber(paid)} ل.س`} />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-oxygen-black-deep px-4 py-3">
        <span className="text-sm text-oxygen-silver">الدين المتبقي</span>
        <span className={`text-lg font-extrabold ${hasDebt ? 'text-red-500' : 'text-green-400'}`}>
          {`${formatNumber(remaining)} ل.س`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {sub.status === 'active' && (
          <button
            onClick={onPay}
            className="flex items-center gap-1 rounded-lg bg-green-500/20 px-3 py-2 text-sm font-bold text-green-400 ring-1 ring-green-500/40 hover:bg-green-500/30"
          >
            <CreditCard className="h-4 w-4" />
            دفع
          </button>
        )}
        {sub.status === 'active' && (
          <button
            onClick={onFreeze}
            className="flex items-center gap-1 rounded-lg bg-oxygen-black-deep px-3 py-2 text-sm font-bold text-blue-400 ring-1 ring-blue-500/40 hover:bg-blue-500/10"
          >
            <Snowflake className="h-4 w-4" />
            تجميد الاشتراك
          </button>
        )}
        {sub.status === 'frozen' && (
          <button
            onClick={onUnfreeze}
            className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-2 text-sm font-bold text-amber-400 ring-1 ring-amber-500/40 hover:bg-amber-500/10"
          >
            <Snowflake className="h-4 w-4" />
            إلغاء التجميد
          </button>
        )}
      </div>

      {freezes.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-oxygen-silver">سجل التجميد</p>
          <ul className="flex flex-col gap-1">
            {freezes.map((f) => (
              <li
                key={f.id}
                className="rounded-lg bg-oxygen-black-deep px-3 py-1.5 text-xs text-oxygen-silver"
              >
                من {formatDate(f.start_date)}
                {f.actual_unfreeze_date
                  ? ` إلى ${formatDate(f.actual_unfreeze_date)}`
                  : f.end_date
                    ? ` (متوقع: ${formatDate(f.end_date)})`
                    : ' (نشط)'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
