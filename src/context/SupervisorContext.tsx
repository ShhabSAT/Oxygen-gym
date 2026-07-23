import { createContext, useContext, useState, type ReactNode } from 'react'
import { STORAGE_KEYS, ADMIN_ACCOUNTS } from '../lib/constants'

interface SupervisorContextValue {
  supervisor: string
  setSupervisor: (name: string) => void
  /** Supervisor names the current account is allowed to use. */
  allowedSupervisors: string[]
}

const SupervisorContext = createContext<SupervisorContextValue | undefined>(undefined)

/** Read the stored account and return the list of allowed supervisors. */
function getAllowedSupervisors(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.account)
    if (!stored) return ['طارق', 'رامي'] // fallback for legacy / fresh start
    const account = ADMIN_ACCOUNTS.find((a) => a.username === stored)
    return account?.supervisors ?? ['طارق', 'رامي']
  } catch {
    return ['طارق', 'رامي']
  }
}

export function SupervisorProvider({ children }: { children: ReactNode }) {
  const [allowedSupervisors] = useState<string[]>(getAllowedSupervisors)
  const [supervisor, setSupervisorState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.supervisor)
    const all = getAllowedSupervisors()
    if (stored && all.includes(stored)) return stored
    return all[0]
  })

  const setSupervisor = (name: string) => {
    if (!allowedSupervisors.includes(name)) return // reject disallowed switch
    setSupervisorState(name)
    localStorage.setItem(STORAGE_KEYS.supervisor, name)
  }

  return (
    <SupervisorContext.Provider value={{ supervisor, setSupervisor, allowedSupervisors }}>
      {children}
    </SupervisorContext.Provider>
  )
}

export function useSupervisor(): SupervisorContextValue {
  const ctx = useContext(SupervisorContext)
  if (!ctx) throw new Error('useSupervisor must be used within SupervisorProvider')
  return ctx
}
