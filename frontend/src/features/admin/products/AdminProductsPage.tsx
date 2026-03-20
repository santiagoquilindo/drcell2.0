import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@features/admin/auth/AuthContext'
import { ApiError } from '@shared/api/client'
import { fetchInventoryItems } from '@shared/api/inventory'
import { createProduct, deleteProduct, fetchProducts, updateProduct } from '@shared/api/products'
import { formatCurrency } from '@shared/lib/currency'
import { fileToDataUrl } from '@shared/lib/image'
import type { InventoryItem } from '@shared/types/inventory'
import type { Product, ProductCategory, ProductPayload } from '@shared/types/product'

const initialForm = {
  nombre: '',
  descripcion: '',
  categoria: 'nuevos' as ProductCategory,
  precio: '',
  stock: '0',
  inventarioItemId: '',
  activo: true,
  imagen: undefined as string | undefined,
}

type StockModeFilter = 'all' | 'linked' | 'manual'

export function AdminProductsPage() {
  const navigate = useNavigate()
  const { logoutAction } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [stockModeFilter, setStockModeFilter] = useState<StockModeFilter>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(initialForm)
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [confirmLegacyStock, setConfirmLegacyStock] = useState(false)

  const isEditing = editingId !== null
  const selectedInventoryItem = form.inventarioItemId
    ? inventoryItems.find((item) => item.id === Number(form.inventarioItemId)) ?? null
    : null

  const handleSessionError = async (reason: unknown) => {
    if (reason instanceof ApiError && reason.status === 401) {
      await logoutAction()
      navigate('/admin/login', { replace: true })
      return true
    }

    return false
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      const [productList, inventoryList] = await Promise.all([fetchProducts(true), fetchInventoryItems({ estado: 'activo' })])
      setProducts(productList)
      setInventoryItems(inventoryList)
      setError(null)
    } catch (loadError) {
      if (await handleSessionError(loadError)) return
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts().catch(() => {})
  }, [])

  const summary = useMemo(
    () => ({
      total: products.length,
      active: products.filter((product) => product.activo).length,
      linked: products.filter((product) => product.inventarioItemId !== null).length,
      manual: products.filter((product) => product.inventarioItemId === null).length,
      units: products.reduce((acc, product) => acc + product.stock, 0),
    }),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        `${product.nombre} ${product.descripcion} ${product.categoria} ${product.slug} ${product.inventarioItemNombre ?? ''}`
          .toLowerCase()
          .includes(normalizedQuery)

      const matchesStockMode =
        stockModeFilter === 'all' ||
        (stockModeFilter === 'linked' && product.inventarioItemId !== null) ||
        (stockModeFilter === 'manual' && product.inventarioItemId === null)

      return matchesQuery && matchesStockMode
    })
  }, [products, query, stockModeFilter])

  const resetForm = () => {
    setEditingId(null)
    setForm(initialForm)
    setSelectedImageName(null)
    setImageError(null)
    setConfirmLegacyStock(false)
  }

  const handleStartMigration = (product: Product) => {
    handleEdit(product)
    setStockModeFilter('manual')
  }

  const buildPayload = (): ProductPayload => {
    if (!form.nombre.trim() || !form.descripcion.trim()) {
      throw new Error('Nombre y descripcion son obligatorios.')
    }

    const precio = Number(form.precio)
    const stock = Number(form.stock)
    const inventarioItemId = form.inventarioItemId ? Number(form.inventarioItemId) : null

    if (!Number.isFinite(precio) || precio <= 0) {
      throw new Error('El precio debe ser mayor a cero.')
    }

    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error('El stock debe ser un entero mayor o igual a cero.')
    }

    if (inventarioItemId !== null && (!Number.isInteger(inventarioItemId) || inventarioItemId <= 0)) {
      throw new Error('El item de inventario vinculado no es valido.')
    }

    if (inventarioItemId === null && !confirmLegacyStock) {
      throw new Error('Confirma que este producto seguira usando stock manual legacy o vincula un item de inventario.')
    }

    if (imageError) {
      throw new Error(imageError)
    }

    return {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      categoria: form.categoria,
      precio,
      stock: inventarioItemId ? 0 : stock,
      inventarioItemId,
      activo: form.activo,
      imagen: form.imagen,
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const payload = buildPayload()
      setSaving(true)
      setError(null)
      setSuccess(null)

      if (editingId === null) {
        await createProduct(payload)
        setSuccess('Producto creado correctamente.')
      } else {
        await updateProduct(editingId, payload)
        setSuccess('Producto actualizado correctamente.')
      }

      await loadProducts()
      resetForm()
    } catch (submitError) {
      if (await handleSessionError(submitError)) return
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar el producto')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (product: Product) => {
    setEditingId(product.id)
    setSuccess(null)
    setImageError(null)
    setSelectedImageName(product.imagenUrl ? 'Imagen actual del producto' : null)
    setConfirmLegacyStock(product.inventarioItemId === null)
    setForm({
      nombre: product.nombre,
      descripcion: product.descripcion,
      categoria: product.categoria,
      precio: String(product.precio),
      stock: String(product.inventarioItemId ? product.stockManual : product.stock),
      inventarioItemId: product.inventarioItemId ? String(product.inventarioItemId) : '',
      activo: product.activo,
      imagen: undefined,
    })
  }

  const handleDelete = async (productId: number) => {
    if (!window.confirm('Esta accion eliminara el producto.')) return

    try {
      setSuccess(null)
      await deleteProduct(productId)
      setSuccess('Producto eliminado correctamente.')
      await loadProducts()
    } catch (deleteError) {
      if (await handleSessionError(deleteError)) return
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el producto')
    }
  }

  return (
    <section className="stack-lg">
      <header className="page-header">
        <div>
          <p className="eyebrow">Catalogo admin</p>
          <h1>Gestion de productos</h1>
          <p className="muted">Actualiza precios, stock, visibilidad e imagenes con una vista mas legible para operacion diaria.</p>
        </div>

        <div className="stats-inline">
          <div>
            <strong>{summary.total}</strong>
            <span>registros</span>
          </div>
          <div>
            <strong>{summary.active}</strong>
            <span>visibles</span>
          </div>
          <div>
            <strong>{summary.linked}</strong>
            <span>vinculados</span>
          </div>
          <div>
            <strong>{summary.manual}</strong>
            <span>manual legacy</span>
          </div>
          <div>
            <strong>{summary.units}</strong>
            <span>unidades</span>
          </div>
        </div>
      </header>

      <div className="admin-grid">
        <form className="panel stack-md" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <h2>{isEditing ? 'Editar producto' : 'Nuevo producto'}</h2>
            {isEditing && (
              <button className="link-button" onClick={resetForm} type="button">
                Cancelar
              </button>
            )}
          </div>

          <div className="product-migration-banner">
            <strong>Camino recomendado</strong>
            <p>Para productos inventariables nuevos, primero crea o identifica el item operativo y luego vinculalo aqui. El stock comercial correcto sale desde inventario.</p>
          </div>

          <label>
            <span>Nombre comercial</span>
            <input value={form.nombre} onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))} />
          </label>

          <label>
            <span>Descripcion</span>
            <textarea rows={4} value={form.descripcion} onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))} />
          </label>

          <div className="field-row">
            <label>
              <span>Categoria</span>
              <select value={form.categoria} onChange={(event) => setForm((prev) => ({ ...prev, categoria: event.target.value as ProductCategory }))}>
                <option value="nuevos">Nuevos</option>
                <option value="usados">Usados</option>
                <option value="accesorios">Accesorios</option>
              </select>
            </label>

            <label>
              <span>Precio</span>
              <input type="number" min="1" value={form.precio} onChange={(event) => setForm((prev) => ({ ...prev, precio: event.target.value }))} />
            </label>

            <label>
              <span>Item de inventario vinculado</span>
              <select value={form.inventarioItemId} onChange={(event) => setForm((prev) => ({ ...prev, inventarioItemId: event.target.value }))}>
                <option value="">Sin vincular</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} - {item.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{form.inventarioItemId ? 'Stock manual legacy (se ignora al vincular)' : 'Stock manual'}</span>
              <input
                type="number"
                min="0"
                disabled={Boolean(form.inventarioItemId)}
                value={form.stock}
                onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
              />
            </label>
          </div>

          {form.inventarioItemId && <p className="muted">Cuando el producto esta vinculado, el stock visible del catalogo se toma desde inventario.</p>}
          {!form.inventarioItemId && (
            <div className="product-stock-mode-card product-stock-mode-card-warning">
              <strong>Modo manual legacy</strong>
              <p>Este producto no quedara sincronizado con inventario. Usalo solo si todavia no existe un item operativo equivalente.</p>
            </div>
          )}

          {form.inventarioItemId && (
            <div className="product-stock-mode-card product-stock-mode-card-linked">
              <strong>Modo vinculado a inventario</strong>
              <p>El stock visible del catalogo y del panel de productos se toma desde el item de inventario seleccionado.</p>
            </div>
          )}

          {selectedInventoryItem && (
            <div className="product-link-context">
              <strong>Item vinculado listo para usar</strong>
              <div className="tag-row">
                <span>SKU: {selectedInventoryItem.sku}</span>
                <span>{selectedInventoryItem.nombre}</span>
                <span>Tipo: {selectedInventoryItem.tipo}</span>
                <span>Stock actual: {selectedInventoryItem.stockActual}</span>
              </div>
            </div>
          )}

          {!form.inventarioItemId && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={confirmLegacyStock}
                onChange={(event) => setConfirmLegacyStock(event.target.checked)}
              />
              <span>Confirmo que este producto seguira usando stock manual legacy temporalmente.</span>
            </label>
          )}

          <label className="checkbox-field">
            <input type="checkbox" checked={form.activo} onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.checked }))} />
            <span>Visible en el catalogo publico</span>
          </label>

          <label>
            <span>Imagen</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return

                try {
                  const image = await fileToDataUrl(file)
                  setForm((prev) => ({ ...prev, imagen: image }))
                  setSelectedImageName(file.name)
                  setImageError(null)
                  setError(null)
                  setSuccess('Imagen lista para guardarse con el producto.')
                } catch (fileError) {
                  setForm((prev) => ({ ...prev, imagen: undefined }))
                  setSelectedImageName(null)
                  setImageError(fileError instanceof Error ? fileError.message : 'No se pudo cargar la imagen')
                  setSuccess(null)
                  setError(fileError instanceof Error ? fileError.message : 'No se pudo cargar la imagen')
                }
              }}
            />
          </label>

          {selectedImageName && !imageError && <p className="muted">Imagen preparada: {selectedImageName}</p>}
          {imageError && <p className="form-error">{imageError}</p>}

          {success && <p className="form-success">{success}</p>}
          {error && error !== imageError && <p className="form-error">{error}</p>}

          <button className="primary-button" disabled={saving || Boolean(imageError)} type="submit">
            {saving ? 'Guardando...' : isEditing ? 'Actualizar producto' : 'Crear producto'}
          </button>
        </form>

        <div className="panel stack-md">
          <div className="panel-heading">
            <h2>Listado</h2>
            <div className="button-row">
              <input className="compact-input" placeholder="Buscar producto..." value={query} onChange={(event) => setQuery(event.target.value)} />
              <select value={stockModeFilter} onChange={(event) => setStockModeFilter(event.target.value as StockModeFilter)}>
                <option value="all">Todos</option>
                <option value="linked">Vinculados</option>
                <option value="manual">Manual legacy</option>
              </select>
              <button className="ghost-button" onClick={() => loadProducts()} type="button">
                Recargar
              </button>
            </div>
          </div>

          {summary.manual > 0 && (
            <div className="product-migration-banner product-migration-banner-warning">
              <strong>{summary.manual} productos siguen en stock manual legacy</strong>
              <p>Usa el filtro de pendientes o el boton "Vincular inventario" para migrar primero los productos importantes del catalogo.</p>
            </div>
          )}

          <div className="product-admin-legend">
            <span className="product-stock-badge product-stock-badge-linked">Vinculado a inventario</span>
            <span className="product-stock-badge product-stock-badge-manual">Stock manual legacy</span>
          </div>

          {loading ? (
            <p className="muted">Cargando productos...</p>
          ) : filteredProducts.length === 0 ? (
            <div className="message-card">
              <strong>Sin resultados</strong>
              <p className="muted">No hay productos que coincidan con la busqueda actual.</p>
            </div>
          ) : (
            <div className="admin-products-list">
              {filteredProducts.map((product) => (
                <article className="admin-product-item" key={product.id}>
                  <div className="admin-product-main">
                    <div className="admin-item-head">
                      <p className="admin-product-title">{product.nombre}</p>
                      <span className={`status-pill ${product.activo ? 'status-listo' : 'status-entregado'}`}>{product.activo ? 'Visible' : 'Oculto'}</span>
                    </div>
                    <p className="muted">{product.descripcion}</p>
                    <div className="button-row">
                      <span className={`product-stock-badge ${product.inventarioItemId ? 'product-stock-badge-linked' : 'product-stock-badge-manual'}`}>
                        {product.inventarioItemId ? 'Stock desde inventario' : 'Stock manual legacy'}
                      </span>
                    </div>
                    <div className="tag-row">
                      <span>{product.categoria}</span>
                      <span>Stock: {product.stock}</span>
                      <span>{product.inventarioItemId ? `Vinculado: ${product.inventarioItemNombre ?? product.inventarioItemId}` : 'Stock manual'}</span>
                      <span>{product.slug}</span>
                    </div>
                  </div>

                  <div className="admin-product-side">
                    <strong>{formatCurrency(product.precio)}</strong>
                    <div className="button-row">
                      {!product.inventarioItemId && (
                        <button className="ghost-button" onClick={() => handleStartMigration(product)} type="button">
                          Vincular inventario
                        </button>
                      )}
                      <button className="ghost-button" onClick={() => handleEdit(product)} type="button">
                        Editar
                      </button>
                      <button className="danger-button" onClick={() => handleDelete(product.id)} type="button">
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
