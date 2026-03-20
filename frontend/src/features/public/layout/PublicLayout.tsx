import { NavLink, Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-header-inner">
          <div className="public-brand">
            <p className="eyebrow">Dr. Cell</p>
            <strong>Catalogo y seguimiento tecnico</strong>
            <span className="muted">Venta directa y soporte postventa en una sola experiencia.</span>
          </div>

          <nav className="public-nav">
            <NavLink to="/">Catalogo</NavLink>
            <NavLink to="/seguimiento">Seguimiento</NavLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
