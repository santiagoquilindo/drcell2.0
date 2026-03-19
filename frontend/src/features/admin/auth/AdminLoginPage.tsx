import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from './AuthContext'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loginAction, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && user) {
    return <Navigate to="/admin/products" replace />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError('Ingresa correo y contraseña.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await loginAction(email.trim(), password)
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/admin/products'
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo iniciar sesion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-login-shell">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">Panel privado</p>
          <h1>Acceso administrador</h1>
          <p className="muted">Sesion segura para gestionar productos e imagenes del catalogo.</p>
        </div>

        <label>
          <span>Correo</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@drcell.com" />
        </label>

        <label>
          <span>Contraseña</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
