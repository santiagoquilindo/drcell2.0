import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  UserPlus,
  Search,
  Printer,
  ArrowLeft,
  RefreshCcw,
  BadgeCheck,
  Wrench,
} from 'lucide-react'

import type { Client, ClientInput } from '@modules/clients'
import type { RepairDetail, RepairInput, RepairStatus, RepairSummary } from '@modules/repairs'
import { REPAIR_STATUSES } from '@modules/repairs'
import {
  addRepairProgress,
  createClient,
  createRepair,
  downloadRepairSticker,
  fetchClients,
  fetchRepairDetail,
  fetchRepairs,
  setAdminToken as setApiAdminToken,
} from '@utils/api'
import { formatoCOP } from '@utils/money'

const ADMIN_STORAGE_KEY = 'dc_admin_token'

const initialClientForm: ClientInput = {
  nombre: '',
  documento: '',
  telefono: '',
  email: '',
  direccion: '',
  notas: '',
}

const initialRepairForm = {
  dispositivoTipo: '',
  marca: '',
  modelo: '',
  referencia: '',
  serie: '',
  color: '',
  motivoIngreso: '',
  diagnostico: '',
  accesorios: '',
  costoEstimado: '',
  responsable: '',
  notas: '',
}

export const Repairs: React.FC = () => {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [clients, setClients] = React.useState<Client[]>([])
  const [clientSearch, setClientSearch] = React.useState('')
  const [selectedClientId, setSelectedClientId] = React.useState<number | null>(null)
  const [clientForm, setClientForm] = React.useState(initialClientForm)
  const [useExistingClient, setUseExistingClient] = React.useState(true)
  const [savingClient, setSavingClient] = React.useState(false)

  const [repairs, setRepairs] = React.useState<RepairSummary[]>([])
  const [selectedRepair, setSelectedRepair] = React.useState<RepairDetail | null>(null)
  const [repairFilter, setRepairFilter] = React.useState<RepairStatus | 'todos'>('todos')
  const [repairForm, setRepairForm] = React.useState(initialRepairForm)
  const [creatingRepair, setCreatingRepair] = React.useState(false)
  const [downloadingStickerId, setDownloadingStickerId] = React.useState<number | null>(null)
  const [progressForm, setProgressForm] = React.useState({ estado: 'diagnostico' as RepairStatus, comentario: '' })
  const [updatingProgressId, setUpdatingProgressId] = React.useState<number | null>(null)

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
        const [clientsData, repairsData] = await Promise.all([fetchClients(), fetchRepairs()])
        setClients(clientsData)
        setRepairs(repairsData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las reparaciones')
      } finally {
        setLoading(false)
      }
    }
    load().catch((err) => console.error(err))
  }, [isAdmin])

  const refreshRepairs = React.useCallback(
    async (status: RepairStatus | 'todos' = repairFilter) => {
      try {
        const data = await fetchRepairs({ estado: status === 'todos' ? undefined : status })
        setRepairs(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron actualizar las reparaciones')
      }
    },
    [repairFilter],
  )

  const handleClientSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const data = await fetchClients({ q: clientSearch })
      setClients(data)
      if (data.length === 1) {
        setSelectedClientId(data[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron buscar clientes')
    }
  }

  const handleClientSave = async () => {
    try {
      setSavingClient(true)
      const client = await createClient(clientForm)
      setClients((prev) => [client, ...prev])
      setSelectedClientId(client.id)
      setClientForm(initialClientForm)
      setUseExistingClient(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el cliente')
    } finally {
      setSavingClient(false)
    }
  }

  const handleCreateRepair = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (useExistingClient && !selectedClientId) {
      setError('Selecciona un cliente para continuar')
      return
    }
    if (!repairForm.motivoIngreso.trim()) {
      setError('Describe el motivo de ingreso')
      return
    }
    try {
      setCreatingRepair(true)
      const payload: RepairInput = {
        clientId: useExistingClient ? selectedClientId ?? undefined : undefined,
        client: !useExistingClient
          ? {
              nombre: clientForm.nombre.trim(),
              documento: sanitizeOptional(clientForm.documento),
              telefono: sanitizeOptional(clientForm.telefono),
              email: sanitizeOptional(clientForm.email),
              direccion: sanitizeOptional(clientForm.direccion),
              notas: sanitizeOptional(clientForm.notas),
            }
          : undefined,
        dispositivoTipo: repairForm.dispositivoTipo || undefined,
        marca: repairForm.marca || undefined,
        modelo: repairForm.modelo || undefined,
        referencia: repairForm.referencia || undefined,
        color: repairForm.color || undefined,
        serie: repairForm.serie || undefined,
        motivoIngreso: repairForm.motivoIngreso,
        diagnostico: repairForm.diagnostico || undefined,
        accesorios: repairForm.accesorios || undefined,
        costoEstimado: Number(repairForm.costoEstimado) || 0,
        responsable: repairForm.responsable || undefined,
        notas: repairForm.notas || undefined,
      }
      const newRepair = await createRepair(payload)
      setRepairs((prev) => [repairDetailToSummary(newRepair), ...prev])
      setSelectedRepair(newRepair)
      setRepairForm(initialRepairForm)
      setClientForm(initialClientForm)
      setSelectedClientId(null)
      setUseExistingClient(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la reparación')
    } finally {
      setCreatingRepair(false)
    }
  }

  const handleSelectRepair = async (repairId: number) => {
    try {
      const detail = await fetchRepairDetail(repairId)
      setSelectedRepair(detail)
      setProgressForm({ estado: 'diagnostico', comentario: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la reparación')
    }
  }

  const handleDownloadSticker = async (repairId: number) => {
    try {
      setDownloadingStickerId(repairId)
      const blob = await downloadRepairSticker(repairId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el sticker')
    } finally {
      setDownloadingStickerId(null)
    }
  }

  const handleAddProgress = async () => {
    if (!selectedRepair) return
    try {
      setUpdatingProgressId(selectedRepair.id)
      await addRepairProgress(selectedRepair.id, {
        estado: progressForm.estado,
        comentario: progressForm.comentario || undefined,
      })
      const detail = await fetchRepairDetail(selectedRepair.id)
      setSelectedRepair(detail)
      setRepairs((prev) =>
        prev.map((repair) => (repair.id === detail.id ? repairDetailToSummary(detail) : repair)),
      )
      setProgressForm({ estado: progressForm.estado, comentario: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el progreso')
    } finally {
      setUpdatingProgressId(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-md space-y-4">
          <p className="text-xl font-semibold text-slate-800">Acceso restringido</p>
          <p className="text-slate-600">Debes iniciar sesión como administrador para gestionar reparaciones.</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
          >
            <ArrowLeft size={18} />
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Doctor Cell 2.0</p>
            <h1 className="text-3xl font-bold text-slate-900">Gestión de reparaciones</h1>
            <p className="text-slate-500">Registra ingresos, clientes, técnicos y seguimiento del servicio.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              <ArrowLeft size={16} /> Inicio
            </button>
            <button
              onClick={() => refreshRepairs()}
              className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              <RefreshCcw size={16} /> Actualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-800">
              <ClipboardList size={20} className="text-green-600" />
              <h2 className="text-xl font-semibold">Nuevo ingreso</h2>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Cliente</p>
                <div className="flex items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-1 text-slate-600">
                    <input
                      type="radio"
                      checked={useExistingClient}
                      onChange={() => setUseExistingClient(true)}
                    />
                    Existente
                  </label>
                  <label className="inline-flex items-center gap-1 text-slate-600">
                    <input type="radio" checked={!useExistingClient} onChange={() => setUseExistingClient(false)} />
                    Nuevo
                  </label>
                </div>
              </div>

              {useExistingClient ? (
                <div className="space-y-3">
                  <form onSubmit={handleClientSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="w-full rounded-full border border-slate-300 bg-slate-50 py-2 pl-8 pr-3 text-sm"
                        placeholder="Buscar por nombre o documento"
                        value={clientSearch}
                        onChange={(event) => setClientSearch(event.target.value)}
                      />
                    </div>
                    <button className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
                      Buscar
                    </button>
                  </form>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                    {clients.map((client) => (
                      <button
                        type="button"
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className={`w-full text-left px-3 py-2 text-sm ${
                          selectedClientId === client.id ? 'bg-green-50 text-green-900' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-semibold">{client.nombre}</p>
                        <p className="text-xs text-slate-500">{client.documento ?? client.telefono}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Nombre *
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={clientForm.nombre}
                        onChange={(event) => setClientForm((prev) => ({ ...prev, nombre: event.target.value }))}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Documento
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={clientForm.documento}
                        onChange={(event) => setClientForm((prev) => ({ ...prev, documento: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-slate-600">
                      Teléfono
                      <input
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={clientForm.telefono}
                        onChange={(event) => setClientForm((prev) => ({ ...prev, telefono: event.target.value }))}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Email
                      <input
                        type="email"
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        value={clientForm.email}
                        onChange={(event) => setClientForm((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </label>
                  </div>
                  <label className="text-xs text-slate-600">
                    Dirección
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={clientForm.direccion}
                      onChange={(event) => setClientForm((prev) => ({ ...prev, direccion: event.target.value }))}
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Notas
                    <textarea
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      rows={2}
                      value={clientForm.notas}
                      onChange={(event) => setClientForm((prev) => ({ ...prev, notas: event.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleClientSave}
                    disabled={savingClient || !clientForm.nombre.trim()}
                    className="flex items-center justify-center gap-2 rounded-full border border-green-500 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    <UserPlus size={14} /> Guardar cliente
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleCreateRepair} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                {['dispositivoTipo', 'marca', 'modelo', 'referencia', 'serie', 'color'].map((field) => (
                  <label key={field} className="text-xs text-slate-600">
                    {labelFor(field)}
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={(repairForm as any)[field]}
                      onChange={(event) =>
                        setRepairForm((prev) => ({
                          ...prev,
                          [field]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="text-xs text-slate-600">
                Motivo de ingreso *
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  rows={3}
                  value={repairForm.motivoIngreso}
                  onChange={(event) => setRepairForm((prev) => ({ ...prev, motivoIngreso: event.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-600">
                Diagnóstico / Observaciones
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  rows={2}
                  value={repairForm.diagnostico}
                  onChange={(event) => setRepairForm((prev) => ({ ...prev, diagnostico: event.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-600">
                Accesorios
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  value={repairForm.accesorios}
                  onChange={(event) => setRepairForm((prev) => ({ ...prev, accesorios: event.target.value }))}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs text-slate-600">
                  Costo estimado
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={repairForm.costoEstimado}
                    onChange={(event) => setRepairForm((prev) => ({ ...prev, costoEstimado: event.target.value }))}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Técnico responsable
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={repairForm.responsable}
                    onChange={(event) => setRepairForm((prev) => ({ ...prev, responsable: event.target.value }))}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Notas privadas
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={repairForm.notas}
                    onChange={(event) => setRepairForm((prev) => ({ ...prev, notas: event.target.value }))}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={creatingRepair}
                className="w-full rounded-full bg-green-600 px-4 py-2 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {creatingRepair ? 'Guardando...' : 'Registrar reparación'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench size={20} className="text-green-600" />
                <h2 className="text-xl font-semibold text-slate-900">Reparaciones activas</h2>
              </div>
              {loading && <span className="text-xs text-slate-500">Cargando...</span>}
            </div>

            <div className="flex flex-wrap gap-2">
              {(['todos', ...REPAIR_STATUSES] as const).map((state) => (
                <button
                  key={state}
                  onClick={() => {
                    setRepairFilter(state)
                    refreshRepairs(state).catch((err) => console.error(err))
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    repairFilter === state ? 'bg-green-600 text-white' : 'border border-slate-200 text-slate-600'
                  }`}
                >
                  {state === 'todos' ? 'todos' : state.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
              {repairs.map((repair) => (
                <article
                  key={repair.id}
                  className={`rounded-xl border p-4 text-sm ${
                    selectedRepair?.id === repair.id ? 'border-green-500 bg-green-50/60' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{repair.codigo}</p>
                      <p className="text-xs text-slate-500">
                        {repair.clienteNombre} · {repair.marca ?? repair.dispositivoTipo}
                      </p>
                    </div>
                    <StatusBadge status={repair.estado} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => handleSelectRepair(repair.id)}
                      className="rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-50"
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => handleDownloadSticker(repair.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 hover:bg-slate-50"
                    >
                      <Printer size={12} />
                      {downloadingStickerId === repair.id ? 'Generando...' : 'Sticker'}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {selectedRepair && (
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{selectedRepair.codigo}</p>
                    <p className="text-xs text-slate-500">{selectedRepair.cliente.nombre}</p>
                  </div>
                  <BadgeCheck className="text-green-600" size={18} />
                </div>
                <p className="text-sm text-slate-700">
                  {selectedRepair.marca} {selectedRepair.modelo} · {selectedRepair.dispositivoTipo}
                </p>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Ingreso: {new Date(selectedRepair.createdAt).toLocaleString()}</p>
                  <p>Diagnóstico: {selectedRepair.diagnostico ?? 'Pendiente'}</p>
                  <p>Costo estimado: {formatoCOP(selectedRepair.costoEstimado ?? 0)}</p>
                  <p>Responsable: {selectedRepair.responsable ?? 'Sin asignar'}</p>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Registrar avance</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={progressForm.estado}
                      onChange={(event) =>
                        setProgressForm((prev) => ({ ...prev, estado: event.target.value as RepairStatus }))
                      }
                    >
                      {REPAIR_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Comentario"
                      value={progressForm.comentario}
                      onChange={(event) => setProgressForm((prev) => ({ ...prev, comentario: event.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProgress}
                    disabled={updatingProgressId === selectedRepair.id}
                    className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {updatingProgressId === selectedRepair.id ? 'Guardando...' : 'Actualizar estado'}
                  </button>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-600">Historial</p>
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-2 text-xs">
                    {selectedRepair.updates.map((update) => (
                      <div key={update.id} className="rounded border border-slate-100 p-2">
                        <p className="font-semibold text-slate-800">{update.estado}</p>
                        {update.comentario && <p className="text-slate-600">{update.comentario}</p>}
                        <p className="text-[10px] text-slate-400">
                          {new Date(update.createdAt).toLocaleString()} · {update.registradoPor ?? 'Sistema'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const labelFor = (field: string) => {
  const labels: Record<string, string> = {
    dispositivoTipo: 'Tipo de dispositivo',
    marca: 'Marca',
    modelo: 'Modelo',
    referencia: 'Referencia',
    serie: 'Serie / IMEI',
    color: 'Color',
  }
  return labels[field] ?? field
}

const StatusBadge: React.FC<{ status: RepairStatus }> = ({ status }) => (
  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
    {status.replace('_', ' ')}
  </span>
)

const sanitizeOptional = (value?: string) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const repairDetailToSummary = (repair: RepairDetail): RepairSummary => ({
  id: repair.id,
  codigo: repair.codigo,
  estado: repair.estado,
  dispositivoTipo: repair.dispositivoTipo,
  marca: repair.marca,
  modelo: repair.modelo,
  motivoIngreso: repair.motivoIngreso,
  responsable: repair.responsable ?? undefined,
  createdAt: repair.createdAt,
  clienteId: repair.cliente.id,
  clienteNombre: repair.cliente.nombre,
  costoEstimado: repair.costoEstimado,
  costoFinal: repair.costoFinal,
})

export default Repairs
