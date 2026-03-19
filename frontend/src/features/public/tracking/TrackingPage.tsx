import { useState } from 'react'

import { fetchRepairTracking } from '@shared/api/repairs'
import { formatDateTime, formatStatusLabel } from '@shared/lib/date'
import type { RepairTracking } from '@shared/types/repair'

export function TrackingPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState<RepairTracking | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) {
      setTracking(null)
      setError('Ingresa un codigo de ticket.')
      return
    }

    if (!/^RPR-\d{8}-\d{4,}$/.test(normalizedCode)) {
      setTracking(null)
      setError('El codigo debe tener un formato valido. Ejemplo: RPR-20260319-0001.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await fetchRepairTracking(normalizedCode)
      setTracking(response)
    } catch (requestError) {
      setTracking(null)
      setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar la reparacion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="catalog-page tracking-page">
      <section className="hero tracking-hero">
        <div className="stack-md">
          <p className="eyebrow">Seguimiento Dr. Cell</p>
          <h1>Consulta el estado de tu reparacion por ticket</h1>
          <p className="hero-copy">Ingresa el codigo entregado en recepcion para ver el estado actual, el historial de avances y la ultima actualizacion registrada.</p>
        </div>

        <form className="tracking-search" onSubmit={handleSubmit}>
          <label>
            <span>Codigo de ticket</span>
            <input
              placeholder="Ej. RPR-20260319-0001"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                setError(null)
              }}
            />
          </label>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? 'Consultando...' : 'Consultar'}
          </button>
        </form>
      </section>

      {error && <div className="panel form-error">{error}</div>}

      {!tracking && !error && (
        <section className="panel message-card">
          <strong>Seguimiento simple y directo</strong>
          <p className="muted">Usa tu ticket para consultar avances sin llamar ni escribir primero. Solo mostramos el estado tecnico necesario para el cliente.</p>
        </section>
      )}

      {tracking && (
        <section className="panel stack-md">
          <div className="tracking-header">
            <div>
              <p className="repair-code">{tracking.codigo}</p>
              <h2>{tracking.dispositivo}</h2>
              <p className="muted">Actualizado: {formatDateTime(tracking.updatedAt)}</p>
            </div>
            <span className={`status-pill status-${tracking.estado}`}>{formatStatusLabel(tracking.estado)}</span>
          </div>

          <div className="detail-block">
            <strong>Motivo de ingreso</strong>
            <p>{tracking.motivoIngreso ?? 'Sin registrar'}</p>
          </div>

          <div className="detail-block">
            <strong>Diagnostico</strong>
            <p>{tracking.diagnostico ?? 'Aun no registrado'}</p>
          </div>

          <div className="section-title">Historial</div>
          <div className="timeline">
            {tracking.updates.map((update) => (
              <article className="timeline-item" key={update.id}>
                <div className="timeline-item-head">
                  <span className={`status-pill status-${update.estado}`}>{formatStatusLabel(update.estado)}</span>
                  <span className="muted">{formatDateTime(update.createdAt)}</span>
                </div>
                <p>{update.comentario || 'Sin comentario'}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
