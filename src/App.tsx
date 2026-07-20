import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { SupervisorProvider } from './context/SupervisorContext'
import { STORAGE_KEYS } from './lib/constants'
import { processExpiredFreezes } from './lib/status'
import { seedIfEmpty } from './lib/store'
import { whenAuthReady } from './lib/firebase'
import { LoginPage } from './pages/LoginPage'
import { AppLayout } from './components/AppLayout'

function App() {
  const [loggedIn, setLoggedIn] = useState(
    () => localStorage.getItem(STORAGE_KEYS.loggedIn) === 'true',
  )

  useEffect(() => {
    if (!loggedIn) return
    void (async () => {
      await whenAuthReady()
      await seedIfEmpty()
      await processExpiredFreezes()
    })()
  }, [loggedIn])

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />
  }

  return (
    <SupervisorProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </SupervisorProvider>
  )
}

export default App
