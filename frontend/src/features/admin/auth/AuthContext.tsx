import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

import { fetchMe, login, logout, type AdminUser } from '@shared/api/auth'

type AuthContextValue = {
  user: AdminUser | null
  loading: boolean
  loginAction: (email: string, password: string) => Promise<void>
  logoutAction: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMe()
      .then((response) => setUser(response.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async loginAction(email, password) {
        const response = await login({ email, password })
        setUser(response.user)
      },
      async logoutAction() {
        try {
          await logout()
        } catch {
          // La sesion puede haber expirado en el servidor.
        }
        setUser(null)
      },
    }),
    [loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
