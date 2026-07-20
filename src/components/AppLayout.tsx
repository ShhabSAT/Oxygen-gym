import { useState, useEffect } from 'react'
import { NavLink, useLocation, type Location } from 'react-router-dom'
import { Home, Users, ScrollText, SlidersHorizontal, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SupervisorSwitcher } from '../components/SupervisorSwitcher'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ToastHost } from '../lib/toast'
import { BackupReminder } from './BackupReminder'
import { TabRoutes } from '../components/TabRoutes'
import { PullToRefresh } from '../components/PullToRefresh'
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

/** Map a pathname to its tab index (0-3). Returns -1 for non-tab pages (e.g. member profile). */
function tabIndex(path: string): number {
  if (path === '/') return 0
  if (path.startsWith('/members')) return 1
  if (path.startsWith('/activity')) return 2
  if (path.startsWith('/admin')) return 3
  return -1
}

function confirmLogout() {
  localStorage.removeItem(STORAGE_KEYS.loggedIn)
  window.location.reload()
}

/*
 * TabTransition — single-mount, sequential (clean + smooth).
 *
 * The previous version stacked two full page copies (outgoing absolutely
 * positioned), which clipped the outgoing page to the incoming page's height
 * and caused visible jumps/glitches. Here ONLY ONE page is mounted at a time:
 *
 *   1. current page fades out (150ms, opacity only)        — `animate-tab-fade-out`
 *   2. new page swaps in, then slides from the correct side — `animate-tab-in-*`
 *
 * Only `transform` + `opacity` animate (compositor-only, no layout/reflow), and
 * the slide is a gentle 14px so it never triggers horizontal scroll. Direction
 * is preserved: in RTL the nav array renders right→left, so a LOWER index is a
 * physically-RIGHT tab. Tapping toward a lower index ⇒ enter from the right;
 * toward a higher index ⇒ enter from the left.
 *
 * Non-tab navigations (e.g. opening a member profile) just swap with no
 * animation so the transition stays purposeful.
 */
type Phase = 'idle' | 'out' | 'in'

function TabTransition() {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState<Location>(location)
  const [phase, setPhase] = useState<Phase>('idle')
  const [direction, setDirection] = useState<'left' | 'right'>('right')

  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return
    const prevIdx = tabIndex(displayLocation.pathname)
    const currIdx = tabIndex(location.pathname)

    // Tab-to-tab → sequential fade-out then slide-in.
    if (prevIdx >= 0 && currIdx >= 0) {
      // In RTL a LOWER index sits to the physical RIGHT of the current tab.
      const movingRight = currIdx < prevIdx
      setDirection(movingRight ? 'right' : 'left')
      setPhase('out')
      const timer = setTimeout(() => {
        setDisplayLocation(location)
        setPhase('in')
      }, 150)
      return () => clearTimeout(timer)
    }

    // Non-tab navigation (e.g. member profile): swap instantly, no animation.
    setDisplayLocation(location)
    setPhase('idle')
  }, [location, displayLocation])

  const animationClass =
    phase === 'out'
      ? 'animate-tab-fade-out'
      : phase === 'in'
        ? direction === 'right'
          ? 'animate-tab-in-right'
          : 'animate-tab-in-left'
        : ''

  return (
    <div className={animationClass}>
      <TabRoutes location={displayLocation} />
    </div>
  )
}

export function AppLayout() {
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

        <main className="flex-1 overflow-x-hidden px-4 py-5 pb-28 md:pb-6 md:px-6">
          <PullToRefresh>
            <TabTransition />
          </PullToRefresh>
        </main>

        {/*
         * Floating pill-style bottom navigation — frosted glass.
         *
         *   - left/right 12px, bottom = 14px + env(safe-area-inset-bottom)
         *     → floats above the OS gesture bar on notched phones (no clip).
         *   - rounded-full        → capsule / pill shape.
         *   - backgroundColor rgba(20,20,20,0.6) + backdrop-filter blur(18px)
         *     → semi-transparent so scrolled content behind is visibly
         *     softened (NOT a flat opaque bar).
         */}
        <nav
          className="fixed z-40 flex items-stretch rounded-full border border-oxygen-silver/10 shadow-lg shadow-black/40 md:hidden"
          style={{
            left: '12px',
            right: '12px',
            bottom: 'calc(14px + env(safe-area-inset-bottom))',
            backgroundColor: 'rgba(20, 20, 20, 0.6)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
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

      <BackupReminder />
    </div>
  )
}
