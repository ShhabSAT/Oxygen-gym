import { createContext, useContext, useState, type ReactNode } from 'react'
import { STORAGE_KEYS, SUPERVISORS } from '../lib/constants'

interface SupervisorContextValue {
  supervisor: string
  setSupervisor: (name: string) => void
}

const SupervisorContext = createContext<SupervisorContextValue | undefined>(undefined)

function getInitialSupervisor(): string {
  const stored = localStorage.getItem(STORAGE_KEYS.supervisor)
  if (stored && SUPERVISORS.includes(stored)) return stored
  return SUPERVISORS[0]
}

export function SupervisorProvider({ children }: { children: ReactNode }) {
  const [supervisor, setSupervisorState] = useState<string>(getInitialSupervisor)

  const setSupervisor = (name: string) => {
    setSupervisorState(name)
    localStorage.setItem(STORAGE_KEYS.supervisor, name)
  }

  return (
    <SupervisorContext.Provider value={{ supervisor, setSupervisor }}>
      {children}
    </SupervisorContext.Provider>
  )
}

export function useSupervisor(): SupervisorContextValue {
  const ctx = useContext(SupervisorContext)
  if (!ctx) throw new Error('useSupervisor must be used within SupervisorProvider')
  return ctx
}
