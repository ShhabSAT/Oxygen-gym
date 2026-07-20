import { useEffect, useState } from 'react'
import { useSupervisor } from '../context/SupervisorContext'
import { ConfirmDialog } from './ui/ConfirmDialog'
import {
  getBackupReminderTime,
  getRemindedToday,
  setRemindedToday,
  backedUpToday,
  createFullBackup,
} from '../lib/backup'

const CHECK_INTERVAL_MS = 60_000

function dayStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * One-time daily backup reminder for the currently logged-in admin.
 * At the supervisor's chosen time (while the app is open) it shows a
 * dialog offering to download a full backup. The app never downloads on
 * its own — only when the user taps the button. Shows at most once/day.
 */
export function BackupReminder() {
  const { supervisor } = useSupervisor()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!supervisor) return

    const tick = () => {
      // Don't stack the reminder on top of an already-open dialog/sheet.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const now = new Date()
      const [h, m] = getBackupReminderTime(supervisor).split(':').map(Number)
      const reached =
        now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)
      const remindedToday = getRemindedToday(supervisor) === dayStamp(now)
      const alreadyBackedUp = backedUpToday()
      if (reached && !remindedToday && !alreadyBackedUp) {
        setOpen(true)
      }
    }

    tick()
    const id = window.setInterval(tick, CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [supervisor])

  // supervisor changed while a reminder was open → close it
  useEffect(() => {
    setOpen(false)
  }, [supervisor])

  function dismiss() {
    setRemindedToday(supervisor, new Date())
    setOpen(false)
  }

  async function download() {
    setRemindedToday(supervisor, new Date())
    setOpen(false)
    await createFullBackup()
  }

  return (
    <ConfirmDialog
      open={open}
      title="تذكير النسخة الاحتياطية"
      message="لم تقم بإنشاء نسخة احتياطية لكل البيانات اليوم. من المهم عمل نسخة احتياطية مرة واحدة على الأقل يومياً لتجنب فقدان البيانات."
      confirmLabel="تنزيل النسخة الاحتياطية"
      cancelLabel="تجاهل"
      danger={false}
      onConfirm={download}
      onCancel={dismiss}
    />
  )
}
