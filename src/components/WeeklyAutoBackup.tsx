import { useEffect, useRef, useState } from 'react'
import { isWeeklyBackupDue, createFullBackup } from '../lib/backup'
import { toast } from '../lib/toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useSupervisor } from '../context/SupervisorContext'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

/**
 * Automatic WEEKLY full backup (with user confirmation).
 *
 * When a backup is due the app shows a polite dialog asking the user to
 * confirm before downloading — no more sudden, unprofessional downloads.
 * If the user cancels, the next 5-minute interval check re-prompts later.
 */
export function WeeklyAutoBackup() {
  const { allowedSupervisors } = useSupervisor()
  const isAdminAccount = allowedSupervisors.length > 1

  // guard against double-fire within the same tick (StrictMode/dev remounts)
  const runningRef = useRef(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const proceedRef = useRef(false)

  useEffect(() => {
    const check = () => {
      if (!isAdminAccount) return
      if (proceedRef.current) return
      if (runningRef.current) return
      if (!isWeeklyBackupDue()) return
      setConfirmOpen(true)
    }

    check()
    const id = window.setInterval(check, CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [isAdminAccount])

  const doBackup = async () => {
    if (!isAdminAccount) return
    if (runningRef.current) return
    runningRef.current = true
    proceedRef.current = true
    setConfirmOpen(false)
    try {
      await createFullBackup()
      toast('تم تنزيل نسخة احتياطية أسبوعية تلقائياً لكل البيانات', 'success')
    } catch (err) {
      console.error('[WeeklyAutoBackup] failed:', err)
      toast('تعذر إنشاء النسخة الاحتياطية الأسبوعية', 'error')
    } finally {
      runningRef.current = false
    }
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title="نسخة احتياطية أسبوعية"
        message="سيتم تنزيل نسخة احتياطية كاملة لجميع بيانات النادي. هل تريد المتابعة؟"
        confirmLabel="تأكيد"
        cancelLabel="إلغاء"
        onConfirm={doBackup}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
