'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

export interface SessionUser {
  sub?: string
  id?: string
  email: string
  name: string
  role: 'ADMIN' | 'GESTOR' | 'FACTURAS'
}

interface SessionValue {
  user: SessionUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<SessionUser>
  logout: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('nl_user')
    if (raw) setUser(JSON.parse(raw) as SessionUser)
    setReady(true)
  }, [])

  async function login(email: string, password: string) {
    const result = await api<{ accessToken: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const session = { ...result.user, sub: result.user.id }
    localStorage.setItem('nl_token', result.accessToken)
    localStorage.setItem('nl_user', JSON.stringify(session))
    setUser(session)
    return session
  }

  function logout() {
    localStorage.removeItem('nl_token')
    localStorage.removeItem('nl_user')
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <SessionContext.Provider value={{ user, ready, login, logout }}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('Sesión no disponible')
  return value
}
