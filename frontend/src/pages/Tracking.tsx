import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCcw, Search } from 'lucide-react'

import type { PublicRepairStatus, RepairStatus } from '@modules/repairs'
import { fetchPublicRepairStatus } from '@utils/api'

const statusLabels: Record<RepairStatus, string> = {
  ingresado: 'Ingresado',
  diagnostico: 'Diagnostico',
  en_proceso: 'En proceso',
  listo: 'Listo para entrega',
  entregado: 'Entregado',
}

export const Tracking: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTicket = searchParams.get('ticket') ?? ''
  const [ticket, setTicket] = React.useState(initialTicket)
  const [status, setStatus] = React.useState<PublicRepairStatus | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const queryStatus = React.useCallback(async (code: string) => {
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      setError('Ingresa el codigo de tu reparacion')
      setStatus(null)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await fetchPublicRepairStatus(normalized)
      setStatus(data)
      setTicket(normalized)
      setSearchParams({ ticket: normalized })
    } catch (err) {
      setStatus(null)
      setError(err instanceof Error ? err.message : 'No pudimos consultar el estado')
    } finally {
      setLoading(false)
    }
  }, [setSearchParams])

  React.useEffect(() => {
    if (initialTicket) {
      queryStatus(initialTicket).catch(() => {})
    }
  }, [initialTicket, queryStatus])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    queryStatus(ticket).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-semibold"
          >
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
          <button
            type="button"
            onClick={() => (status ? queryStatus(status.codigo).catch(() => {}) : queryStatus(ticket).catch(() => {}))}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
            disabled={loading || (!ticket && !status)}
          >
            <RefreshCcw size={12} />
            Actualizar
          </button>
        </div>

        <header className="space-y-2">
          <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Seguimiento online</p>
          <h1 className="text-3xl font-bold text-slate-900">Estado de tu reparacion</h1>
          <p className="text-slate-600 text-sm">
            Ingresa el codigo impreso en tu sticker o factura para consultar avances y el historial registrado por
            nuestro laboratorio.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm border border-slate-100 md:flex-row"
        >
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-600 block mb-1">Codigo de reparacion</label>
            <input
              value={ticket}
              onChange={(event) => setTicket(event.target.value.toUpperCase())}
              placeholder="Ej: RPR-20250215-0007"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tracking-wide uppercase focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? 'Buscando...' : 'Consultar'}
          </button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!status && !loading && !error && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Ingresa tu codigo para ver el estado actualizado.
          </div>
        )}

        {status && (
          <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Ticket</p>
                <p className="text-2xl font-semibold tracking-wide text-slate-900">{status.codigo}</p>
                <p className="text-xs text-slate-500">
                  Ingreso: {new Date(status.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 capitalize">
                {statusLabels[status.estado] ?? status.estado}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 text-sm text-slate-700">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Cliente</p>
                <p className="font-semibold">{status.cliente.nombre}</p>
                <p className="text-xs text-slate-500">{status.cliente.telefono ?? 'Telefono no registrado'}</p>
                <p className="text-xs text-slate-500">{status.cliente.email ?? 'Correo no registrado'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Equipo</p>
                <p>{status.dispositivo ?? 'Equipo generico'}</p>
                {status.motivoIngreso && <p className="text-xs text-slate-500">Motivo: {status.motivoIngreso}</p>}
                {status.diagnostico && <p className="text-xs text-slate-500">Diagnostico: {status.diagnostico}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Historial de avances</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {status.updates.length === 0 && (
                  <p className="text-xs text-slate-500">Aun no registramos movimientos adicionales.</p>
                )}
                {status.updates.map((update) => (
                  <div key={update.id} className="rounded border border-slate-100 p-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 capitalize">
                        {statusLabels[update.estado] ?? update.estado}
                      </span>
                      <span>{new Date(update.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    {update.comentario && <p className="mt-1">{update.comentario}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
