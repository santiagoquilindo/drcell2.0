import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCcw,
  Trash2,
  ArrowLeft,
} from 'lucide-react'

import type { InventoryItem } from '@modules/inventory'
import type { InvoiceDetail, InvoiceItemInput, InvoiceStatus, InvoiceSummary, InvoiceType } from '@modules/invoices'
import {
  createInvoice,
  downloadInvoicePdf,
  fetchInvoiceDetail,
  fetchInvoices,
  fetchInventory,
  setAdminToken as setApiAdminToken,
  updateInvoiceStatus,
} from '@utils/api'
import { formatoCOP } from '@utils/money'

const ADMIN_STORAGE_KEY = 'dc_admin_token'

type InvoiceItemForm = {
  id: string
  descripcion: string
  inventarioItemId: string
  cantidad: string
  precioUnitario: string
  impuestoPorcentaje: string
  descuentoPorcentaje: string
}

const emptyItem = (): InvoiceItemForm => ({
  id: Math.random().toString(36).slice(2),
  descripcion: '',
  inventarioItemId: '',
  cantidad: '1',
  precioUnitario: '0',
  impuestoPorcentaje: '0',
  descuentoPorcentaje: '0',
})

const initialFormState = {
  tipo: 'cotizacion' as InvoiceType,
  clienteNombre: '',
  clienteIdentificacion: '',
  clienteTelefono: '',
  clienteEmail: '',
  clienteDireccion: '',
  notas: '',
  anticipo: '0',
  items: [emptyItem()],
}

export const Billing: React.FC = () => {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [invoices, setInvoices] = React.useState<InvoiceSummary[]>([])
  const [inventory, setInventory] = React.useState<InventoryItem[]>([])
  const [form, setForm] = React.useState(initialFormState)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null)
  const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceDetail | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = React.useState<number | null>(null)

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
        setError(null)
        const [invoiceData, inventoryData] = await Promise.all([fetchInvoices(), fetchInventory()])
        setInvoices(invoiceData)
        setInventory(inventoryData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la facturación')
      } finally {
        setLoading(false)
      }
    }
    load().catch((err) => console.error(err))
  }, [isAdmin])

  const totals = React.useMemo(() => {
    const items = form.items.map((item) => {
      const cantidad = Number(item.cantidad) || 0
      const precio = Number(item.precioUnitario) || 0
      const descuento = Number(item.descuentoPorcentaje) || 0
      const impuesto = Number(item.impuestoPorcentaje) || 0
      const base = cantidad * precio
      const descuentoValor = (base * descuento) / 100
      const baseSinDescuento = base - descuentoValor
      const impuestoValor = (baseSinDescuento * impuesto) / 100
      const total = baseSinDescuento + impuestoValor
      return { total, descuentoValor, impuestoValor, subtotal: base }
    })
    const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0)
    const descuento = items.reduce((acc, item) => acc + item.descuentoValor, 0)
    const impuesto = items.reduce((acc, item) => acc + item.impuestoValor, 0)
    const total = subtotal - descuento + impuesto
    const anticipo = Number(form.anticipo) || 0
    const saldo = Math.max(total - anticipo, 0)
    return { subtotal, descuento, impuesto, total, saldo }
  }, [form.items, form.anticipo])

  const handleFormChange = (field: keyof typeof initialFormState, value: string | InvoiceType) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateItem = (itemId: string, field: keyof InvoiceItemForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    }))
  }

  const handleInventorySelect = (itemId: string, inventoryId: string) => {
    const inv = inventory.find((item) => item.id === Number(inventoryId))
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              inventarioItemId: inventoryId,
              descripcion: item.descripcion || inv?.nombre || '',
              precioUnitario: inv ? String(inv.precioVenta ?? 0) : item.precioUnitario,
            }
          : item,
      ),
    }))
  }

  const addItemRow = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))
  }

  const removeItemRow = (itemId: string) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== itemId) }))
  }

  const resetForm = () => {
    setForm(initialFormState)
    setFormError(null)
  }

  const parseItems = (): InvoiceItemInput[] => {
    return form.items
      .filter((item) => item.descripcion.trim() !== '')
      .map((item) => ({
        descripcion: item.descripcion.trim(),
        inventarioItemId: item.inventarioItemId ? Number(item.inventarioItemId) : undefined,
        cantidad: Number(item.cantidad) || 1,
        precioUnitario: Number(item.precioUnitario) || 0,
        impuestoPorcentaje: Number(item.impuestoPorcentaje) || 0,
        descuentoPorcentaje: Number(item.descuentoPorcentaje) || 0,
      }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    const items = parseItems()
    if (items.length === 0) {
      setFormError('Agrega al menos un concepto con descripción')
      return
    }
    if (!form.clienteNombre.trim()) {
      setFormError('El cliente es obligatorio')
      return
    }
    try {
      setCreating(true)
      const invoice = await createInvoice({
        tipo: form.tipo,
        clienteNombre: form.clienteNombre.trim(),
        clienteIdentificacion: form.clienteIdentificacion.trim() || undefined,
        clienteTelefono: form.clienteTelefono.trim() || undefined,
        clienteEmail: form.clienteEmail.trim() || undefined,
        clienteDireccion: form.clienteDireccion.trim() || undefined,
        notas: form.notas.trim() || undefined,
        anticipo: Number(form.anticipo) || 0,
        items,
      })
      setInvoices((prev) => [detailToSummary(invoice), ...prev])
      setSelectedInvoice(invoice)
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la factura')
    } finally {
      setCreating(false)
    }
  }

  const handleDownload = async (invoiceId: number) => {
    try {
      setDownloadingId(invoiceId)
      const blob = await downloadInvoicePdf(invoiceId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleSelectInvoice = async (invoiceId: number) => {
    try {
      setError(null)
      const detail = await fetchInvoiceDetail(invoiceId)
      setSelectedInvoice(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la factura')
    }
  }

  const handleStatusChange = async (invoiceId: number, estado: InvoiceStatus) => {
    try {
      setUpdatingStatusId(invoiceId)
      const updated = await updateInvoiceStatus(invoiceId, { estado })
      setInvoices((prev) =>
        prev.map((invoice) => (invoice.id === invoiceId ? { ...invoice, ...updated } : invoice)),
      )
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice((prev) => (prev ? { ...prev, estado: updated.estado, anticipo: updated.anticipo, saldo: updated.saldo } : prev))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-md space-y-4">
          <p className="text-xl font-semibold text-slate-800">Acceso restringido</p>
          <p className="text-slate-600">
            Para gestionar las facturas ingresa como administrador desde la página principal y vuelve a
            intentarlo.
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
          >
            <ArrowLeft size={18} />
            Regresar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Doctor Cell 2.0</p>
            <h1 className="text-3xl font-bold text-slate-900">Facturación y cotizaciones</h1>
            <p className="text-slate-500">Genera cuentas de cobro y descárgalas en PDF.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              <ArrowLeft size={16} /> Volver al inicio
            </button>
            <button
              onClick={() => {
                setLoading(true)
                Promise.all([fetchInvoices(), fetchInventory()])
                  .then(([invoiceData, inventoryData]) => {
                    setInvoices(invoiceData)
                    setInventory(inventoryData)
                    setError(null)
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo actualizar'))
                  .finally(() => setLoading(false))
              }}
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
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-green-600" size={20} />
              <h2 className="text-xl font-semibold text-slate-900">Nueva factura / cotización</h2>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Tipo
                  <select
                    value={form.tipo}
                    onChange={(event) => handleFormChange('tipo', event.target.value as InvoiceType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="cotizacion">Cotización</option>
                    <option value="factura">Factura</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Cliente *
                  <input
                    value={form.clienteNombre}
                    onChange={(event) => handleFormChange('clienteNombre', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Nombre del cliente"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Identificación
                  <input
                    value={form.clienteIdentificacion}
                    onChange={(event) => handleFormChange('clienteIdentificacion', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Teléfono
                  <input
                    value={form.clienteTelefono}
                    onChange={(event) => handleFormChange('clienteTelefono', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Email
                  <input
                    type="email"
                    value={form.clienteEmail}
                    onChange={(event) => handleFormChange('clienteEmail', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Dirección
                  <input
                    value={form.clienteDireccion}
                    onChange={(event) => handleFormChange('clienteDireccion', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="text-sm text-slate-700">
                Notas
                <textarea
                  value={form.notas}
                  onChange={(event) => handleFormChange('notas', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                />
              </label>

              <div className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Conceptos</p>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {form.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-slate-500">
                          Inventario
                          <select
                            value={item.inventarioItemId}
                            onChange={(event) => handleInventorySelect(item.id, event.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          >
                            <option value="">Manual</option>
                            {inventory.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.nombre}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex-1" />
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(item.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={12} /> Quitar
                          </button>
                        )}
                      </div>
                      <label className="text-xs font-semibold text-slate-600">
                        Descripción
                        <input
                          value={item.descripcion}
                          onChange={(event) => updateItem(item.id, 'descripcion', event.target.value)}
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          placeholder="Ej: Cambio de pantalla"
                        />
                      </label>
                      <div className="grid gap-2 md:grid-cols-4">
                        <label className="text-xs text-slate-600">
                          Cantidad
                          <input
                            type="number"
                            min={1}
                            value={item.cantidad}
                            onChange={(event) => updateItem(item.id, 'cantidad', event.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          Precio unitario
                          <input
                            type="number"
                            min={0}
                            value={item.precioUnitario}
                            onChange={(event) => updateItem(item.id, 'precioUnitario', event.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          IVA %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.impuestoPorcentaje}
                            onChange={(event) => updateItem(item.id, 'impuestoPorcentaje', event.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          Descuento %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.descuentoPorcentaje}
                            onChange={(event) => updateItem(item.id, 'descuentoPorcentaje', event.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="text-sm text-slate-700">
                Anticipo (opcional)
                <input
                  type="number"
                  min={0}
                  value={form.anticipo}
                  onChange={(event) => handleFormChange('anticipo', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatoCOP(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Impuestos</span>
                  <span>{formatoCOP(totals.impuesto)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Descuentos</span>
                  <span>-{formatoCOP(totals.descuento)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatoCOP(totals.total)}</span>
                </div>
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>Saldo</span>
                  <span>{formatoCOP(totals.saldo)}</span>
                </div>
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-full bg-green-600 px-4 py-2 text-center text-base font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {creating ? 'Guardando...' : 'Guardar y generar PDF'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Historial</h2>
              {loading && <span className="text-xs text-slate-500">Cargando...</span>}
            </div>

            <div className="mt-4 space-y-4">
              {invoices.length === 0 && !loading && (
                <p className="text-sm text-slate-500">Aún no hay facturas registradas.</p>
              )}

              {invoices.map((invoice) => (
                <article key={invoice.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        #{invoice.consecutivo} · {invoice.clienteNombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(invoice.createdAt).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                        })}
                        {' · '}
                        {invoice.itemsCount} ítems
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900">{formatoCOP(invoice.total)}</p>
                      <StatusBadge status={invoice.estado} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <button
                      onClick={() => handleDownload(invoice.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Download size={14} />
                      {downloadingId === invoice.id ? 'Generando...' : 'PDF'}
                    </button>
                    <button
                      onClick={() => handleSelectInvoice(invoice.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Ver detalle
                    </button>
                    <select
                      value={invoice.estado}
                      onChange={(event) => handleStatusChange(invoice.id, event.target.value as InvoiceStatus)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                      disabled={updatingStatusId === invoice.id}
                    >
                      <option value="borrador">Borrador</option>
                      <option value="emitida">Emitida</option>
                      <option value="pagada">Pagada</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>

            {selectedInvoice && (
              <div className="mt-6 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Detalle de #{selectedInvoice.consecutivo}
                </p>
                <p className="text-xs text-slate-500">{selectedInvoice.clienteNombre}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {selectedInvoice.items.map((item) => (
                    <li key={item.id} className="flex justify-between border-b border-slate-100 pb-1">
                      <span>
                        {item.descripcion} · <span className="text-xs">x{item.cantidad}</span>
                      </span>
                      <span>{formatoCOP(item.total)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-right text-sm text-slate-600">
                  <p>Total: {formatoCOP(selectedInvoice.total)}</p>
                  <p>Saldo: {formatoCOP(selectedInvoice.saldo)}</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  emitida: 'bg-amber-100 text-amber-800',
  pagada: 'bg-emerald-100 text-emerald-800',
}

const StatusBadge: React.FC<{ status: InvoiceStatus }> = ({ status }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`}>
    {status.toUpperCase()}
  </span>
)

const detailToSummary = (invoice: InvoiceDetail): InvoiceSummary => ({
  id: invoice.id,
  consecutivo: invoice.consecutivo,
  tipo: invoice.tipo,
  estado: invoice.estado,
  clienteNombre: invoice.clienteNombre,
  clienteIdentificacion: invoice.clienteIdentificacion,
  clienteTelefono: invoice.clienteTelefono,
  clienteEmail: invoice.clienteEmail,
  clienteDireccion: invoice.clienteDireccion,
  notas: invoice.notas,
  subtotal: invoice.subtotal,
  impuesto: invoice.impuesto,
  descuento: invoice.descuento,
  total: invoice.total,
  anticipo: invoice.anticipo,
  saldo: invoice.saldo,
  createdAt: invoice.createdAt,
  updatedAt: invoice.updatedAt,
  itemsCount: invoice.items.length,
})

export default Billing
