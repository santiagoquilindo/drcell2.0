import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { fetchRepairTracking } from '@shared/api/repairs'
import { formatDateTime, formatStatusLabel } from '@shared/lib/date'
import type { RepairTracking } from '@shared/types/repair'

export function TrackingPage() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState('')
  const [verifier, setVerifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState<RepairTracking | null>(null)

  const runLookup = async (input: { code: string; verifier: string }) => {
    const normalizedCode = input.code.trim().toUpperCase()
    const normalizedVerifier = input.verifier.replace(/\D/g, '').slice(-4)
    if (!normalizedCode) {
      setTracking(null)
      setError('Ingresa un codigo de ticket.')
      return false
    }

    if (!/^RPR-\d{8}-\d{4,}(?:-[A-Z0-9]{4})?$/.test(normalizedCode)) {
      setTracking(null)
      setError('El codigo debe tener un formato valido. Ejemplo: RPR-20260319-0001-AB12.')
      return false
    }

    if (normalizedVerifier.length !== 4) {
      setTracking(null)
      setError('Ingresa los ultimos 4 digitos del telefono o documento del cliente.')
      return false
    }

    try {
      setLoading(true)
      setError(null)
      const response = await fetchRepairTracking({
        code: normalizedCode,
        verifier: normalizedVerifier,
      })
      setTracking(response)
      return true
    } catch (requestError) {
      setTracking(null)
      setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar la reparacion')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await runLookup({ code, verifier })
  }

  useEffect(() => {
    const ticket = searchParams.get('ticket')?.trim().toUpperCase() ?? ''
    const verifierParam = searchParams.get('verifier')?.replace(/\D/g, '').slice(-4) ?? ''

    if (!ticket) return

    setCode(ticket)
    if (verifierParam) {
      setVerifier(verifierParam)
      runLookup({ code: ticket, verifier: verifierParam }).catch(() => {})
      return
    }

    setTracking(null)
    setError('Ingresa los ultimos 4 digitos del telefono o documento del cliente para consultar este ticket.')
  }, [searchParams])

  return (
    <div className="catalog-page tracking-page">
      <section className="hero tracking-hero">
        <div className="stack-md">
          <p className="eyebrow">Seguimiento Dr. Cell</p>
          <h1>Consulta el estado de tu reparacion por ticket</h1>
          <p className="hero-copy">Si llegaste desde el QR, el ticket se cargara automaticamente. Si falta validacion, completa los ultimos 4 digitos del telefono o documento del cliente.</p>
        </div>

        <form className="tracking-search" onSubmit={handleSubmit}>
          <label>
            <span>Codigo de ticket</span>
            <input
              placeholder="Ej. RPR-20260319-0001-AB12"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                setError(null)
              }}
            />
          </label>
          <label>
            <span>Verificacion del cliente</span>
            <input
              inputMode="numeric"
              maxLength={4}
              placeholder="Ultimos 4 digitos"
              value={verifier}
              onChange={(event) => {
                setVerifier(event.target.value.replace(/\D/g, '').slice(0, 4))
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
          <p className="muted">Usa tu ticket y los ultimos 4 digitos del telefono o documento del cliente. Solo mostramos el estado tecnico necesario para el seguimiento.</p>
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
