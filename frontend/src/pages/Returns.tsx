import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ClipboardList, Download, FilePlus2, RefreshCcw, ShieldAlert } from 'lucide-react'

import { RETURN_STATUSES, type CreateReturnInput, type ReturnDetail, type ReturnMovementInput, type ReturnStatus } from '@modules/returns'
import type { InventoryProvider } from '@modules/inventory'
import type { Client } from '@modules/clients'
import type { InventoryItem } from '@modules/inventory'
import {
  addReturnAttachment,
  addReturnMovement,
  changeReturnState,
  closeReturn,
  createReturn,
  downloadReturnsReport,
  fetchClients,
  fetchInventory,
  fetchProviders,
  fetchReturnDetail,
  fetchReturns,
} from '@utils/api'
import { setAdminToken as setApiAdminToken } from '@utils/api'

const ADMIN_STORAGE_KEY = 'dc_admin_token'

type ReturnFormState = {
  productoNombre: string
  inventarioItemId: string
  proveedorId: string
  clienteId: string
  motivo: string
  diagnostico: string
  slaProveedor: string
  entregadoPor: string
  recibidoPor: string
}

const defaultReturnForm: ReturnFormState = {
  productoNombre: '',
  inventarioItemId: '',
  proveedorId: '',
  clienteId: '',
  motivo: '',
  diagnostico: '',
  slaProveedor: '',
  entregadoPor: '',
  recibidoPor: '',
}

const defaultMovement: ReturnMovementInput = {
  tipo: 'entrega_proveedor',
  entregadoPor: '',
  recibidoPor: '',
  fecha: '',
  notas: '',
}

const defaultStateForm = {
  estado: 'revision_tecnica' as ReturnStatus,
  comentario: '',
  slaProveedor: '',
}

const defaultCloseForm = {
  resultadoFinal: '',
  ajusteNotas: '',
  cerradaPor: '',
  ajusteStock: true,
}

const defaultAttachmentForm = {
  tipo: 'foto',
  url: '',
  nombre: '',
  subidoPor: '',
}

export const Returns: React.FC = () => {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [returns, setReturns] = React.useState<ReturnDetail[]>([])
  const [selected, setSelected] = React.useState<ReturnDetail | null>(null)
  const [filterStatus, setFilterStatus] = React.useState<ReturnStatus | 'todos'>('todos')
  const [providers, setProviders] = React.useState<InventoryProvider[]>([])
  const [clients, setClients] = React.useState<Client[]>([])
  const [inventory, setInventory] = React.useState<InventoryItem[]>([])

  const [returnForm, setReturnForm] = React.useState(defaultReturnForm)
  const [movementForm, setMovementForm] = React.useState(defaultMovement)
  const [stateForm, setStateForm] = React.useState(defaultStateForm)
  const [closeForm, setCloseForm] = React.useState(defaultCloseForm)
  const [attachmentForm, setAttachmentForm] = React.useState(defaultAttachmentForm)

  React.useEffect(() => {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (stored) {
      setApiAdminToken(stored)
      setIsAdmin(true)
    } else {
      setIsAdmin(false)
    }
  }, [])

  React.useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    const load = async () => {
      try {
        setLoading(true)
        const [returnsData, providerData, clientData, inventoryData] = await Promise.all([
          fetchReturns(),
          fetchProviders(),
          fetchClients(),
          fetchInventory(),
        ])
        setReturns(returnsData as ReturnDetail[])
        if (returnsData.length > 0) {
          const detail = await fetchReturnDetail(returnsData[0].id)
          setSelected(detail)
        }
        setProviders(providerData)
        setClients(clientData)
        setInventory(inventoryData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el módulo de devoluciones')
      } finally {
        setLoading(false)
      }
    }
    load().catch((err) => console.error(err))
  }, [isAdmin])

  const refreshReturns = async (status = filterStatus) => {
    const params: { estado?: ReturnStatus } = {}
    if (status !== 'todos') params.estado = status
    const data = await fetchReturns(params)
    setReturns(data as ReturnDetail[])
    if (selected) {
      const updated = data.find((item) => item.id === selected.id)
      if (updated) {
        const detail = await fetchReturnDetail(updated.id)
        setSelected(detail)
      }
    }
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload: CreateReturnInput = {
        productoNombre: returnForm.productoNombre,
        inventarioItemId: returnForm.inventarioItemId ? Number(returnForm.inventarioItemId) : undefined,
        proveedorId: returnForm.proveedorId ? Number(returnForm.proveedorId) : undefined,
        clienteId: returnForm.clienteId ? Number(returnForm.clienteId) : undefined,
        motivo: returnForm.motivo,
        diagnostico: returnForm.diagnostico || undefined,
        slaProveedor: returnForm.slaProveedor || undefined,
        primerMovimiento: {
          tipo: 'recepcion_taller',
          entregadoPor: returnForm.entregadoPor,
          recibidoPor: returnForm.recibidoPor || 'taller',
        },
      }
      const created = await createReturn(payload)
      setReturns((prev) => [created, ...prev])
      setSelected(created)
      setReturnForm(defaultReturnForm)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la devolución')
    }
  }

  const handleMovement = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    try {
      const movements = await addReturnMovement(selected.id, movementForm)
      setSelected({ ...selected, movements })
      setMovementForm(defaultMovement)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el movimiento')
    }
  }

  const handleState = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    try {
      const detail = await changeReturnState(selected.id, {
        estado: stateForm.estado,
        comentario: stateForm.comentario || undefined,
        slaProveedor: stateForm.slaProveedor || undefined,
      })
      setSelected(detail)
      await refreshReturns()
      setStateForm(defaultStateForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado')
    }
  }

  const handleClose = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    try {
      const detail = await closeReturn(selected.id, closeForm)
      setSelected(detail)
      await refreshReturns()
      setCloseForm(defaultCloseForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la devolución')
    }
  }

  const handleReport = async () => {
    try {
      const blob = await downloadReturnsReport({ estado: filterStatus === 'todos' ? undefined : filterStatus })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'devoluciones.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el reporte')
    }
  }

  const handleAttachment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    try {
      const attachments = await addReturnAttachment(selected.id, attachmentForm)
      setSelected({ ...selected, attachments })
      setAttachmentForm(defaultAttachmentForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo adjuntar el archivo')
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-4">
        <p className="text-xl font-semibold text-slate-800 mb-2">Acceso restringido</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
        >
          <ArrowLeft size={18} />
          Volver al inicio
        </button>
      </div>
    )
  }

  const statusCounts = RETURN_STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = returns.filter((item) => item.estado === status).length
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Doctor Cell 2.0</p>
            <h1 className="text-3xl font-bold text-slate-900">Módulo de Devoluciones</h1>
            <p className="text-slate-500">Controla SLA, timeline y entregas/recepciones.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              <ArrowLeft size={16} />
              Inicio
            </button>
            <button
              onClick={() => refreshReturns().catch((err) => console.error(err))}
              className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              <RefreshCcw size={16} /> Actualizar
            </button>
          </div>
        </header>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-3 md:grid-cols-3">
          {RETURN_STATUSES.map((status) => (
            <StatusCard
              key={status}
              status={status}
              count={statusCounts[status] ?? 0}
              active={filterStatus === status}
              onClick={() => {
                setFilterStatus(status)
                refreshReturns(status).catch((err) => console.error(err))
              }}
            />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FilePlus2 size={20} className="text-green-600" />
                  <h2 className="text-xl font-semibold text-slate-900">Reportar devolución</h2>
                </div>
                <button
                  onClick={handleReport}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Download size={14} />
                  Reporte
                </button>
              </div>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreate}>
                <label className="text-xs text-slate-600">
                  Producto *
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={returnForm.productoNombre}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, productoNombre: event.target.value }))}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Inventario ID
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={returnForm.inventarioItemId}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, inventarioItemId: event.target.value }))}
                    list="inventory-options"
                  />
                  <datalist id="inventory-options">
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label className="text-xs text-slate-600">
                  Proveedor
                  <select
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={returnForm.proveedorId}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, proveedorId: event.target.value }))}
                  >
                    <option value="">Seleccionar</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Cliente
                  <select
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={returnForm.clienteId}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, clienteId: event.target.value }))}
                  >
                    <option value="">Seleccionar</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600 md:col-span-2">
                  Motivo *
                  <textarea
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    rows={2}
                    value={returnForm.motivo}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, motivo: event.target.value }))}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Diagnóstico
                  <textarea
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    rows={2}
                    value={returnForm.diagnostico}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, diagnostico: event.target.value }))}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  SLA proveedor
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={returnForm.slaProveedor}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, slaProveedor: event.target.value }))}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Entregado por *
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={returnForm.entregadoPor}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, entregadoPor: event.target.value }))}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Recibido por
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={returnForm.recibidoPor}
                    onChange={(event) => setReturnForm((prev) => ({ ...prev, recibidoPor: event.target.value }))}
                  />
                </label>
                <button
                  type="submit"
                  className="md:col-span-2 rounded-full bg-green-600 px-4 py-2 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  disabled={!returnForm.motivo || !returnForm.entregadoPor || !returnForm.productoNombre}
                >
                  Registrar devolución
                </button>
              </form>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList size={18} className="text-green-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Devoluciones registradas</h2>
                </div>
                <span className="text-xs text-slate-500">{loading ? 'Cargando…' : `${returns.length} registros`}</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {returns.length === 0 && <p className="text-sm text-slate-500">Sin devoluciones por ahora.</p>}
                <div className="space-y-2">
                  {returns.map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-xl border px-3 py-2 text-sm cursor-pointer ${
                        selected?.id === item.id ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={async () => {
                        const detail = await fetchReturnDetail(item.id)
                        setSelected(detail)
                        setStateForm((prev) => ({ ...prev, estado: detail.estado }))
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">{item.codigo}</p>
                        <StatusPill status={item.estado} />
                      </div>
                      <p className="text-xs text-slate-500">{item.clienteNombre ?? 'Sin cliente'} · {item.proveedorNombre ?? 'Sin proveedor'}</p>
                      {item.slaAlerta && <SlaBadge type={item.slaAlerta} />}
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            {selected ? (
              <>
                <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Detalle</p>
                      <h2 className="text-2xl font-bold text-slate-900">{selected.codigo}</h2>
                      <p className="text-xs text-slate-500">
                        {new Date(selected.createdAt).toLocaleDateString()} · SLA:{' '}
                        {selected.slaProveedor ? new Date(selected.slaProveedor).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    {selected.slaAlerta && <SlaBadge type={selected.slaAlerta} large />}
                  </div>
                  <p className="text-sm text-slate-700">{selected.motivo}</p>
                  {selected.diagnostico && (
                    <p className="text-xs text-slate-500">Diagnóstico: {selected.diagnostico}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    Resultado: {selected.resultadoFinal ?? 'Pendiente'} · Última actualización:{' '}
                    {new Date(selected.updatedAt).toLocaleString()}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Registrar movimiento</p>
                  <form className="space-y-2" onSubmit={handleMovement}>
                    <label className="text-xs text-slate-600">
                      Tipo
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={movementForm.tipo}
                        onChange={(event) => setMovementForm((prev) => ({ ...prev, tipo: event.target.value }))}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Entregado por
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={movementForm.entregadoPor}
                        onChange={(event) => setMovementForm((prev) => ({ ...prev, entregadoPor: event.target.value }))}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Recibido por
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={movementForm.recibidoPor}
                        onChange={(event) => setMovementForm((prev) => ({ ...prev, recibidoPor: event.target.value }))}
                      />
                    </label>
                    <button type="submit" className="w-full rounded-full bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-700">
                      Guardar movimiento
                    </button>
                  </form>

                  <div className="max-h-44 overflow-y-auto border-t border-slate-100 pt-2 text-xs text-slate-600 space-y-2">
                    {selected.movements.map((move) => (
                      <div key={move.id} className="rounded border border-slate-100 p-2">
                        <p className="font-semibold text-slate-900">{move.tipo}</p>
                        <p>
                          {move.entregadoPor} → {move.recibidoPor}
                        </p>
                        <p>{new Date(move.fecha).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Adjuntos / evidencia</p>
                  <form className="space-y-2 text-xs text-slate-600" onSubmit={handleAttachment}>
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Tipo (foto, recibo, etc.)"
                      value={attachmentForm.tipo}
                      onChange={(event) => setAttachmentForm((prev) => ({ ...prev, tipo: event.target.value }))}
                    />
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="URL"
                      value={attachmentForm.url}
                      onChange={(event) => setAttachmentForm((prev) => ({ ...prev, url: event.target.value }))}
                    />
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Nombre del archivo"
                      value={attachmentForm.nombre}
                      onChange={(event) => setAttachmentForm((prev) => ({ ...prev, nombre: event.target.value }))}
                    />
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Subido por"
                      value={attachmentForm.subidoPor}
                      onChange={(event) => setAttachmentForm((prev) => ({ ...prev, subidoPor: event.target.value }))}
                    />
                    <button type="submit" className="w-full rounded-full border border-green-600 px-3 py-1 text-sm font-semibold text-green-700 hover:bg-green-50">
                      Guardar adjunto
                    </button>
                  </form>
                  <div className="max-h-32 overflow-y-auto text-xs text-slate-600 space-y-1">
                    {selected.attachments.map((file) => (
                      <a
                        key={file.id}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded border border-slate-100 px-2 py-1 hover:bg-slate-50"
                      >
                        {file.tipo} · {file.nombre ?? file.url}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Estado / SLA</p>
                  <form className="space-y-2" onSubmit={handleState}>
                    <select
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm capitalize"
                      value={stateForm.estado}
                      onChange={(event) => setStateForm((prev) => ({ ...prev, estado: event.target.value as ReturnStatus }))}
                    >
                      {RETURN_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={stateForm.slaProveedor}
                      onChange={(event) => setStateForm((prev) => ({ ...prev, slaProveedor: event.target.value }))}
                    />
                    <textarea
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      rows={2}
                      placeholder="Comentario"
                      value={stateForm.comentario}
                      onChange={(event) => setStateForm((prev) => ({ ...prev, comentario: event.target.value }))}
                    />
                    <button type="submit" className="w-full rounded-full border border-green-600 px-3 py-1 text-sm font-semibold text-green-700 hover:bg-green-50">
                      Actualizar estado
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Cerrar devolución</p>
                  <form className="space-y-2" onSubmit={handleClose}>
                    <textarea
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      rows={2}
                      placeholder="Resultado final"
                      value={closeForm.resultadoFinal}
                      onChange={(event) => setCloseForm((prev) => ({ ...prev, resultadoFinal: event.target.value }))}
                    />
                    <textarea
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      rows={2}
                      placeholder="Notas de ajuste / reintegro"
                      value={closeForm.ajusteNotas}
                      onChange={(event) => setCloseForm((prev) => ({ ...prev, ajusteNotas: event.target.value }))}
                    />
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Cerrada por"
                      value={closeForm.cerradaPor}
                      onChange={(event) => setCloseForm((prev) => ({ ...prev, cerradaPor: event.target.value }))}
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={closeForm.ajusteStock}
                        onChange={(event) => setCloseForm((prev) => ({ ...prev, ajusteStock: event.target.checked }))}
                      />
                      Confirmo ajuste de inventario
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-full bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-700"
                      disabled={!closeForm.resultadoFinal || !closeForm.cerradaPor}
                    >
                      Cerrar devolución
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800 mb-3">Timeline</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto text-xs text-slate-600">
                    {selected.history.map((entry) => (
                      <div key={entry.id} className="rounded border border-slate-100 p-2">
                        <p className="font-semibold text-slate-900">
                          {entry.estado.replace('_', ' ')} · {new Date(entry.createdAt).toLocaleString()}
                        </p>
                        {entry.comentario && <p>{entry.comentario}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-white p-6 shadow-sm text-center text-slate-500">Selecciona una devolución para ver su detalle.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const StatusCard: React.FC<{ status: ReturnStatus; count: number; active: boolean; onClick: () => void }> = ({
  status,
  count,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`rounded-2xl border px-4 py-3 text-left transition ${
      active ? 'border-green-600 bg-green-50' : 'border-slate-200 hover:border-green-300'
    }`}
  >
    <p className="text-xs uppercase text-slate-500">{status.replace('_', ' ')}</p>
    <p className="text-2xl font-bold text-slate-900">{count}</p>
  </button>
)

const StatusPill: React.FC<{ status: ReturnStatus }> = ({ status }) => (
  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
    {status.replace('_', ' ')}
  </span>
)

const SlaBadge: React.FC<{ type: '72h' | '24h' | 'overdue'; large?: boolean }> = ({ type, large }) => {
  const colors: Record<string, string> = {
    '72h': 'bg-amber-100 text-amber-800',
    '24h': 'bg-orange-100 text-orange-800',
    overdue: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    '72h': 'SLA < 72h',
    '24h': 'SLA < 24h',
    overdue: 'SLA vencido',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${colors[type]} ${large ? 'text-sm' : ''}`}>
      <ShieldAlert size={large ? 16 : 12} />
      {labels[type]}
    </span>
  )
}

export default Returns
