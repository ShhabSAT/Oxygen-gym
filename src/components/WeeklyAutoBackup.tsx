import { useEffect, useRef } from 'react'
import { isWeeklyBackupDue, createFullBackup } from '../lib/backup'
import { toast } from '../lib/toast'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

/**
 * Automatic WEEKLY full backup.
 *
 * The app downloads a full backup on its own — no dialog, no time picker.
 * It runs the first time the app opens on a device, and then every 7 days
 * while the app is open (including immediately on open, since the check
 * fires on mount). Because a PWA can't run in the background, the download
 * happens the first time the app is opened after the week elapses.
 *
 * A non-blocking toast confirms the download so the user knows it happened.
 */
export function WeeklyAutoBackup() {
  // guard against double-fire within the same tick (StrictMode/dev remounts)
  const runningRef = useRef(false)

  useEffect(() => {
    const run = async () => {
      if (runningRef.current) return
      if (!isWeeklyBackupDue()) return
      runningRef.current = true
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

    void run()
    const id = window.setInterval(run, CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return null
}
