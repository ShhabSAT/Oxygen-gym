import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, WifiOff, RefreshCw } from 'lucide-react'
import {
  getMemberStatus,
  STATUS_LABELS,
  type MemberStatus,
} from '../lib/status'
import { fuzzyArabicIncludes } from '../lib/arabic'
import {
  onMembersChange,
  onSubscriptionsChange,
  onSubscriptionTypesChange,
} from '../lib/store'
import { useLiveData, type LiveSource } from '../lib/useLiveData'
import { RegisterSheet } from '../components/members/RegisterSheet'
import type {
  Gender,
  Member,
  Subscription,
  SubscriptionType,
} from '../types'

type StatusFilter = 'all' | MemberStatus
type GenderFilter = 'all' | Gender

const STATUS_STYLES: Record<MemberStatus, string> = {
  active: 'bg-green-500/20 text-green-400 ring-green-500/40',
  expired: 'bg-gray-500/20 text-gray-400 ring-gray-500/40',
  frozen: 'bg-blue-500/20 text-blue-400 ring-blue-500/40',
}

const GENDER_LABELS: Record<Gender, string> = { men: 'ذكور', women: 'إناث' }

export function MembersPage() {
  const navigate = useNavigate()

  const [members, setMembers] = useState<Member[]>([])
  const [subsByMember, setSubsByMember] = useState<Record<string, Subscription[]>>({})
  const [types, setTypes] = useState<SubscriptionType[]>([])

  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const [registerOpen, setRegisterOpen] = useState(false)

  const sources: LiveSource<unknown>[] = [
    {
      subscribe: (onData, onError) => onMembersChange(onData as (m: Member[]) => void, onError),
      onData: (m) => setMembers(m as Member[]),
    },
    {
      subscribe: (onData, onError) =>
        onSubscriptionsChange(onData as (s: Subscription[]) => void, onError),
      onData: (subs) => {
        const map: Record<string, Subscription[]> = {}
        for (const s of subs as Subscription[]) {
          ;(map[s.member_id] ||= []).push(s)
        }
        setSubsByMember(map)
      },
    },
    {
      subscribe: (onData, onError) =>
        onSubscriptionTypesChange(onData as (t: SubscriptionType[]) => void, onError),
      onData: (t) => setTypes(t as SubscriptionType[]),
    },
  ]
  const { loading, error, retry } = useLiveData(sources)

  const filtered = useMemo(() => {
    return members.filter((m) => {
      // Skip empty/stub profiles (no name or whitespace-only name)
      if (!m.name?.trim()) return false
      if (genderFilter !== 'all' && m.gender !== genderFilter) return false
      const status = getMemberStatus(m, subsByMember[m.id] ?? [])
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (typeFilter !== 'all') {
        const hasType = (subsByMember[m.id] ?? []).some((s) => s.type_id === typeFilter)
        if (!hasType) return false
      }
      if (search.trim()) {
        const hay = `${m.name} ${m.phone}`
        if (!fuzzyArabicIncludes(hay, search.trim())) return false
      }
      return true
    })
  }, [members, subsByMember, genderFilter, statusFilter, typeFilter, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-oxygen-silver-light">قائمة الأعضاء</h2>
          <p className="text-sm text-oxygen-silver">
            {filtered.length} من أصل {members.length} عضو
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2 text-oxygen-silver" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف…"
          className="h-12 w-full rounded-xl bg-oxygen-black ps-12 pe-4 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={genderFilter === 'all'}
            onClick={() => setGenderFilter('all')}
            label="الكل"
          />
          <FilterChip
            active={genderFilter === 'men'}
            onClick={() => setGenderFilter('men')}
            label="ذكور"
          />
          <FilterChip
            active={genderFilter === 'women'}
            onClick={() => setGenderFilter('women')}
            label="إناث"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label="كل الحالات"
          />
          <FilterChip
            active={statusFilter === 'active'}
            onClick={() => setStatusFilter('active')}
            label="نشط"
          />
          <FilterChip
            active={statusFilter === 'expired'}
            onClick={() => setStatusFilter('expired')}
            label="منتهي"
          />
          <FilterChip
            active={statusFilter === 'frozen'}
            onClick={() => setStatusFilter('frozen')}
            label="مجمد"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-11 rounded-xl bg-oxygen-black px-4 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
        >
          <option value="all">كل أنواع الاشتراكات</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-oxygen-silver">
          <Users className="h-10 w-10" />
          <p>لا يوجد أعضاء مطابقون</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const status = getMemberStatus(m, subsByMember[m.id] ?? [])
            return (
              <button
                key={m.id}
                onClick={() => navigate(`/members/${m.id}`)}
                className="flex flex-col gap-3 rounded-2xl bg-oxygen-black p-4 text-start ring-1 ring-oxygen-silver/10 transition-colors hover:ring-oxygen-red"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-oxygen-silver-light">{m.name}</p>
                    <p className="text-sm text-oxygen-silver">{m.phone || '—'}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${STATUS_STYLES[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-oxygen-silver">
                  <span className="rounded-md bg-oxygen-black-deep px-2 py-1">
                    {GENDER_LABELS[m.gender]}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={() => setRegisterOpen(true)}
        aria-label="تسجيل عضو جديد"
        className="fixed bottom-24 end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-oxygen-red shadow-lg shadow-oxygen-red/30 transition-colors hover:bg-oxygen-red-dark md:bottom-6"
      >
        <Plus className="h-7 w-7 text-white" />
      </button>

      <RegisterSheet
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
      />
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-full px-4 text-sm font-semibold ring-1 transition-colors ${
        active
          ? 'bg-oxygen-red/20 text-oxygen-red-light ring-oxygen-red'
          : 'bg-oxygen-black text-oxygen-silver ring-oxygen-silver/30 hover:ring-oxygen-red'
      }`}
    >
      {label}
    </button>
  )
}
