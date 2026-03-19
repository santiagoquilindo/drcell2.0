import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="screen-center">Cargando panel...</div>
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
