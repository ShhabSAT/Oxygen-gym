import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SupervisorProvider } from './context/SupervisorContext'
import { STORAGE_KEYS } from './lib/constants'
import { processExpiredFreezes } from './lib/status'
import { seedIfEmpty } from './lib/store'
import { scheduleAutoBackup } from './lib/backup'
import { whenAuthReady } from './lib/firebase'
import { LoginPage } from './pages/LoginPage'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { MembersPage } from './pages/MembersPage'
import { MemberProfilePage } from './pages/MemberProfilePage'
import { ActivityPage } from './pages/ActivityPage'
import { AdminPage } from './pages/AdminPage'

function App() {
  const [loggedIn, setLoggedIn] = useState(
    () => localStorage.getItem(STORAGE_KEYS.loggedIn) === 'true',
  )

  useEffect(() => {
    if (loggedIn) {
      void (async () => {
        await whenAuthReady()
        await seedIfEmpty()
        await processExpiredFreezes()
        await scheduleAutoBackup()
      })()
    }
  }, [loggedIn])

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />
  }

  return (
    <SupervisorProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/members/:id" element={<MemberProfilePage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </SupervisorProvider>
  )
}

export default App
