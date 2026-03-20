import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@features/admin/auth/AuthContext'
import { ApiError } from '@shared/api/client'
import {
  createInventoryCategory,
  createInventoryItem,
  createInventoryMovement,
  fetchInventoryCategories,
  fetchInventoryItem,
  fetchInventoryItems,
  fetchInventoryMovements,
  fetchLowStockItems,
  fetchProviders,
  updateInventoryCategory,
  updateInventoryItem,
} from '@shared/api/inventory'
import { resolveAssetUrl } from '@shared/lib/assets'
import { formatCurrency } from '@shared/lib/currency'
import { formatDateTime } from '@shared/lib/date'
import { fileToDataUrl } from '@shared/lib/image'
import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemDetail,
  InventoryItemStatus,
  InventoryItemType,
  InventoryMovement,
  InventoryMovementType,
  InventoryProvider,
} from '@shared/types/inventory'

const itemTypes: InventoryItemType[] = ['repuesto', 'insumo', 'accesorio', 'producto', 'otro']
const itemStatuses: InventoryItemStatus[] = ['activo', 'inactivo']
const movementTypes: InventoryMovementType[] = ['entrada', 'salida', 'ajuste', 'consumo_reparacion', 'devolucion']
const initialItemForm = { nombre: '', sku: '', descripcion: '', categoriaId: '', proveedorId: '', tipo: 'repuesto' as InventoryItemType, unidadMedida: 'unidad', costoCompra: '0', precioVenta: '0', stockInicial: '0', stockMinimo: '0', permiteStockNegativo: false, estado: 'activo' as InventoryItemStatus, imagen: undefined as string | undefined }
const initialCategoryForm: { nombre: string; descripcion: string; estado: 'activo' | 'inactivo' } = { nombre: '', descripcion: '', estado: 'activo' }
const initialMovementForm = { tipoMovimiento: 'entrada' as InventoryMovementType, cantidad: '1', stockObjetivo: '', motivo: '', referencia: '', observaciones: '' }

export function AdminInventoryPage() {
  const navigate = useNavigate()
  const { logoutAction } = useAuth()
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [providers, setProviders] = useState<InventoryProvider[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<InventoryItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [savingMovement, setSavingMovement] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [movementQuery, setMovementQuery] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState('')
  const [movementFrom, setMovementFrom] = useState('')
  const [movementTo, setMovementTo] = useState('')
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [itemForm, setItemForm] = useState(initialItemForm)
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm)
  const [movementForm, setMovementForm] = useState(initialMovementForm)
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  const summary = useMemo(() => ({ total: items.length, lowStock: lowStockItems.length, active: items.filter((item) => item.estado === 'activo').length }), [items, lowStockItems])

  const handleSessionError = async (reason: unknown) => {
    if (reason instanceof ApiError && reason.status === 401) {
      await logoutAction()
      navigate('/admin/login', { replace: true })
      return true
    }
    return false
  }

  const loadItemDetail = async (id: number) => {
    try {
      setDetailLoading(true)
      setSelectedItem(await fetchInventoryItem(id))
    } catch (reason) {
      if (await handleSessionError(reason)) return
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el detalle del item')
    } finally {
      setDetailLoading(false)
    }
  }

  const loadInventory = async (selectId?: number) => {
    try {
      setLoading(true)
      const [categoryList, providerList, itemList, lowList] = await Promise.all([
        fetchInventoryCategories(),
        fetchProviders(),
        fetchInventoryItems({ q: query.trim() || undefined, categoriaId: categoryFilter ? Number(categoryFilter) : undefined, tipo: typeFilter || undefined, estado: statusFilter || undefined, lowStock: lowStockOnly }),
        fetchLowStockItems(),
      ])
      setCategories(categoryList)
      setProviders(providerList)
      setItems(itemList)
      setLowStockItems(lowList)
      setError(null)
      const target = selectId ?? selectedItem?.id ?? itemList[0]?.id
      if (target) await loadItemDetail(target)
      else setSelectedItem(null)
    } catch (reason) {
      if (await handleSessionError(reason)) return
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el inventario')
    } finally {
      setLoading(false)
    }
  }

  const loadMovements = async () => {
    try {
      setMovements(await fetchInventoryMovements({ itemId: selectedItem?.id, tipo: movementTypeFilter || undefined, from: movementFrom || undefined, to: movementTo || undefined, q: movementQuery.trim() || undefined }))
    } catch (reason) {
      if (await handleSessionError(reason)) return
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el historial de movimientos')
    }
  }

  useEffect(() => { loadInventory().catch(() => {}) }, [])
  useEffect(() => { loadMovements().catch(() => {}) }, [selectedItem?.id])

  const resetItemForm = () => {
    setEditingItemId(null)
    setItemForm(initialItemForm)
    setSelectedImageName(null)
    setImageError(null)
  }

  const buildItemPayload = () => {
    if (!itemForm.nombre.trim()) throw new Error('El nombre del item es obligatorio.')
    if (!itemForm.sku.trim()) throw new Error('El SKU es obligatorio.')
    if (!itemForm.categoriaId) throw new Error('Debes seleccionar una categoria.')
    if (imageError) throw new Error(imageError)
    const costoCompra = Number(itemForm.costoCompra)
    const precioVenta = Number(itemForm.precioVenta)
    const stockMinimo = Number(itemForm.stockMinimo)
    const stockInicial = Number(itemForm.stockInicial)
    if (!Number.isFinite(costoCompra) || costoCompra < 0) throw new Error('El costo de compra debe ser mayor o igual a cero.')
    if (!Number.isFinite(precioVenta) || precioVenta < 0) throw new Error('El precio de venta debe ser mayor o igual a cero.')
    if (!Number.isFinite(stockMinimo) || stockMinimo < 0) throw new Error('El stock minimo debe ser mayor o igual a cero.')
    if (!Number.isFinite(stockInicial) || stockInicial < 0) throw new Error('El stock inicial debe ser mayor o igual a cero.')
    return { nombre: itemForm.nombre.trim(), sku: itemForm.sku.trim(), descripcion: itemForm.descripcion.trim() || undefined, categoriaId: Number(itemForm.categoriaId), proveedorId: itemForm.proveedorId ? Number(itemForm.proveedorId) : null, tipo: itemForm.tipo, unidadMedida: itemForm.unidadMedida.trim(), costoCompra, precioVenta, stockInicial, stockMinimo, permiteStockNegativo: itemForm.permiteStockNegativo, estado: itemForm.estado, imagen: itemForm.imagen }
  }

  const handleItemSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setSavingItem(true); setError(null); setSuccess(null)
      const payload = buildItemPayload()
      const item = editingItemId === null ? await createInventoryItem(payload) : await updateInventoryItem(editingItemId, payload)
      setSuccess(`Item ${item.sku} ${editingItemId === null ? 'creado' : 'actualizado'} correctamente.`)
      resetItemForm()
      await loadInventory(item.id)
    } catch (reason) {
      if (await handleSessionError(reason)) return
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el item')
    } finally {
      setSavingItem(false)
    }
  }

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setSavingCategory(true); setError(null); setSuccess(null)
      const payload = { nombre: categoryForm.nombre.trim(), descripcion: categoryForm.descripcion.trim() || undefined, estado: categoryForm.estado }
      if (!payload.nombre) throw new Error('El nombre de la categoria es obligatorio.')
      if (editingCategoryId === null) await createInventoryCategory(payload)
      else await updateInventoryCategory(editingCategoryId, payload)
      setSuccess(`Categoria ${editingCategoryId === null ? 'creada' : 'actualizada'} correctamente.`)
      setEditingCategoryId(null)
      setCategoryForm(initialCategoryForm)
      await loadInventory(selectedItem?.id)
    } catch (reason) {
      if (await handleSessionError(reason)) return
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la categoria')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleMovementSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedItem) return setError('Selecciona un item antes de registrar movimientos.')
    try {
      setSavingMovement(true); setError(null); setSuccess(null)
      const payload = movementForm.tipoMovimiento === 'ajuste'
        ? { tipoMovimiento: movementForm.tipoMovimiento, stockObjetivo: Number(movementForm.stockObjetivo), motivo: movementForm.motivo.trim(), referencia: movementForm.referencia.trim() || undefined, observaciones: movementForm.observaciones.trim() || undefined }
        : { tipoMovimiento: movementForm.tipoMovimiento, cantidad: Number(movementForm.cantidad), motivo: movementForm.motivo.trim(), referencia: movementForm.referencia.trim() || undefined, observaciones: movementForm.observaciones.trim() || undefined }
      if (!payload.motivo) throw new Error('Debes indicar un motivo para el movimiento.')
      const updated = await createInventoryMovement(selectedItem.id, payload)
      setSelectedItem(updated)
      setMovementForm(initialMovementForm)
      setSuccess(`Movimiento ${movementLabel(movementForm.tipoMovimiento)} registrado correctamente.`)
      await loadInventory(updated.id)
      await loadMovements()
    } catch (reason) {
      if (await handleSessionError(reason)) return
      setError(reason instanceof Error ? reason.message : 'No se pudo registrar el movimiento')
    } finally {
      setSavingMovement(false)
    }
  }

  const handleEditItem = (item: InventoryItemDetail) => {
    setEditingItemId(item.id)
    setItemForm({ nombre: item.nombre, sku: item.sku, descripcion: item.descripcion ?? '', categoriaId: item.categoriaId ? String(item.categoriaId) : '', proveedorId: item.proveedorId ? String(item.proveedorId) : '', tipo: item.tipo, unidadMedida: item.unidadMedida, costoCompra: String(item.costoCompra), precioVenta: String(item.precioVenta), stockInicial: String(item.stockActual), stockMinimo: String(item.stockMinimo), permiteStockNegativo: item.permiteStockNegativo, estado: item.estado, imagen: undefined })
    setSelectedImageName(item.imagenUrl ? 'Imagen actual del item' : null)
    setImageError(null)
  }

  return (
    <section className="stack-lg">
      <header className="page-header">
        <div><p className="eyebrow">Operacion y stock</p><h1>Inventario real</h1><p className="muted">Controla items inventariables, stock minimo y movimientos con trazabilidad completa separada del catalogo comercial.</p></div>
        <div className="stats-inline"><div><strong>{summary.total}</strong><span>items</span></div><div><strong>{summary.lowStock}</strong><span>stock bajo</span></div><div><strong>{summary.active}</strong><span>activos</span></div></div>
      </header>

      {success && <p className="form-success">{success}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="inventory-top-grid">
        <form className="panel stack-md" onSubmit={handleItemSubmit}>
          <div className="panel-heading"><h2>{editingItemId !== null ? 'Editar item' : 'Nuevo item'}</h2>{editingItemId !== null && <button className="link-button" onClick={resetItemForm} type="button">Cancelar</button>}</div>
          <label><span>Nombre</span><input value={itemForm.nombre} onChange={(event) => setItemForm((prev) => ({ ...prev, nombre: event.target.value }))} /></label>
          <div className="field-row">
            <label><span>SKU</span><input value={itemForm.sku} onChange={(event) => setItemForm((prev) => ({ ...prev, sku: event.target.value.toUpperCase() }))} /></label>
            <label><span>Tipo</span><select value={itemForm.tipo} onChange={(event) => setItemForm((prev) => ({ ...prev, tipo: event.target.value as InventoryItemType }))}>{itemTypes.map((type) => <option key={type} value={type}>{itemTypeLabel(type)}</option>)}</select></label>
            <label><span>Estado</span><select value={itemForm.estado} onChange={(event) => setItemForm((prev) => ({ ...prev, estado: event.target.value as InventoryItemStatus }))}>{itemStatuses.map((status) => <option key={status} value={status}>{status === 'activo' ? 'Activo' : 'Inactivo'}</option>)}</select></label>
          </div>
          <label><span>Descripcion</span><textarea rows={3} value={itemForm.descripcion} onChange={(event) => setItemForm((prev) => ({ ...prev, descripcion: event.target.value }))} /></label>
          <div className="field-row">
            <label><span>Categoria</span><select value={itemForm.categoriaId} onChange={(event) => setItemForm((prev) => ({ ...prev, categoriaId: event.target.value }))}><option value="">Selecciona</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
            <label><span>Proveedor</span><select value={itemForm.proveedorId} onChange={(event) => setItemForm((prev) => ({ ...prev, proveedorId: event.target.value }))}><option value="">Sin proveedor</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.nombre}</option>)}</select></label>
            <label><span>Unidad de medida</span><input value={itemForm.unidadMedida} onChange={(event) => setItemForm((prev) => ({ ...prev, unidadMedida: event.target.value }))} /></label>
          </div>
          <div className="field-row">
            <label><span>Costo compra</span><input type="number" min="0" step="0.01" value={itemForm.costoCompra} onChange={(event) => setItemForm((prev) => ({ ...prev, costoCompra: event.target.value }))} /></label>
            <label><span>Precio venta</span><input type="number" min="0" step="0.01" value={itemForm.precioVenta} onChange={(event) => setItemForm((prev) => ({ ...prev, precioVenta: event.target.value }))} /></label>
            <label><span>Stock minimo</span><input type="number" min="0" step="0.001" value={itemForm.stockMinimo} onChange={(event) => setItemForm((prev) => ({ ...prev, stockMinimo: event.target.value }))} /></label>
          </div>
          <div className="field-row">
            <label><span>{editingItemId !== null ? 'Stock actual referencial' : 'Stock inicial'}</span><input disabled={editingItemId !== null} type="number" min="0" step="0.001" value={itemForm.stockInicial} onChange={(event) => setItemForm((prev) => ({ ...prev, stockInicial: event.target.value }))} /></label>
            <label className="checkbox-field"><input checked={itemForm.permiteStockNegativo} onChange={(event) => setItemForm((prev) => ({ ...prev, permiteStockNegativo: event.target.checked }))} type="checkbox" /><span>Permitir stock negativo</span></label>
          </div>
          <label><span>Imagen opcional</span><input accept="image/png,image/jpeg,image/webp" type="file" onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            try {
              const image = await fileToDataUrl(file)
              setItemForm((prev) => ({ ...prev, imagen: image }))
              setSelectedImageName(file.name)
              setImageError(null)
            } catch (reason) {
              setItemForm((prev) => ({ ...prev, imagen: undefined }))
              setSelectedImageName(null)
              setImageError(reason instanceof Error ? reason.message : 'No se pudo cargar la imagen')
            }
          }} /></label>
          {selectedImageName && !imageError && <p className="muted">Imagen preparada: {selectedImageName}</p>}
          {imageError && <p className="form-error">{imageError}</p>}
          <button className="primary-button" disabled={savingItem || Boolean(imageError)} type="submit">{savingItem ? 'Guardando...' : editingItemId !== null ? 'Actualizar item' : 'Crear item'}</button>
        </form>

        <form className="panel stack-md" onSubmit={handleCategorySubmit}>
          <div className="panel-heading"><h2>{editingCategoryId !== null ? 'Editar categoria' : 'Categorias'}</h2>{editingCategoryId !== null && <button className="link-button" onClick={() => { setEditingCategoryId(null); setCategoryForm(initialCategoryForm) }} type="button">Cancelar</button>}</div>
          <label><span>Nombre</span><input value={categoryForm.nombre} onChange={(event) => setCategoryForm((prev) => ({ ...prev, nombre: event.target.value }))} /></label>
          <label><span>Descripcion</span><textarea rows={3} value={categoryForm.descripcion} onChange={(event) => setCategoryForm((prev) => ({ ...prev, descripcion: event.target.value }))} /></label>
          <label><span>Estado</span><select value={categoryForm.estado} onChange={(event) => setCategoryForm((prev) => ({ ...prev, estado: event.target.value as 'activo' | 'inactivo' }))}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          <button className="primary-button" disabled={savingCategory} type="submit">{savingCategory ? 'Guardando...' : editingCategoryId !== null ? 'Actualizar categoria' : 'Crear categoria'}</button>
          <div className="inventory-category-list">
            {categories.map((category) => (
              <button className="inventory-category-item" key={category.id} onClick={() => { setEditingCategoryId(category.id); setCategoryForm({ nombre: category.nombre, descripcion: category.descripcion ?? '', estado: category.estado }) }} type="button">
                <strong>{category.nombre}</strong>
                <span className={`status-pill ${category.estado === 'activo' ? 'status-listo' : 'status-entregado'}`}>{category.estado}</span>
              </button>
            ))}
          </div>
        </form>
      </div>

      <section className="panel stack-md">
        <div className="panel-heading"><h2>Items de inventario</h2><button className="ghost-button" onClick={() => loadInventory()} type="button">Recargar</button></div>
        <div className="field-row inventory-filter-row">
          <label><span>Buscar</span><input placeholder="Nombre o SKU" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label><span>Categoria</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Todas</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
          <label><span>Tipo</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos</option>{itemTypes.map((type) => <option key={type} value={type}>{itemTypeLabel(type)}</option>)}</select></label>
          <label><span>Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos</option>{itemStatuses.map((status) => <option key={status} value={status}>{status === 'activo' ? 'Activo' : 'Inactivo'}</option>)}</select></label>
          <label className="checkbox-field inventory-lowstock-check"><input checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} type="checkbox" /><span>Solo stock bajo</span></label>
          <div className="toolbar-end"><button className="primary-button" onClick={() => loadInventory()} type="button">Filtrar</button></div>
        </div>
        {loading ? <p className="muted">Cargando inventario...</p> : items.length === 0 ? <div className="message-card"><strong>Sin items</strong><p className="muted">No hay resultados para los filtros actuales.</p></div> : (
          <div className="inventory-list">
            {items.map((item) => (
              <button className={`inventory-list-item${selectedItem?.id === item.id ? ' active' : ''}`} key={item.id} onClick={() => loadItemDetail(item.id)} type="button">
                <div className="inventory-list-item-head"><div><strong>{item.nombre}</strong><p className="muted">{item.sku} · {item.categoriaNombre ?? 'Sin categoria'}</p></div><span className={`status-pill ${item.estado === 'activo' ? 'status-listo' : 'status-entregado'}`}>{item.estado}</span></div>
                <div className="tag-row"><span>{itemTypeLabel(item.tipo)}</span><span>Stock: {item.stockActual} {item.unidadMedida}</span>{item.stockActual <= item.stockMinimo && <span className="inventory-warning-tag">Bajo minimo</span>}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="inventory-bottom-grid">
        <section className="panel stack-md">
          <div className="panel-heading"><h2>Detalle y movimientos</h2>{selectedItem && <button className="ghost-button" onClick={() => handleEditItem(selectedItem)} type="button">Editar item</button>}</div>
          {detailLoading ? <p className="muted">Cargando detalle...</p> : !selectedItem ? <p className="muted">Selecciona un item para ver su trazabilidad.</p> : (
            <div className="stack-md">
              <div className="inventory-detail-grid">
                <div className="inventory-detail-copy stack-sm">
                  <p className="repair-code">{selectedItem.sku}</p><h2>{selectedItem.nombre}</h2><p className="muted">{selectedItem.descripcion ?? 'Sin descripcion'}</p>
                  <div className="tag-row"><span>{selectedItem.categoriaNombre ?? 'Sin categoria'}</span><span>{itemTypeLabel(selectedItem.tipo)}</span><span>{selectedItem.proveedorNombre ?? 'Sin proveedor'}</span></div>
                  <div className="tag-row"><span>Stock actual: {selectedItem.stockActual} {selectedItem.unidadMedida}</span><span>Stock minimo: {selectedItem.stockMinimo} {selectedItem.unidadMedida}</span><span>{selectedItem.permiteStockNegativo ? 'Permite negativo' : 'Sin negativo'}</span></div>
                  <div className="tag-row"><span>Compra: {formatCurrency(selectedItem.costoCompra)}</span><span>Venta: {formatCurrency(selectedItem.precioVenta)}</span></div>
                </div>
                <div className="inventory-detail-media">{selectedItem.imagenUrl ? <img alt={selectedItem.nombre} src={resolveAssetUrl(selectedItem.imagenUrl) ?? undefined} /> : <span>Sin imagen</span>}</div>
              </div>

              <form className="stack-sm" onSubmit={handleMovementSubmit}>
                <div className="section-title">Registrar movimiento</div>
                <div className="field-row inventory-movement-row">
                  <label><span>Tipo</span><select value={movementForm.tipoMovimiento} onChange={(event) => setMovementForm((prev) => ({ ...prev, tipoMovimiento: event.target.value as InventoryMovementType }))}>{movementTypes.map((type) => <option key={type} value={type}>{movementLabel(type)}</option>)}</select></label>
                  {movementForm.tipoMovimiento === 'ajuste'
                    ? <label><span>Stock objetivo</span><input type="number" min="0" step="0.001" value={movementForm.stockObjetivo} onChange={(event) => setMovementForm((prev) => ({ ...prev, stockObjetivo: event.target.value }))} /></label>
                    : <label><span>Cantidad</span><input type="number" min="0.001" step="0.001" value={movementForm.cantidad} onChange={(event) => setMovementForm((prev) => ({ ...prev, cantidad: event.target.value }))} /></label>}
                  <label><span>Referencia</span><input value={movementForm.referencia} onChange={(event) => setMovementForm((prev) => ({ ...prev, referencia: event.target.value }))} /></label>
                </div>
                <label><span>Motivo</span><input value={movementForm.motivo} onChange={(event) => setMovementForm((prev) => ({ ...prev, motivo: event.target.value }))} /></label>
                <label><span>Observaciones</span><textarea rows={3} value={movementForm.observaciones} onChange={(event) => setMovementForm((prev) => ({ ...prev, observaciones: event.target.value }))} /></label>
                <button className="primary-button" disabled={savingMovement} type="submit">{savingMovement ? 'Registrando...' : 'Registrar movimiento'}</button>
              </form>
            </div>
          )}
        </section>

        <section className="panel stack-md">
          <div className="panel-heading"><h2>Historial de movimientos</h2><button className="ghost-button" onClick={() => loadMovements()} type="button">Recargar</button></div>
          <div className="field-row inventory-filter-row">
            <label><span>Buscar</span><input placeholder="Item, SKU o referencia" value={movementQuery} onChange={(event) => setMovementQuery(event.target.value)} /></label>
            <label><span>Tipo</span><select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value)}><option value="">Todos</option>{movementTypes.map((type) => <option key={type} value={type}>{movementLabel(type)}</option>)}</select></label>
            <label><span>Desde</span><input type="date" value={movementFrom} onChange={(event) => setMovementFrom(event.target.value)} /></label>
            <label><span>Hasta</span><input type="date" value={movementTo} onChange={(event) => setMovementTo(event.target.value)} /></label>
            <div className="toolbar-end"><button className="primary-button" onClick={() => loadMovements()} type="button">Filtrar</button></div>
          </div>
          <div className="timeline">
            {movements.length === 0 ? <p className="muted">No hay movimientos para los filtros actuales.</p> : movements.map((movement) => (
              <article className="timeline-item" key={movement.id}>
                <div className="timeline-item-head"><div><strong>{movement.itemNombre}</strong><p className="muted">{movement.itemSku} · {movementLabel(movement.tipoMovimiento)}</p></div><span className="muted">{formatDateTime(movement.createdAt)}</span></div>
                <div className="tag-row"><span>Cantidad: {movement.cantidad}</span><span>Antes: {movement.stockAntes}</span><span>Despues: {movement.stockDespues}</span></div>
                <p>{movement.motivo}</p>
                <p className="muted">{movement.referencia ?? 'Sin referencia'} · {movement.usuarioResponsable ?? 'Sistema'}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function itemTypeLabel(type: InventoryItemType) {
  return { repuesto: 'Repuesto', insumo: 'Insumo', accesorio: 'Accesorio', producto: 'Producto', otro: 'Otro' }[type] ?? type
}

function movementLabel(type: InventoryMovementType) {
  return { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', consumo_reparacion: 'Consumo reparacion', devolucion: 'Devolucion' }[type] ?? type
}
