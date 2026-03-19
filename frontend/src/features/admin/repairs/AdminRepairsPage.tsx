import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@features/admin/auth/AuthContext'
import { ApiError } from '@shared/api/client'
import { addRepairUpdate, createRepair, fetchRepair, fetchRepairs, updateRepair } from '@shared/api/repairs'
import { formatCurrency } from '@shared/lib/currency'
import { formatDateTime, formatStatusLabel } from '@shared/lib/date'
import type { Repair, RepairPayload, RepairStatus, RepairSummary } from '@shared/types/repair'

const repairStatuses: RepairStatus[] = ['ingresado', 'diagnostico', 'en_proceso', 'listo', 'entregado']

const initialForm = {
  clienteNombre: '',
  clienteDocumento: '',
  clienteTelefono: '',
  clienteEmail: '',
  clienteDireccion: '',
  clienteNotas: '',
  dispositivoTipo: '',
  marca: '',
  modelo: '',
  referencia: '',
  color: '',
  serie: '',
  motivoIngreso: '',
  diagnostico: '',
  accesorios: '',
  costoEstimado: '0',
  costoFinal: '0',
  responsable: '',
  notas: '',
}

export function AdminRepairsPage() {
  const navigate = useNavigate()
  const { user, logoutAction } = useAuth()
  const [repairs, setRepairs] = useState<RepairSummary[]>([])
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [statusComment, setStatusComment] = useState('')
  const [nextStatus, setNextStatus] = useState<RepairStatus>('diagnostico')
  const [form, setForm] = useState(initialForm)

  const summary = useMemo(
    () => ({
      total: repairs.length,
      pendientes: repairs.filter((repair) => repair.estado !== 'entregado').length,
      listas: repairs.filter((repair) => repair.estado === 'listo').length,
    }),
    [repairs],
  )

  const isEditing = editingId !== null

  const handleSessionError = async (reason: unknown) => {
    if (reason instanceof ApiError && reason.status === 401) {
      await logoutAction()
      navigate('/admin/login', { replace: true })
      return true
    }

    return false
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(initialForm)
  }

  const loadRepairDetail = async (id: number) => {
    try {
      setDetailLoading(true)
      const detail = await fetchRepair(id)
      setSelectedRepair(detail)
      setNextStatus(detail.estado === 'entregado' ? 'entregado' : getNextStatus(detail.estado))
      setError(null)
    } catch (loadError) {
      if (await handleSessionError(loadError)) return
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el detalle de la reparacion')
    } finally {
      setDetailLoading(false)
    }
  }

  const loadRepairs = async (options?: { selectId?: number }) => {
    try {
      setLoading(true)
      const list = await fetchRepairs({ q: query.trim() || undefined, estado: statusFilter || undefined })
      setRepairs(list)
      setError(null)

      const targetId = options?.selectId ?? selectedRepair?.id ?? list[0]?.id
      if (targetId) {
        await loadRepairDetail(targetId)
      } else {
        setSelectedRepair(null)
      }
    } catch (loadError) {
      if (await handleSessionError(loadError)) return
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las reparaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRepairs().catch(() => {})
  }, [])

  const buildPayload = (): RepairPayload => {
    if (!form.clienteNombre.trim()) throw new Error('El nombre del cliente es obligatorio.')
    if (!form.motivoIngreso.trim()) throw new Error('El motivo de ingreso es obligatorio.')

    const costoEstimado = Number(form.costoEstimado || '0')
    const costoFinal = Number(form.costoFinal || '0')

    if (!Number.isFinite(costoEstimado) || costoEstimado < 0) {
      throw new Error('El costo estimado debe ser mayor o igual a cero.')
    }

    if (!Number.isFinite(costoFinal) || costoFinal < 0) {
      throw new Error('El costo final debe ser mayor o igual a cero.')
    }

    return {
      client: {
        nombre: form.clienteNombre.trim(),
        documento: form.clienteDocumento.trim() || undefined,
        telefono: form.clienteTelefono.trim() || undefined,
        email: form.clienteEmail.trim() || undefined,
        direccion: form.clienteDireccion.trim() || undefined,
        notas: form.clienteNotas.trim() || undefined,
      },
      dispositivoTipo: form.dispositivoTipo.trim() || undefined,
      marca: form.marca.trim() || undefined,
      modelo: form.modelo.trim() || undefined,
      referencia: form.referencia.trim() || undefined,
      color: form.color.trim() || undefined,
      serie: form.serie.trim() || undefined,
      motivoIngreso: form.motivoIngreso.trim(),
      diagnostico: form.diagnostico.trim() || undefined,
      accesorios: form.accesorios.trim() || undefined,
      costoEstimado,
      costoFinal,
      responsable: form.responsable.trim() || undefined,
      notas: form.notas.trim() || undefined,
    }
  }

  const handleEdit = (repair: Repair) => {
    setEditingId(repair.id)
    setForm({
      clienteNombre: repair.cliente.nombre,
      clienteDocumento: repair.cliente.documento ?? '',
      clienteTelefono: repair.cliente.telefono ?? '',
      clienteEmail: repair.cliente.email ?? '',
      clienteDireccion: repair.cliente.direccion ?? '',
      clienteNotas: repair.cliente.notas ?? '',
      dispositivoTipo: repair.dispositivoTipo ?? '',
      marca: repair.marca ?? '',
      modelo: repair.modelo ?? '',
      referencia: repair.referencia ?? '',
      color: repair.color ?? '',
      serie: repair.serie ?? '',
      motivoIngreso: repair.motivoIngreso ?? '',
      diagnostico: repair.diagnostico ?? '',
      accesorios: repair.accesorios ?? '',
      costoEstimado: String(repair.costoEstimado ?? 0),
      costoFinal: String(repair.costoFinal ?? 0),
      responsable: repair.responsable ?? '',
      notas: repair.notas ?? '',
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      const payload = buildPayload()

      if (editingId === null) {
        const created = await createRepair(payload)
        setSuccess(`Reparacion creada con ticket ${created.codigo}.`)
        resetForm()
        await loadRepairs({ selectId: created.id })
      } else {
        const updated = await updateRepair(editingId, payload)
        setSuccess(`Reparacion ${updated.codigo} actualizada correctamente.`)
        resetForm()
        await loadRepairs({ selectId: updated.id })
      }
    } catch (submitError) {
      if (await handleSessionError(submitError)) return
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar la reparacion')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRepair) return
    if (selectedRepair.estado === nextStatus) {
      setError('Selecciona un estado diferente al actual.')
      return
    }

    try {
      setStatusSaving(true)
      setError(null)
      setSuccess(null)
      await addRepairUpdate(selectedRepair.id, {
        estado: nextStatus,
        comentario: statusComment.trim() || undefined,
        registradoPor: user?.name ?? 'Administrador',
      })
      setSuccess(`Estado actualizado a ${formatStatusLabel(nextStatus)}.`)
      setStatusComment('')
      await loadRepairs({ selectId: selectedRepair.id })
    } catch (statusError) {
      if (await handleSessionError(statusError)) return
      setError(statusError instanceof Error ? statusError.message : 'No se pudo actualizar el estado')
    } finally {
      setStatusSaving(false)
    }
  }

  return (
    <section className="stack-lg">
      <header className="page-header">
        <div>
          <p className="eyebrow">Taller y seguimiento</p>
          <h1>Gestion de reparaciones</h1>
          <p className="muted">Opera tickets con mejor lectura visual, filtros claros y feedback inmediato para mostrador y taller.</p>
        </div>

        <div className="stats-inline">
          <div>
            <strong>{summary.total}</strong>
            <span>tickets</span>
          </div>
          <div>
            <strong>{summary.pendientes}</strong>
            <span>pendientes</span>
          </div>
          <div>
            <strong>{summary.listas}</strong>
            <span>listas</span>
          </div>
        </div>
      </header>

      <div className="admin-grid repairs-admin-grid">
        <form className="panel stack-md" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <h2>{isEditing ? 'Editar reparacion' : 'Nueva reparacion'}</h2>
            {isEditing && (
              <button className="link-button" onClick={resetForm} type="button">
                Cancelar
              </button>
            )}
          </div>

          <div className="section-title">Cliente</div>
          <label>
            <span>Nombre</span>
            <input value={form.clienteNombre} onChange={(event) => setForm((prev) => ({ ...prev, clienteNombre: event.target.value }))} />
          </label>

          <div className="field-row">
            <label>
              <span>Documento</span>
              <input value={form.clienteDocumento} onChange={(event) => setForm((prev) => ({ ...prev, clienteDocumento: event.target.value }))} />
            </label>
            <label>
              <span>Telefono</span>
              <input value={form.clienteTelefono} onChange={(event) => setForm((prev) => ({ ...prev, clienteTelefono: event.target.value }))} />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={form.clienteEmail} onChange={(event) => setForm((prev) => ({ ...prev, clienteEmail: event.target.value }))} />
            </label>
          </div>

          <label>
            <span>Direccion</span>
            <input value={form.clienteDireccion} onChange={(event) => setForm((prev) => ({ ...prev, clienteDireccion: event.target.value }))} />
          </label>

          <label>
            <span>Notas del cliente</span>
            <textarea rows={2} value={form.clienteNotas} onChange={(event) => setForm((prev) => ({ ...prev, clienteNotas: event.target.value }))} />
          </label>

          <div className="section-title">Equipo</div>
          <div className="field-row">
            <label>
              <span>Tipo</span>
              <input value={form.dispositivoTipo} onChange={(event) => setForm((prev) => ({ ...prev, dispositivoTipo: event.target.value }))} />
            </label>
            <label>
              <span>Marca</span>
              <input value={form.marca} onChange={(event) => setForm((prev) => ({ ...prev, marca: event.target.value }))} />
            </label>
            <label>
              <span>Modelo</span>
              <input value={form.modelo} onChange={(event) => setForm((prev) => ({ ...prev, modelo: event.target.value }))} />
            </label>
          </div>

          <div className="field-row">
            <label>
              <span>Referencia</span>
              <input value={form.referencia} onChange={(event) => setForm((prev) => ({ ...prev, referencia: event.target.value }))} />
            </label>
            <label>
              <span>Color</span>
              <input value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} />
            </label>
            <label>
              <span>Serie</span>
              <input value={form.serie} onChange={(event) => setForm((prev) => ({ ...prev, serie: event.target.value }))} />
            </label>
          </div>

          <label>
            <span>Motivo de ingreso</span>
            <textarea rows={4} value={form.motivoIngreso} onChange={(event) => setForm((prev) => ({ ...prev, motivoIngreso: event.target.value }))} />
          </label>

          <label>
            <span>Diagnostico</span>
            <textarea rows={3} value={form.diagnostico} onChange={(event) => setForm((prev) => ({ ...prev, diagnostico: event.target.value }))} />
          </label>

          <label>
            <span>Accesorios</span>
            <textarea rows={2} value={form.accesorios} onChange={(event) => setForm((prev) => ({ ...prev, accesorios: event.target.value }))} />
          </label>

          <div className="field-row">
            <label>
              <span>Costo estimado</span>
              <input type="number" min="0" value={form.costoEstimado} onChange={(event) => setForm((prev) => ({ ...prev, costoEstimado: event.target.value }))} />
            </label>
            <label>
              <span>Costo final</span>
              <input type="number" min="0" value={form.costoFinal} onChange={(event) => setForm((prev) => ({ ...prev, costoFinal: event.target.value }))} />
            </label>
            <label>
              <span>Responsable</span>
              <input value={form.responsable} onChange={(event) => setForm((prev) => ({ ...prev, responsable: event.target.value }))} />
            </label>
          </div>

          <label>
            <span>Notas internas</span>
            <textarea rows={3} value={form.notas} onChange={(event) => setForm((prev) => ({ ...prev, notas: event.target.value }))} />
          </label>

          {success && <p className="form-success">{success}</p>}
          {error && <p className="form-error">{error}</p>}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Guardando...' : isEditing ? 'Actualizar reparacion' : 'Crear reparacion'}
          </button>
        </form>

        <div className="stack-md">
          <section className="panel stack-md">
            <div className="panel-heading">
              <h2>Tickets</h2>
              <button className="ghost-button" onClick={() => loadRepairs()} type="button">
                Recargar
              </button>
            </div>

            <div className="field-row">
              <label>
                <span>Buscar</span>
                <input placeholder="Codigo, cliente, marca..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <label>
                <span>Estado</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">Todos</option>
                  {repairStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="toolbar-end">
                <button className="primary-button" onClick={() => loadRepairs()} type="button">
                  Buscar
                </button>
              </div>
            </div>

            {loading ? (
              <p className="muted">Cargando reparaciones...</p>
            ) : repairs.length === 0 ? (
              <p className="muted">No hay tickets para los filtros actuales.</p>
            ) : (
              <div className="repair-list">
                {repairs.map((repair) => (
                  <button
                    className={`repair-list-item${selectedRepair?.id === repair.id ? ' active' : ''}`}
                    key={repair.id}
                    onClick={() => loadRepairDetail(repair.id)}
                    type="button"
                  >
                    <div className="repair-list-item-head">
                      <strong>{repair.codigo}</strong>
                      <span className={`status-pill status-${repair.estado}`}>{formatStatusLabel(repair.estado)}</span>
                    </div>
                    <div className="repair-list-item-body">
                      <p>{repair.clienteNombre}</p>
                      <p className="muted">{[repair.marca, repair.modelo, repair.dispositivoTipo].filter(Boolean).join(' | ')}</p>
                      <p className="muted">{repair.motivoIngreso ?? 'Sin motivo registrado'}</p>
                      <div className="tag-row">
                        <span>{formatCurrency(repair.costoEstimado)}</span>
                        <span>{repair.clienteTelefono ?? 'Sin telefono'}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel stack-md">
            <div className="panel-heading">
              <h2>Detalle e historial</h2>
              {selectedRepair && (
                <button className="ghost-button" onClick={() => handleEdit(selectedRepair)} type="button">
                  Editar
                </button>
              )}
            </div>

            {detailLoading ? (
              <p className="muted">Cargando detalle...</p>
            ) : !selectedRepair ? (
              <p className="muted">Selecciona un ticket para ver el detalle.</p>
            ) : (
              <div className="stack-md">
                <div className="repair-detail-grid">
                  <div>
                    <p className="repair-code">{selectedRepair.codigo}</p>
                    <p className="muted">{selectedRepair.cliente.nombre}</p>
                    <p className="muted">{[selectedRepair.marca, selectedRepair.modelo, selectedRepair.dispositivoTipo].filter(Boolean).join(' | ')}</p>
                  </div>
                  <div className="stack-sm">
                    <span className={`status-pill status-${selectedRepair.estado}`}>{formatStatusLabel(selectedRepair.estado)}</span>
                    <span className="muted">Actualizado: {formatDateTime(selectedRepair.updatedAt)}</span>
                  </div>
                </div>

                <div className="tag-row">
                  <span>Estimado: {formatCurrency(selectedRepair.costoEstimado)}</span>
                  <span>Final: {formatCurrency(selectedRepair.costoFinal)}</span>
                  <span>Responsable: {selectedRepair.responsable ?? 'Sin asignar'}</span>
                </div>

                <div className="detail-block">
                  <strong>Motivo de ingreso</strong>
                  <p>{selectedRepair.motivoIngreso ?? 'Sin registrar'}</p>
                </div>

                <div className="detail-block">
                  <strong>Diagnostico</strong>
                  <p>{selectedRepair.diagnostico ?? 'Pendiente'}</p>
                </div>

                <form className="stack-sm" onSubmit={handleStatusSubmit}>
                  <div className="section-title">Cambio de estado</div>
                  <div className="field-row status-form-row">
                    <label>
                      <span>Nuevo estado</span>
                      <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as RepairStatus)}>
                        {repairStatuses.filter((status) => status !== selectedRepair.estado).map((status) => (
                          <option key={status} value={status}>
                            {formatStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="status-comment-field">
                      <span>Comentario</span>
                      <input value={statusComment} onChange={(event) => setStatusComment(event.target.value)} />
                    </label>
                    <div className="toolbar-end">
                      <button className="primary-button" disabled={statusSaving} type="submit">
                        {statusSaving ? 'Actualizando...' : 'Cambiar estado'}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="section-title">Historial</div>
                <div className="timeline">
                  {selectedRepair.updates.map((update) => (
                    <article className="timeline-item" key={update.id}>
                      <div className="timeline-item-head">
                        <span className={`status-pill status-${update.estado}`}>{formatStatusLabel(update.estado)}</span>
                        <span className="muted">{formatDateTime(update.createdAt)}</span>
                      </div>
                      <p>{update.comentario || 'Sin comentario'}</p>
                      <span className="muted">{update.registradoPor || 'Sistema'}</span>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

function getNextStatus(status: RepairStatus): RepairStatus {
  const index = repairStatuses.indexOf(status)
  return repairStatuses[Math.min(index + 1, repairStatuses.length - 1)]
}
