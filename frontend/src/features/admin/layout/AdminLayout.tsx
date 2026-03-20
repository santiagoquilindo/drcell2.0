import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '@features/admin/auth/AuthContext'

export function AdminLayout() {
  const navigate = useNavigate()
  const { user, logoutAction } = useAuth()

  const handleLogout = async () => {
    await logoutAction()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="stack-md">
          <div className="admin-brand-card">
            <p className="eyebrow">Dr. Cell</p>
            <h2>Panel administrador</h2>
            <p className="muted">Control operativo para ventas, tickets y seguimiento del negocio.</p>
            <div className="tag-row">
              <span>Sesion activa</span>
              <span>{user?.name}</span>
            </div>
          </div>

          <nav className="admin-nav">
            <NavLink to="/admin/products">Productos</NavLink>
            <NavLink to="/admin/inventory">Inventario</NavLink>
            <NavLink to="/admin/repairs">Reparaciones</NavLink>
          </nav>
        </div>

        <button className="ghost-button" onClick={handleLogout} type="button">
          Cerrar sesion
        </button>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  )
}
