import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@features/admin/auth/AuthContext'
import { ApiError } from '@shared/api/client'
import { fetchInventoryItems } from '@shared/api/inventory'
import { addRepairPart, addRepairUpdate, createRepair, fetchRepair, fetchRepairs, revertRepairPart, updateRepair } from '@shared/api/repairs'
import { formatCurrency } from '@shared/lib/currency'
import { formatDateTime, formatStatusLabel } from '@shared/lib/date'
import type { InventoryItem } from '@shared/types/inventory'
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
  manoObra: '0',
  responsable: '',
  notas: '',
}

const initialPartForm = {
  inventoryItemId: '',
  cantidad: '1',
  notas: '',
}

export function AdminRepairsPage() {
  const navigate = useNavigate()
  const { user, logoutAction } = useAuth()
  const [repairs, setRepairs] = useState<RepairSummary[]>([])
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [partSaving, setPartSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [statusComment, setStatusComment] = useState('')
  const [nextStatus, setNextStatus] = useState<RepairStatus>('diagnostico')
  const [form, setForm] = useState(initialForm)
  const [partForm, setPartForm] = useState(initialPartForm)

  const summary = useMemo(
    () => ({
      total: repairs.length,
      pendientes: repairs.filter((repair) => repair.estado !== 'entregado').length,
      listas: repairs.filter((repair) => repair.estado === 'listo').length,
    }),
    [repairs],
  )

  const isEditing = editingId !== null
  const selectedPartItem = partForm.inventoryItemId
    ? inventoryItems.find((item) => item.id === Number(partForm.inventoryItemId)) ?? null
    : null
  const formPartsSubtotal = editingId !== null && selectedRepair?.id === editingId ? selectedRepair.subtotalRepuestos : 0
  const formManualLabor = Number(form.manoObra || '0')
  const formDerivedTotal = formPartsSubtotal + (Number.isFinite(formManualLabor) ? formManualLabor : 0)

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

  useEffect(() => {
    fetchInventoryItems({ estado: 'activo' })
      .then((items) => setInventoryItems(items))
      .catch(() => {})
  }, [])

  const buildPayload = (): RepairPayload => {
    if (!form.clienteNombre.trim()) throw new Error('El nombre del cliente es obligatorio.')
    if (!form.motivoIngreso.trim()) throw new Error('El motivo de ingreso es obligatorio.')

    const costoEstimado = Number(form.costoEstimado || '0')
    const manoObra = Number(form.manoObra || '0')

    if (!Number.isFinite(costoEstimado) || costoEstimado < 0) {
      throw new Error('El costo estimado debe ser mayor o igual a cero.')
    }

    if (!Number.isFinite(manoObra) || manoObra < 0) {
      throw new Error('La mano de obra debe ser mayor o igual a cero.')
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
      manoObra,
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
      manoObra: String(repair.manoObra ?? 0),
      responsable: repair.responsable ?? '',
      notas: repair.notas ?? '',
    })
  }

  const handlePartSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedRepair) return

    try {
      const inventoryItemId = Number(partForm.inventoryItemId)
      const cantidad = Number(partForm.cantidad)

      if (!Number.isInteger(inventoryItemId) || inventoryItemId <= 0) {
        throw new Error('Selecciona un item de inventario valido.')
      }

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error('La cantidad debe ser mayor a cero.')
      }

      setPartSaving(true)
      setError(null)
      setSuccess(null)

      await addRepairPart(selectedRepair.id, {
        inventoryItemId,
        cantidad,
        notas: partForm.notas.trim() || undefined,
      })

      setPartForm(initialPartForm)
      setSuccess('Repuesto consumido y descontado de inventario.')
      await loadRepairDetail(selectedRepair.id)
    } catch (partError) {
      if (await handleSessionError(partError)) return
      setError(partError instanceof Error ? partError.message : 'No se pudo registrar el repuesto')
    } finally {
      setPartSaving(false)
    }
  }

  const handleRevertPart = async (partId: number) => {
    if (!selectedRepair) return
    if (!window.confirm('Esta accion devolvera el stock al inventario y dejara el consumo como revertido.')) return

    try {
      setPartSaving(true)
      setError(null)
      setSuccess(null)
      await revertRepairPart(selectedRepair.id, partId)
      setSuccess('Consumo revertido y stock repuesto en inventario.')
      await loadRepairDetail(selectedRepair.id)
    } catch (partError) {
      if (await handleSessionError(partError)) return
      setError(partError instanceof Error ? partError.message : 'No se pudo revertir el consumo')
    } finally {
      setPartSaving(false)
    }
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
              <span>Mano de obra</span>
              <input type="number" min="0" value={form.manoObra} onChange={(event) => setForm((prev) => ({ ...prev, manoObra: event.target.value }))} />
            </label>
            <label>
              <span>Responsable</span>
              <input value={form.responsable} onChange={(event) => setForm((prev) => ({ ...prev, responsable: event.target.value }))} />
            </label>
          </div>

          <div className="product-link-context">
            <strong>Regla economica activa</strong>
            <div className="tag-row">
              <span>Estimado manual: {formatCurrency(Number(form.costoEstimado || '0'))}</span>
              <span>Repuestos calculados: {formatCurrency(formPartsSubtotal)}</span>
              <span>Mano de obra manual: {formatCurrency(formManualLabor)}</span>
              <span>Total final derivado: {formatCurrency(formDerivedTotal)}</span>
            </div>
            <p className="muted">Los repuestos consumidos no se editan aqui. El total final real se recalcula con los repuestos del ticket.</p>
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
                        <span>Repuestos: {formatCurrency(repair.subtotalRepuestos)}</span>
                        <span>Mano de obra: {formatCurrency(repair.manoObra)}</span>
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
                  <span>Repuestos: {formatCurrency(selectedRepair.subtotalRepuestos)}</span>
                  <span>Mano de obra: {formatCurrency(selectedRepair.manoObra)}</span>
                  <span>Total final: {formatCurrency(selectedRepair.costoFinal)}</span>
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

                <div className="stack-sm">
                  <div className="section-title">Repuestos consumidos</div>
                  <form className="stack-sm repair-parts-form" onSubmit={handlePartSubmit}>
                    <div className="field-row repair-parts-row">
                      <label>
                        <span>Item de inventario</span>
                        <select
                          disabled={selectedRepair.estado === 'entregado' || partSaving}
                          value={partForm.inventoryItemId}
                          onChange={(event) => setPartForm((prev) => ({ ...prev, inventoryItemId: event.target.value }))}
                        >
                          <option value="">Selecciona un item</option>
                          {inventoryItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.sku} - {item.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Cantidad</span>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          disabled={selectedRepair.estado === 'entregado' || partSaving}
                          value={partForm.cantidad}
                          onChange={(event) => setPartForm((prev) => ({ ...prev, cantidad: event.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Notas</span>
                        <input
                          disabled={selectedRepair.estado === 'entregado' || partSaving}
                          value={partForm.notas}
                          onChange={(event) => setPartForm((prev) => ({ ...prev, notas: event.target.value }))}
                        />
                      </label>
                      <div className="toolbar-end">
                        <button className="primary-button" disabled={selectedRepair.estado === 'entregado' || partSaving} type="submit">
                          {partSaving ? 'Guardando...' : 'Agregar repuesto'}
                        </button>
                      </div>
                    </div>
                    {selectedRepair.estado === 'entregado' && <p className="muted">Una reparacion entregada ya no admite nuevos consumos ni reversiones.</p>}
                    {selectedPartItem && (
                      <div className="tag-row">
                        <span>SKU: {selectedPartItem.sku}</span>
                        <span>{selectedPartItem.nombre}</span>
                        <span>Stock actual: {selectedPartItem.stockActual}</span>
                        <span>Tipo: {selectedPartItem.tipo}</span>
                      </div>
                    )}
                  </form>

                  {selectedRepair.parts.length === 0 ? (
                    <p className="muted">Todavia no hay repuestos registrados para este ticket.</p>
                  ) : (
                    <div className="timeline">
                      {selectedRepair.parts.map((part) => (
                        <article className="timeline-item" key={part.id}>
                          <div className="timeline-item-head">
                            <span className={`status-pill ${part.estado === 'consumido' ? 'status-en_proceso' : 'status-entregado'}`}>
                              {part.estado === 'consumido' ? 'Consumido' : 'Revertido'}
                            </span>
                            <span className="muted">{formatDateTime(part.createdAt)}</span>
                          </div>
                          <p>
                            {part.itemSku} · {part.itemNombre} · Cantidad: {part.cantidad}
                          </p>
                          <div className="tag-row">
                            <span>Costo ref: {formatCurrency(part.costoUnitarioReferencial)}</span>
                            <span>Precio ref: {formatCurrency(part.precioUnitarioReferencial)}</span>
                            <span>Total ref: {formatCurrency(part.precioUnitarioReferencial * part.cantidad)}</span>
                          </div>
                          <p>{part.notas || 'Sin notas'}</p>
                          {part.estado === 'revertido' && part.revertedAt && <span className="muted">Revertido: {formatDateTime(part.revertedAt)}</span>}
                          {part.estado === 'consumido' && selectedRepair.estado !== 'entregado' && (
                            <div className="button-row">
                              <button className="ghost-button" disabled={partSaving} onClick={() => handleRevertPart(part.id)} type="button">
                                Revertir consumo
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
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
