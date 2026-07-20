import { useEffect, useRef, useState } from 'react'
import { Download, Upload, Plus, Pencil, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { useSupervisor } from '../context/SupervisorContext'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import {
  getSubscriptionTypes,
  addSubscriptionType,
  updateSubscriptionType,
  deleteSubscriptionType,
  addActivityLog,
} from '../lib/store'
import type { SubscriptionType } from '../types'
import {
  exportBackup,
  exportCustomersBackup,
  importBackup,
  importCustomersBackup,
  getLastAutoBackup,
  getBackupReminderTime,
  setBackupReminderTime,
  runAutoBackupNow,
} from '../lib/backup'
import { formatNumber } from '../lib/format'

type Prices = { price_men: number; price_women: number }

export function AdminPage() {
  const { supervisor } = useSupervisor()
  const [types, setTypes] = useState<SubscriptionType[]>([])
  const [loading, setLoading] = useState(true)

  // editing state (per-type draft prices)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Prices>({ price_men: 0, price_women: 0 })
  const [editName, setEditName] = useState('')

  // new type sheet
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrices, setNewPrices] = useState<Prices>({ price_men: 0, price_women: 0 })

  // double-confirm dialogs for price save
  const [confirm1, setConfirm1] = useState<SubscriptionType | null>(null)
  const [confirm2, setConfirm2] = useState<SubscriptionType | null>(null)

  // import
  const [importOpen, setImportOpen] = useState(false)
  const [importScope, setImportScope] = useState<'customers' | 'all'>('all')
  const fileRef = useRef<HTMLInputElement>(null)

  // delete subscription type
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionType | null>(null)

  // auto-backup reminder status (per admin)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [backupTime, setBackupTime] = useState(() => getBackupReminderTime(supervisor))
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }

  async function load() {
    setLoading(true)
    const list = await getSubscriptionTypes()
    setTypes(list)
    setLastBackup(getLastAutoBackup())
    setLoading(false)
  }

  // keep the reminder-time input in sync when the logged-in admin changes
  useEffect(() => {
    setBackupTime(getBackupReminderTime(supervisor))
  }, [supervisor])

  useEffect(() => {
    void load()
  }, [])

  function startEdit(t: SubscriptionType) {
    setEditId(t.id)
    setDraft({ price_men: t.price_men, price_women: t.price_women })
    setEditName(t.name)
  }

  function cancelEdit() {
    setEditId(null)
  }

  function requestSave(t: SubscriptionType) {
    const next = { ...t, ...draft }
    setConfirm1(next)
  }

  function proceedToSecondConfirm() {
    setConfirm2(confirm1)
    setConfirm1(null)
  }

  async function applySave() {
    const t = confirm2
    if (!t) return
    await updateSubscriptionType(t.id, {
      price_men: t.price_men,
      price_women: t.price_women,
    })
    await addActivityLog({
      action_type: 'price_update',
      description: `تم تحديث أسعار الاشتراك: ${t.name}`,
      supervisor_name: supervisor,
      entity_id: t.id,
    })
    setConfirm2(null)
    setEditId(null)
    flash('تم حفظ تغييرات الأسعار وتسجيلها في سجل النشاط')
    await load()
  }

  async function addNewType() {
    if (!newName.trim()) {
      flash('يرجى إدخال اسم النوع')
      return
    }
    await addSubscriptionType({
      name: newName.trim(),
      price_men: newPrices.price_men,
      price_women: newPrices.price_women,
    })
    await addActivityLog({
      action_type: 'price_update',
      description: `تمت إضافة نوع اشتراك جديد: ${newName.trim()}`,
      supervisor_name: supervisor,
    })
    setNewOpen(false)
    setNewName('')
    setNewPrices({ price_men: 0, price_women: 0 })
    flash('تمت إضافة نوع الاشتراك')
    await load()
  }

  async function handleExport() {
    setBusy(true)
    const filename = await exportBackup()
    setBusy(false)
    flash(`تم تصدير النسخة الاحتياطية: ${filename}`)
    await load()
  }

  async function handleExportCustomers() {
    setBusy(true)
    const filename = await exportCustomersBackup()
    setBusy(false)
    flash(`تم تصدير بيانات العملاء: ${filename}`)
  }

  async function handleDeleteType() {
    const t = deleteTarget
    if (!t) return
    // deleteSubscriptionType performs the delete AND logs the activity.
    await deleteSubscriptionType(t.id, supervisor)
    setDeleteTarget(null)
    flash('تم حذف نوع الاشتراك')
    await load()
  }

  async function handleRunBackupNow() {
    setBusy(true)
    const res = await runAutoBackupNow()
    setBusy(false)
    if (res.ran && res.filename) flash(`تم إنشاء نسخة احتياطية: ${res.filename}`)
    await load()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setImportOpen(false)
    setBusy(true)
    const res =
      importScope === 'customers'
        ? await importCustomersBackup(text)
        : await importBackup(text)
    setBusy(false)
    if (res.ok) {
      flash('تم الاستيراد بنجاح')
      await load()
    } else {
      flash(`فشل الاستيراد: ${res.error ?? 'خطأ غير معروف'}`)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-oxygen-silver-light">لوحة الإدارة</h2>
        <p className="mt-1 text-oxygen-silver">
          المشرف الحالي:{' '}
          <span className="font-semibold text-oxygen-red-light">{supervisor}</span>
        </p>
      </header>

      {/* Subscription types */}
      <section className="rounded-2xl bg-oxygen-black p-4 ring-1 ring-oxygen-silver/15">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-oxygen-silver-light">أنواع الاشتراكات</h3>
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1 rounded-xl bg-oxygen-red px-3 py-2 text-sm font-bold text-white hover:bg-oxygen-red-dark"
          >
            <Plus className="h-4 w-4" />
            نوع جديد
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-oxygen-silver">جارٍ التحميل...</p>
        ) : (
          <div className="mt-4 space-y-3">
            {types.map((t) => (
              <div
                key={t.id}
                className="rounded-xl bg-oxygen-black-deep p-4 ring-1 ring-oxygen-silver/10"
              >
                {editId === t.id ? (
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor={`edit-name-${t.id}`}
                        className="block text-xs text-oxygen-silver"
                      >
                        اسم النوع
                      </label>
                      <input
                        id={`edit-name-${t.id}`}
                        value={editName}
                        disabled
                        className="mt-1 w-full rounded-lg bg-oxygen-black px-3 py-2 text-oxygen-silver-light ring-1 ring-oxygen-silver/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <PriceField
                        id={`men-${t.id}`}
                        label="سعر الرجال"
                        value={draft.price_men}
                        onChange={(v) => setDraft((d) => ({ ...d, price_men: v }))}
                      />
                      <PriceField
                        id={`women-${t.id}`}
                        label="سعر النساء"
                        value={draft.price_women}
                        onChange={(v) => setDraft((d) => ({ ...d, price_women: v }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => requestSave({ ...t, ...draft })}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-oxygen-red py-2 font-bold text-white hover:bg-oxygen-red-dark"
                      >
                        <Save className="h-4 w-4" />
                        حفظ
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 rounded-xl bg-oxygen-black py-2 font-semibold text-oxygen-silver ring-1 ring-oxygen-silver/30 hover:ring-oxygen-silver"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-oxygen-silver-light">{t.name}</p>
                      <p className="mt-1 text-sm text-oxygen-silver">
                        رجال: {formatNumber(t.price_men)} | نساء:{' '}
                        {formatNumber(t.price_women)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(t)}
                        aria-label={`تعديل أسعار ${t.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-oxygen-black text-oxygen-silver ring-1 ring-oxygen-silver/30 hover:text-oxygen-red-light"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        aria-label={`حذف ${t.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-oxygen-black text-oxygen-red ring-1 ring-oxygen-red/30 hover:bg-oxygen-red/15"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {types.length === 0 && (
              <p className="text-oxygen-silver">لا توجد أنواع اشتراكات بعد.</p>
            )}
          </div>
        )}
      </section>

      {/* Backup section */}
      <section className="rounded-2xl bg-oxygen-black p-4 ring-1 ring-oxygen-silver/15">
        <h3 className="text-lg font-bold text-oxygen-silver-light">النسخ الاحتياطي</h3>
        <p className="mt-1 text-sm text-oxygen-silver">
          {lastBackup
            ? `آخر نسخة احتياطية: ${new Date(lastBackup).toLocaleString('ar-IQ')}`
            : 'لم يتم إجراء نسخة احتياطية بعد.'}
        </p>

        {/* Customers (profiles + their details) */}
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-oxygen-silver-light">
            بيانات العملاء (الأعضاء وتفاصيلهم)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={handleExportCustomers}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-oxygen-red py-3 font-bold text-white hover:bg-oxygen-red-dark disabled:opacity-50"
            >
              <Download className="h-5 w-5" />
              تصدير بيانات العملاء (JSON)
            </button>
            <button
              onClick={() => {
                setImportScope('customers')
                setImportOpen(true)
              }}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-oxygen-black py-3 font-bold text-oxygen-silver-light ring-1 ring-oxygen-silver/30 hover:ring-oxygen-silver disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              استيراد بيانات العملاء
            </button>
          </div>
        </div>

        {/* Everything */}
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-oxygen-silver-light">كل البيانات</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={handleExport}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-oxygen-red py-3 font-bold text-white hover:bg-oxygen-red-dark disabled:opacity-50"
            >
              <Download className="h-5 w-5" />
              تصدير النسخة (JSON)
            </button>
            <button
              onClick={() => {
                setImportScope('all')
                setImportOpen(true)
              }}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-oxygen-black py-3 font-bold text-oxygen-silver-light ring-1 ring-oxygen-silver/30 hover:ring-oxygen-silver disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              استيراد نسخة احتياطية
            </button>
          </div>
        </div>

        {/* Daily auto-backup time picker */}
        <div className="mt-4 rounded-xl bg-oxygen-black-deep p-3 ring-1 ring-oxygen-silver/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-oxygen-silver-light">
                تذكير النسخة الاحتياطية اليومية
              </p>
              <p className="mt-0.5 text-xs text-oxygen-silver">
                يظهر تذكير بإنشاء نسخة احتياطية لكل البيانات عند الساعة المحددة (مخصّص لكل مشرف).
              </p>
            </div>
            <input
              type="time"
              value={backupTime}
              onChange={(e) => {
                setBackupTime(e.target.value)
                setBackupReminderTime(supervisor, e.target.value)
              }}
              className="rounded-lg bg-oxygen-black px-3 py-2 text-oxygen-silver-light ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
            />
          </div>
          <button
            onClick={handleRunBackupNow}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-oxygen-black py-3 font-bold text-oxygen-silver-light ring-1 ring-oxygen-silver/30 hover:ring-oxygen-silver disabled:opacity-50"
          >
            <ShieldAlert className="h-5 w-5" />
            إنشاء نسخة احتياطية الآن
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </section>

      {/* New type sheet */}
      <BottomSheet open={newOpen} onClose={() => setNewOpen(false)} title="نوع اشتراك جديد">
        <div className="space-y-3">
          <div>
            <label htmlFor="new-name" className="block text-xs text-oxygen-silver">
              اسم النوع
            </label>
            <input
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثال: ربع سنوي"
              className="mt-1 w-full rounded-lg bg-oxygen-black-deep px-3 py-2 text-oxygen-silver-light ring-1 ring-oxygen-silver/20 focus:ring-oxygen-red"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PriceField
              id="new-men"
              label="سعر الرجال"
              value={newPrices.price_men}
              onChange={(v) => setNewPrices((p) => ({ ...p, price_men: v }))}
            />
            <PriceField
              id="new-women"
              label="سعر النساء"
              value={newPrices.price_women}
              onChange={(v) => setNewPrices((p) => ({ ...p, price_women: v }))}
            />
          </div>
          <button
            onClick={addNewType}
            className="flex w-full items-center justify-center gap-1 rounded-xl bg-oxygen-red py-3 font-bold text-white hover:bg-oxygen-red-dark"
          >
            <Plus className="h-4 w-4" />
            إضافة النوع
          </button>
        </div>
      </BottomSheet>

      {/* Import confirm */}
      <ConfirmDialog
        open={importOpen}
        title="تأكيد الاستيراد"
        message={
          importScope === 'customers'
            ? 'سيؤدي استيراد بيانات العملاء إلى استبدال الأعضاء والاشتراكات والمدفوعات والتجميد الحالية بالكامل. هل أنت متأكد؟'
            : 'سيؤدي استيراد النسخة الاحتياطية إلى استبدال جميع البيانات الحالية بالكامل. هل أنت متأكد؟'
        }
        confirmLabel="استيراد واستبدال"
        cancelLabel="إلغاء"
        danger
        onConfirm={() => fileRef.current?.click()}
        onCancel={() => setImportOpen(false)}
      />

      {/* Delete subscription type confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف نوع الاشتراك"
        message={`هل أنت متأكد من حذف نوع الاشتراك "${deleteTarget?.name ?? ''}"؟ لا يمكن التراجع.`}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        danger
        icon={<Trash2 className="h-6 w-6" />}
        onConfirm={handleDeleteType}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Double-confirm: step 1 */}
      <ConfirmDialog
        open={!!confirm1}
        title="تأكيد حفظ الأسعار"
        message="هل أنت متأكد من حفظ تغييرات الأسعار؟"
        confirmLabel="متابعة"
        cancelLabel="إلغاء"
        danger
        onConfirm={proceedToSecondConfirm}
        onCancel={() => setConfirm1(null)}
      />

      {/* Double-confirm: step 2 (final) */}
      <ConfirmDialog
        open={!!confirm2}
        title="تأكيد نهائي"
        message="تأكيد نهائي - لا يمكن التراجع عن تغيير الأسعار بعد الحفظ."
        confirmLabel="تأكيد نهائي وحفظ"
        cancelLabel="إلغاء"
        danger
        onConfirm={applySave}
        onCancel={() => setConfirm2(null)}
      />

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-oxygen-red px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function PriceField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-oxygen-silver">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded-lg bg-oxygen-black-deep px-3 py-2 text-oxygen-silver-light ring-1 ring-oxygen-silver/20 focus:ring-oxygen-red"
      />
    </div>
  )
}
