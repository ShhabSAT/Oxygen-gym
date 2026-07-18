import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  RefreshCw,
  Receipt,
  SlidersHorizontal,
  UserPlus,
  WifiOff,
} from 'lucide-react'
import {
  getMember,
  onMembersChange,
  onSubscriptionsChange,
  onPaymentsChange,
} from '../lib/store'
import { useLiveData, type LiveSource } from '../lib/useLiveData'
import {
  getOutstandingDebts,
  groupExpiringSoon,
  type MemberWithSubs,
} from '../lib/dashboard'
import { formatDate } from '../lib/status'
import { formatNumber } from '../lib/format'
import { useSupervisor } from '../context/SupervisorContext'
import { RegisterSheet } from '../components/members/RegisterSheet'
import { RenewSheet } from '../components/members/RenewSheet'
import { PaymentSheet } from '../components/members/PaymentSheet'
import type { Member, Subscription, Payment } from '../types'

export function DashboardPage() {
  const navigate = useNavigate()
  const { supervisor } = useSupervisor()

  const [members, setMembers] = useState<Member[]>([])
  const [subsByMember, setSubsByMember] = useState<Map<string, Subscription[]>>(
    new Map(),
  )
  const [paymentsBySub, setPaymentsBySub] = useState<Map<string, number>>(
    new Map(),
  )

  const [registerOpen, setRegisterOpen] = useState(false)
  const [renewMember, setRenewMember] = useState<Member | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)
  const [payMember, setPayMember] = useState<Member | null>(null)
  const [paySubs, setPaySubs] = useState<Subscription[]>([])
  const [payOpen, setPayOpen] = useState(false)

  function groupByMember(subs: Subscription[]): Map<string, Subscription[]> {
    const map = new Map<string, Subscription[]>()
    for (const s of subs) {
      const arr = map.get(s.member_id) ?? []
      arr.push(s)
      map.set(s.member_id, arr)
    }
    return map
  }

  function sumPayments(pays: Payment[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const p of pays) {
      map.set(p.subscription_id, (map.get(p.subscription_id) ?? 0) + p.amount)
    }
    return map
  }

  const sources: LiveSource<unknown>[] = [
    {
      subscribe: (onData, onError) => onMembersChange(onData as (m: Member[]) => void, onError),
      onData: (m) => setMembers(m as Member[]),
    },
    {
      subscribe: (onData, onError) =>
        onSubscriptionsChange(onData as (s: Subscription[]) => void, onError),
      onData: (subs) => setSubsByMember(groupByMember(subs as Subscription[])),
    },
    {
      subscribe: (onData, onError) =>
        onPaymentsChange(onData as (p: Payment[]) => void, onError),
      onData: (pays) => setPaymentsBySub(sumPayments(pays as Payment[])),
    },
  ]
  const { loading, error, retry } = useLiveData(sources)

  const expiring = groupExpiringSoon(members, subsByMember)
  const debts = getOutstandingDebts(members, subsByMember, paymentsBySub)

  async function openRenew(memberId: string) {
    const mem = await getMember(memberId)
    if (mem) {
      setRenewMember(mem)
      setRenewOpen(true)
    }
  }

  async function openPayment(memberId: string) {
    const mem = await getMember(memberId)
    if (mem) {
      setPayMember(mem)
      setPaySubs(subsByMember.get(memberId) ?? [])
      setPayOpen(true)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-extrabold text-oxygen-silver-light">
          لوحة الرئيسية
        </h2>
        <p className="text-sm text-oxygen-silver">
          أهلاً {supervisor} — نظرة سريعة على النادي اليوم
        </p>
      </header>

      {/* Quick shortcuts */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setRegisterOpen(true)}
          className="flex h-14 items-center justify-center gap-2 rounded-xl bg-oxygen-red font-bold text-white transition-colors hover:bg-oxygen-red-dark"
        >
          <UserPlus className="h-5 w-5" />
          تسجيل عضو جديد
        </button>
        <button
          onClick={() => navigate('/admin')}
          className="flex h-14 items-center justify-center gap-2 rounded-xl bg-oxygen-black font-bold text-oxygen-silver-light ring-1 ring-oxygen-silver/30 transition-colors hover:ring-oxygen-red"
        >
          <SlidersHorizontal className="h-5 w-5" />
          إدارة الأسعار
        </button>
      </div>

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
      ) : (
        <>
          {/* Expiring alerts */}
          <ExpirySection
            icon={AlertTriangle}
            title="اشتراكات تنتهي اليوم"
            accent="red"
            items={expiring.today}
            onRenew={openRenew}
          />
          <ExpirySection
            icon={CalendarClock}
            title="تنتهي خلال يومين"
            accent="amber"
            items={expiring.in2}
            onRenew={openRenew}
          />
          <ExpirySection
            icon={CalendarClock}
            title="تنتهي خلال 3 أيام"
            accent="silver"
            items={expiring.in3}
            onRenew={openRenew}
          />

          {/* Outstanding debts */}
          <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-lg font-bold text-oxygen-silver-light">
              <CreditCard className="h-5 w-5 text-oxygen-red-light" />
              الديون المستحقة
              {debts.length > 0 && (
                <span className="rounded-full bg-oxygen-red/20 px-2 py-0.5 text-xs font-bold text-oxygen-red-light">
                  {debts.length}
                </span>
              )}
            </h3>

            {debts.length === 0 ? (
              <p className="rounded-xl bg-oxygen-black p-4 text-oxygen-silver">
                لا توجد ديون مستحقة. ممتاز!
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {debts.map(({ member, debt }) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-oxygen-black p-4 ring-1 ring-oxygen-silver/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-oxygen-silver-light">
                        {member.name}
                      </p>
                      <p className="text-lg font-extrabold text-red-500">
                        {formatNumber(debt)} ل.س
                      </p>
                    </div>
                    <button
                      onClick={() => void openPayment(member.id)}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-oxygen-red/15 px-3 py-2 text-sm font-bold text-oxygen-red-light transition-colors hover:bg-oxygen-red/25"
                    >
                      <Receipt className="h-4 w-4" />
                      تسجيل دفعة
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <RegisterSheet
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegistered={() => {}}
      />
      <RenewSheet
        open={renewOpen}
        member={renewMember}
        onClose={() => setRenewOpen(false)}
        onRenewed={() => {}}
      />
      <PaymentSheet
        open={payOpen}
        member={payMember}
        subs={paySubs}
        onClose={() => setPayOpen(false)}
        onPaid={() => {}}
      />
    </div>
  )
}

function ExpirySection({
  icon: Icon,
  title,
  items,
  accent,
  onRenew,
}: {
  icon: typeof AlertTriangle
  title: string
  items: MemberWithSubs[]
  accent: 'red' | 'amber' | 'silver'
  onRenew: (memberId: string) => void
}) {
  const accentClass =
    accent === 'red'
      ? 'text-oxygen-red-light'
      : accent === 'amber'
        ? 'text-amber-400'
        : 'text-oxygen-silver'

  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-lg font-bold text-oxygen-silver-light">
        <Icon className={`h-5 w-5 ${accentClass}`} />
        {title}
        {items.length > 0 && (
          <span
            className={`rounded-full bg-oxygen-black px-2 py-0.5 text-xs font-bold ring-1 ring-oxygen-silver/20 ${accentClass}`}
          >
            {items.length}
          </span>
        )}
      </h3>

      {items.length === 0 ? (
        <p className="rounded-xl bg-oxygen-black p-4 text-oxygen-silver">
          لا يوجد اشتراكات قريبة من الانتهاء.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(({ member, active }) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-oxygen-black p-4 ring-1 ring-oxygen-silver/10"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-oxygen-silver-light">
                  {member.name}
                </p>
                <p className="text-xs text-oxygen-silver">
                  ينتهي في: {active ? formatDate(active.end_date) : '—'}
                </p>
              </div>
              <button
                onClick={() => void onRenew(member.id)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-oxygen-red/15 px-3 py-2 text-sm font-bold text-oxygen-red-light transition-colors hover:bg-oxygen-red/25"
              >
                <RefreshCw className="h-4 w-4" />
                تجديد سريع
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
