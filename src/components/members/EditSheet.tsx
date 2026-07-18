import { useEffect, useState } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import { GenderField, TextAreaField, TextField } from './fields'
import { updateMember } from '../../lib/store'
import { useSupervisor } from '../../context/SupervisorContext'
import type { Gender, Member } from '../../types'

interface EditSheetProps {
  open: boolean
  member: Member | null
  onClose: () => void
  onSaved: (member: Member) => void
}

export function EditSheet({ open, member, onClose, onSaved }: EditSheetProps) {
  const { supervisor } = useSupervisor()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('men')
  const [phone, setPhone] = useState('')
  const [goal, setGoal] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (member) {
      setName(member.name)
      setGender(member.gender)
      setPhone(member.phone)
      setGoal(member.goal ?? '')
      setNotes(member.notes ?? '')
    }
  }, [member])

  async function handleSave() {
    if (!member || !name.trim()) return
    setSaving(true)
    setSaveError(null)
    // updateMember queues the field-merge into the local cache instantly and
    // returns the optimistic record from a cache read. We await only that
    // instant cache read (NOT server ack), then close the sheet.
    const updated = await updateMember(
      member.id,
      {
        name: name.trim(),
        gender,
        phone: phone.trim(),
        goal: goal.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      supervisor,
    )
    setSaving(false)
    if (updated) onSaved(updated)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="تعديل بيانات العضو">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSave()
        }}
      >
        <TextField
          label="الاسم"
          value={name}
          onChange={setName}
          placeholder="أدخل اسم العضو"
          required
        />
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
          placeholder="أي ملاحظات عن العضو"
        />
        {saveError && (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-400 ring-1 ring-red-500/30">
            {saveError}
          </div>
        )}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-oxygen-red font-bold text-white transition-colors hover:bg-oxygen-red-dark disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
        </button>
      </form>
    </BottomSheet>
  )
}
