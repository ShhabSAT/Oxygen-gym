import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Users, ScrollText, SlidersHorizontal, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SupervisorSwitcher } from '../components/SupervisorSwitcher'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ToastHost } from '../lib/toast'
import { STORAGE_KEYS } from '../lib/constants'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/members', label: 'قائمة الأعضاء', icon: Users },
  { to: '/activity', label: 'سجل النشاطات', icon: ScrollText },
  { to: '/admin', label: 'لوحة التحكم', icon: SlidersHorizontal },
]

function confirmLogout() {
  localStorage.removeItem(STORAGE_KEYS.loggedIn)
  window.location.reload()
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [logoutOpen, setLogoutOpen] = useState(false)
  const Sidebar = (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-s md:border-oxygen-silver/10 md:bg-oxygen-black">
      <div className="flex items-center gap-3 px-6 py-6">
        <img src="/icon-noBG.png" alt="Oxygen Gym" className="h-12 w-12 object-contain" />
        <h1 className="text-xl font-extrabold text-oxygen-silver-light">Oxygen Gym</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex h-12 items-center gap-3 rounded-xl px-4 font-medium transition-colors ${
                isActive
                  ? 'bg-oxygen-red/15 text-oxygen-red-light'
                  : 'text-oxygen-silver hover:bg-oxygen-silver/10'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-oxygen-black-deep text-white">
      {Sidebar}

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-oxygen-silver/10 bg-oxygen-black/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <img src="/icon-noBG.png" alt="Oxygen Gym" className="h-10 w-10 object-contain" />
            <h1 className="text-lg font-extrabold text-oxygen-silver-light">Oxygen Gym</h1>
          </div>
          <div className="hidden md:block text-sm text-oxygen-silver">نظام إدارة النادي</div>
          <div className="flex items-center gap-2">
            <SupervisorSwitcher />
            <button
              onClick={() => setLogoutOpen(true)}
              aria-label="تسجيل الخروج"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-oxygen-black ring-1 ring-oxygen-silver/30 hover:ring-oxygen-red"
            >
              <LogOut className="h-5 w-5 text-oxygen-silver" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 md:pb-6 md:px-6">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-oxygen-silver/10 bg-oxygen-black/95 backdrop-blur pb-safe md:hidden">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-oxygen-red-light' : 'text-oxygen-silver'
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="تسجيل الخروج"
        message="هل أنت متأكد من تسجيل الخروج؟"
        confirmLabel="تأكيد"
        cancelLabel="إلغاء"
        danger
        onConfirm={confirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />

      <ToastHost />
    </div>
  )
}
