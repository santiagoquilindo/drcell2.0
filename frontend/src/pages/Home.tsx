import React from 'react'
import { Header } from '@components/Header'
import { Footer } from '@components/Footer'
import { Modal } from '@components/Modal'
import { WhatsAppFloat } from '@components/WhatsAppFloat'
import { FloatingCart } from '@components/FloatingCart'
import { LOGOS_CREDITO } from '@modules/credits'
import { PRODUCTOS_BASE, type Producto, type CategoriaProducto } from '@modules/catalog'
import { REPARACIONES_BASE, RepairMediaItem } from '@modules/repairs'
import { ProductCard } from '@components/ProductCard'
import { useCart } from '@context/cart'
import { crearProducto, eliminarProducto, fetchProductos } from '@utils/api'
import { formatoCOP } from '@utils/money'
import { abrirWhatsApp, construirMensajeWhatsApp, msgCompraVenta } from '@utils/whatsapp'
import { Plus, Minus, X, Images, CreditCard, MapPin, Phone } from 'lucide-react'
import { ImageWithFallback } from '@components/ImageWithFallback'

const REPAIR_MEDIA_STORAGE_KEY = 'repair_media_dc2'

// Modales de cotización (ya creados)
import { RepairQuoteModal } from '@components/modals/RepairQuoteModal'
import { BuyQuoteModal } from '@components/modals/BuyQuoteModal'
import { CreditQuoteModal } from '@components/modals/CreditQuoteModal'

const CATS = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'nuevos', nombre: 'Nuevos' },
  { id: 'usados', nombre: 'Usados' },
  { id: 'accesorios', nombre: 'Accesorios' },
] as const

export const Home: React.FC = () => {
  const { state: carrito, dispatch, total } = useCart()
  const [showCart, setShowCart] = React.useState(false)

  // Modales base
  const [openUbicacion, setOpenUbicacion] = React.useState(false)
  const [openCredito, setOpenCredito] = React.useState(false) // logos/info
  const [openReparaciones, setOpenReparaciones] = React.useState(false) // galería local
  const [openTerminos, setOpenTerminos] = React.useState(false)
  const [openDatos, setOpenDatos] = React.useState(false)
  const [openCookies, setOpenCookies] = React.useState(false)
  const [openGarantias, setOpenGarantias] = React.useState(false)

  // Modales de cotización (solo flags)
  const [openCotizarRep, setOpenCotizarRep] = React.useState(false)
  const [openCotizarCompra, setOpenCotizarCompra] = React.useState(false)
  const [openCotizarCredito, setOpenCotizarCredito] = React.useState(false)

  // Catálogo administrable
  const [remoteProductos, setRemoteProductos] = React.useState<Producto[]>([])
  const productos = React.useMemo(() => {
    if (remoteProductos.length === 0) {
      return PRODUCTOS_BASE
    }
    const taken = new Set(remoteProductos.map((p) => p.nombre.trim().toLowerCase()))
    const baseExtras = PRODUCTOS_BASE.filter((base) => !taken.has(base.nombre.trim().toLowerCase()))
    return [...remoteProductos, ...baseExtras]
  }, [remoteProductos])
  const [productosLoading, setProductosLoading] = React.useState(true)
  const [productosError, setProductosError] = React.useState<string | null>(null)

  const [openNuevoProducto, setOpenNuevoProducto] = React.useState(false)
  const [productNombre, setProductNombre] = React.useState('')
  const [productDescripcion, setProductDescripcion] = React.useState('')
  const [productCategoria, setProductCategoria] = React.useState<CategoriaProducto>('nuevos')
  const [productPrecio, setProductPrecio] = React.useState('')
  const [productImagen, setProductImagen] = React.useState<string | undefined>(undefined)
  const [productImagenNombre, setProductImagenNombre] = React.useState<string | undefined>(undefined)
  const [productError, setProductError] = React.useState<string | null>(null)
  const [productSaving, setProductSaving] = React.useState(false)

  React.useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const data = await fetchProductos()
        if (!active) return
        setRemoteProductos(data)
        setProductosError(null)
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'No se pudo obtener el catálogo'
        setProductosError(message)
      } finally {
        if (!active) return
        setProductosLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  // Catálogo
  const PAGE_SIZE = 8
  const [categoria, setCategoria] = React.useState<typeof CATS[number]['id']>('todos')
  const [q, setQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const lower = (t: string) => t.toLowerCase()
  const filtrados = React.useMemo(() => {
    const query = lower(q)
    return productos.filter(
      (p) =>
        (categoria === 'todos' ? true : p.categoria === categoria) &&
        (query === '' || lower(`${p.nombre} ${p.descripcion ?? ''}`).includes(query)),
    )
  }, [categoria, q, productos])
  React.useEffect(() => setPage(1), [categoria, q])
  const pages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const pageSafe = Math.min(page, pages)
  const start = (pageSafe - 1) * PAGE_SIZE
  const visibles = React.useMemo(() => filtrados.slice(start, start + PAGE_SIZE), [filtrados, start])
  const go = (p: number) => setPage(Math.min(Math.max(1, p), pages))

  // Reparaciones: galería administrable
  const [localRepMedia, setLocalRepMedia] = React.useState<RepairMediaItem[]>([])
  const repMedia = React.useMemo(
    () => [...localRepMedia, ...REPARACIONES_BASE],
    [localRepMedia],
  )

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(REPAIR_MEDIA_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Array<Partial<RepairMediaItem>>
      const sanitized = parsed
        .filter(
          (item): item is RepairMediaItem =>
            typeof item?.id === 'string' &&
            typeof item?.src === 'string' &&
            typeof item?.tipo === 'string',
        )
        .map((item) => ({
          id: item.id,
          src: item.src,
          tipo: item.tipo,
          mime: item.mime,
          name: item.name,
          uploadedAt: item.uploadedAt,
          origin: 'local' as const,
        }))
      if (sanitized.length > 0) {
        setLocalRepMedia(sanitized)
      }
    } catch (error) {
      console.error('No se pudieron cargar los archivos de reparaciones guardados', error)
    }
  }, [])

  React.useEffect(() => {
    try {
      const toStore = localRepMedia.map(({ id, src, tipo, mime, name, uploadedAt }) => ({
        id,
        src,
        tipo,
        mime,
        name,
        uploadedAt,
      }))
      localStorage.setItem(REPAIR_MEDIA_STORAGE_KEY, JSON.stringify(toStore))
    } catch (error) {
      console.error('No se pudieron guardar los archivos de reparaciones', error)
    }
  }, [localRepMedia])

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    try {
      const processed = await Promise.all(
        files.map(async (file) => ({
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          tipo: file.type.startsWith('video') ? 'Video' : 'Foto',
          src: await readFileAsDataURL(file),
          mime: file.type,
          name: file.name,
          uploadedAt: Date.now(),
          origin: 'local' as const,
        })),
      )
      setLocalRepMedia((prev) => [...processed, ...prev])
    } catch (error) {
      console.error('Error al procesar archivos de reparaciones', error)
    } finally {
      event.target.value = ''
    }
  }

  const removeLocalMedia = (id: string) => {
    setLocalRepMedia((prev) => prev.filter((item) => item.id !== id))
  }

  const resetProductForm = () => {
    setProductNombre('')
    setProductDescripcion('')
    setProductCategoria('nuevos')
    setProductPrecio('')
    setProductImagen(undefined)
    setProductImagenNombre(undefined)
    setProductError(null)
  }

  const closeNuevoProducto = () => {
    setOpenNuevoProducto(false)
    setProductSaving(false)
    resetProductForm()
  }

  const onProductImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setProductImagen(undefined)
      setProductImagenNombre(undefined)
      return
    }
    if (!file.type.startsWith('image/')) {
      setProductError('El archivo debe ser una imagen (jpg, png, webp).')
      return
    }
    try {
      const dataUrl = await readFileAsDataURL(file)
      setProductImagen(dataUrl)
      setProductImagenNombre(file.name)
      setProductError(null)
    } catch (error) {
      console.error('No se pudo leer la imagen del producto', error)
      setProductError('No se pudo cargar la imagen. Intenta de nuevo.')
    } finally {
      event.target.value = ''
    }
  }

  
  const guardarNuevoProducto = async () => {
    const nombre = productNombre.trim()
    const descripcion = productDescripcion.trim()
    const precioNumber = Number.parseFloat(productPrecio)
    if (nombre === '') {
      setProductError('Ingresa un nombre para el producto.')
      return
    }
    if (!Number.isFinite(precioNumber) || precioNumber <= 0) {
      setProductError('Ingresa un precio valido mayor a cero.')
      return
    }

    setProductSaving(true)
    try {
      const nuevo = await crearProducto({
        nombre,
        descripcion,
        categoria: productCategoria,
        precio: precioNumber,
        imagenUrl: productImagen,
      })
      setRemoteProductos((prev) => [nuevo, ...prev])
      setProductosError(null)
      closeNuevoProducto()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el producto'
      setProductError(message)
    } finally {
      setProductSaving(false)
    }
  }

  const handleRemoveProducto = async (id: number) => {
    const snapshot = remoteProductos.slice()
    setRemoteProductos((prev) => prev.filter((item) => item.id !== id))
    try {
      await eliminarProducto(id)
      setProductosError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el producto'
      setProductosError(message)
      setRemoteProductos(snapshot)
    }
  }

  // Carrito
  const add = (p: Producto) =>
    dispatch({ type: 'add', item: { id: p.id, nombre: p.nombre, precio: p.precio } })
  const rm = (id: number) => dispatch({ type: 'rm', id })
  const qty = (id: number, delta: number) => dispatch({ type: 'qty', id, delta })

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Header onLocation={() => setOpenUbicacion(true)} onCart={() => setShowCart(true)} />

      {/* Banner superior */}
      <div className="bg-green-500 text-white py-3">
        <div className="container mx-auto px-4 flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
          <button onClick={() => setOpenUbicacion(true)} className="flex items-center gap-2 hover:underline">
            <MapPin size={16} /> Local 4 – Calle 5A con Carrera 14, El Bostezo, Popayán
          </button>
          <a href="tel:+573122650861" className="flex items-center gap-2 hover:underline">
            <Phone size={16} /> 312 265 0861
          </a>
          <button onClick={() => setOpenCredito(true)} className="flex items-center gap-2 hover:underline">
            <CreditCard size={16} /> Crédito con Addi, Sistecrédito y Cupo Brilla
          </button>
          <button onClick={() => setOpenReparaciones(true)} className="flex items-center gap-2 hover:underline">
            <Images size={16} /> Reparaciones realizadas
          </button>
        </div>
      </div>

      <WhatsAppFloat />
      <FloatingCart onClick={() => setShowCart(true)} />

      <main className="container mx-auto px-4 py-8">
        {/* Servicios */}
        <section className="bg-white border border-green-300 rounded-2xl shadow-lg shadow-green-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-green-700 mb-4">Nuestros Servicios</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Reparaciones */}
            <div className="bg-white border border-green-300 p-4 rounded-xl hover:border-green-500 transition-colors">
              <img src="/reparacion.png" alt="Reparaciones" className="mb-3 h-32 w-full object-cover rounded-xl" loading="lazy" />
              <h3 className="font-bold text-green-700">Reparaciones</h3>
              <p className="text-sm text-gray-600">Expertos en todo tipo de reparaciones</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button onClick={() => setOpenCotizarRep(true)} className="w-full text-white bg-green-600 rounded-lg py-2 font-semibold hover:bg-green-700">
                  Cotizar por WhatsApp
                </button>
                <button onClick={() => setOpenReparaciones(true)} className="w-full text-green-700 border border-green-300 rounded-lg py-2 font-semibold hover:border-green-500">
                  Ver galería de trabajos
                </button>
              </div>
            </div>

            {/* Compra y Venta */}
            <div className="bg-white border border-green-300 p-4 rounded-xl hover:border-green-500 transition-colors">
              <img src="/logodrcell.png" alt="Compra y Venta" className="mb-3 h-32 w-full object-cover rounded-xl" loading="lazy" />
              <h3 className="font-bold text-green-700">Compra y Venta</h3>
              <p className="text-sm text-gray-600">Celulares nuevos y usados</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button onClick={() => setOpenCotizarCompra(true)} className="w-full text-white bg-green-600 rounded-lg py-2 font-semibold hover:bg-green-700">
                  Cotizar por WhatsApp
                </button>
                <button onClick={() => abrirWhatsApp(msgCompraVenta())} className="w-full text-green-700 border border-green-300 rounded-lg py-2 font-semibold hover:border-green-500">
                  Mensaje rápido
                </button>
              </div>
            </div>

            {/* Crédito Fácil */}
            <div className="bg-white border border-green-300 p-4 rounded-xl hover:border-green-500 transition-colors">
              <img src="/credito.png" alt="Crédito Fácil" className="mb-3 h-32 w-full object-cover rounded-xl" loading="lazy" />
              <h3 className="font-bold text-green-700">Crédito Fácil</h3>
              <p className="text-sm text-gray-600 mb-3">Financiación a tu medida</p>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => setOpenCotizarCredito(true)} className="w-full text-white bg-green-600 rounded-lg py-2 font-semibold hover:bg-green-700">
                  Cotizar por WhatsApp
                </button>
                <button onClick={() => setOpenCredito(true)} className="w-full text-green-700 border border-green-300 rounded-lg py-2 font-semibold hover:border-green-500">
                  Ver entidades
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Filtros / búsqueda */}
        <section className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {CATS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoria(c.id)}
                  className={`rounded-full px-4 py-2 border transition-colors text-sm ${
                    categoria === c.id
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-green-700 border-green-300 hover:border-green-500'
                  }`}
                  aria-pressed={categoria === c.id}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:items-center md:justify-end">
              <button
                onClick={() => setOpenNuevoProducto(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-300 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                <Plus size={16} /> Agregar producto
              </button>
              <div className="relative w-full sm:w-64 md:w-80">
                <input
                  type="search"
                  placeholder="Buscar producto (nombre o descripci?n)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full rounded-lg bg-white border border-gray-300 focus:border-green-600 outline-none px-4 py-2 text-neutral-800 placeholder:text-gray-400"
                  aria-label="Buscar producto"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"></span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-700">
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}{q && ` para "${q}"`}
            {categoria !== 'todos' && ` en ${categoria}`}
          </p>
          {productosLoading && (
            <p className="mt-2 text-sm text-gray-500">Cargando catalogo...</p>
          )}
          {productosError && (
            <p className="mt-2 text-sm text-red-500">{productosError}</p>
          )}
        </section>

        {/* Catálogo */}
        <section>
          <h2 className="text-3xl font-bold text-green-700 mb-6">Catálogo de Productos</h2>
          {visibles.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-600">
              No hay productos que coincidan con tu búsqueda.
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {visibles.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    onAdd={add}
                    onRemove={p.origin === 'remote' ? handleRemoveProducto : undefined}
                  />
                ))}
              </div>

              {pages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Paginación del catálogo">
                  <button onClick={() => go(page - 1)} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:border-green-600" disabled={page === 1}>
                    Anterior
                  </button>
                  {Array.from({ length: pages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => go(i + 1)}
                      aria-current={i + 1 === page ? 'page' : undefined}
                      className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-colors ${
                        i + 1 === page ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-300 hover:border-green-600'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button onClick={() => go(page + 1)} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:border-green-600" disabled={page === pages}>
                    Siguiente
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </main>

      {/* Carrito lateral */}
      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowCart(false)}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l-2 border-green-300 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-green-700">Tu Carrito</h2>
                <button onClick={() => setShowCart(false)} className="text-green-700 hover:text-green-600">
                  <X size={24} />
                </button>
              </div>

              {carrito.length === 0 ? (
                <div className="text-center py-12 text-gray-600">Tu carrito está vacío</div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {carrito.map((item) => (
                      <div key={item.id} className="bg-white border border-green-300 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-green-700">{item.nombre}</h3>
                            <p className="text-sm text-gray-600">{formatoCOP(item.precio)}</p>
                          </div>
                          <button onClick={() => rm(item.id)} className="text-red-500 hover:text-red-600">
                            <X size={20} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button onClick={() => qty(item.id, -1)} className="bg-gray-100 border border-green-300 rounded-full p-1 hover:border-green-600">
                              <Minus size={16} className="text-green-700" />
                            </button>
                            <span className="font-semibold text-green-700 w-8 text-center">{item.cantidad}</span>
                            <button onClick={() => qty(item.id, 1)} className="bg-gray-100 border border-green-300 rounded-full p-1 hover:border-green-600">
                              <Plus size={16} className="text-green-700" />
                            </button>
                          </div>
                          <p className="font-bold text-green-700">{formatoCOP(item.precio * item.cantidad)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-green-300 pt-4 mb-4">
                    <div className="flex items-center justify-between text-xl font-bold">
                      <span className="text-green-700">Total:</span>
                      <span className="text-green-700">{formatoCOP(total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const message = construirMensajeWhatsApp(
                        carrito.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })),
                      )
                      abrirWhatsApp(message)
                    }}
                    className={`w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-200 ${
                      carrito.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    aria-label="Finalizar pedido por WhatsApp"
                    disabled={carrito.length === 0}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.52 3.48A11.94 11.94 0 0 0 12.01 0C5.39 0 .01 5.38.01 12c0 2.11.55 4.17 1.59 5.99L0 24l6.18-1.62A11.96 11.96 0 0 0 12 24h.01c6.62 0 11.99-5.38 11.99-12 0-3.2-1.25-6.2-3.48-8.52ZM12 21.82h-.01a9.83 9.83 0 0 1-5-1.37l-.36-.21-3.67.97.98-3.58-.24-.37A9.82 9.82 0 0 1 2.19 12C2.2 6.86 6.86 2.2 12.01 2.2c2.62 0 5.08 1.02 6.93 2.88A9.77 9.77 0 0 1 21.81 12c0 5.14-4.66 9.82-9.81 9.82Zm5.61-7.35c-.31-.16-1.82-.9-2.1-1-.28-.1-.48-.16-.68.16-.2.31-.78 1-.96 1.2-.18.21-.35.23-.66.08-.31-.16-1.29-.48-2.46-1.53-.91-.8-1.52-1.8-1.7-2.1-.18-.31-.02-.48.14-.64.14-.14.31-.35.47-.53.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.68-1.64-.94-2.25-.25-.6-.5-.52-.68-.53h-.58c-.2 0-.52.07-.79.39-.27.31-1.04 1.01-1.04 2.46s1.06 2.85 1.21 3.05c.16.21 2.09 3.2 5.06 4.49.71.31 1.27.49 1.71.63.72.23 1.38.2 1.9.12.58-.09 1.82-.74 2.08-1.45.26-.7.26-1.3.18-1.44-.08-.14-.28-.22-.58-.38Z" />
                    </svg>
                    <span>Finalizar por WhatsApp</span>
                  </button>

                  <p className="text-xs text-center text-gray-600 mt-3">
                    Te contactaremos para confirmar disponibilidad y opciones de pago
                  </p>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      <Footer
        onOpenTerminos={() => setOpenTerminos(true)}
        onOpenDatos={() => setOpenDatos(true)}
        onOpenCookies={() => setOpenCookies(true)}
        onOpenGarantias={() => setOpenGarantias(true)}
        onLocation={() => setOpenUbicacion(true)}
      />

      {/* Modales base */}
      <Modal open={openUbicacion} onClose={() => setOpenUbicacion(false)} title="Ubicación – Local 4 (Doctor Cell 2.0)">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=1600&auto=format&fit=crop"
          alt="Foto del local"
          className="h-80 rounded-lg border border-green-200"
        />
        <p className="mt-3 text-sm text-gray-700">Calle 5A con Carrera 14, Local 4, sector El Bostezo – Popayán</p>
      </Modal>

      <Modal open={openCredito} onClose={() => setOpenCredito(false)} title="Opciones de crédito">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LOGOS_CREDITO.map((l) => (
            <div key={l.id} className="bg-green-50 rounded-xl p-3 border border-green-200 flex items-center justify-center">
              <img src={l.url} alt={l.nombre} className="max-h-20 object-contain" />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">Crédito sujeto a aprobación de la entidad aliada.</p>
      </Modal>

      <Modal open={openNuevoProducto} onClose={closeNuevoProducto} title="Agregar producto al catálogo">
        <div className="space-y-3">
          {productError && <p className="text-sm text-red-500">{productError}</p>}

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Nombre</span>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-green-600 outline-none"
              placeholder="Ej: Moto G 5G, iPhone 11..."
              value={productNombre}
              onChange={(e) => {
                setProductNombre(e.target.value)
                setProductError(null)
              }}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block mb-1 text-gray-700">Categoría</span>
              <select
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={productCategoria}
                onChange={(e) => {
                  setProductCategoria(e.target.value as CategoriaProducto)
                  setProductError(null)
                }}
              >
                {CATS.filter((c) => c.id !== 'todos').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block mb-1 text-gray-700">Precio (COP)</span>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Ej: 1250000"
                value={productPrecio}
                onChange={(e) => {
                  setProductPrecio(e.target.value)
                  setProductError(null)
                }}
              />
            </label>
          </div>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Descripción</span>
            <textarea
              className="w-full rounded border border-gray-300 px-3 py-2"
              rows={3}
              placeholder="Capacidad, estado, accesorios incluidos..."
              value={productDescripcion}
              onChange={(e) => {
                setProductDescripcion(e.target.value)
                setProductError(null)
              }}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Imagen (opcional)</span>
            <input type="file" accept="image/*" onChange={onProductImageChange} />
            {productImagen && (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={productImagen}
                  alt={productNombre || 'Nuevo producto'}
                  className="h-20 w-20 rounded-lg border border-green-200 object-cover"
                />
                <div className="text-xs text-gray-600">
                  <p>{productImagenNombre}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setProductImagen(undefined)
                      setProductImagenNombre(undefined)
                      setProductError(null)
                    }}
                    className="mt-1 text-red-500 hover:text-red-600 font-semibold"
                  >
                    Quitar imagen
                  </button>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              La imagen se enviará al servidor codificada en base64.
            </p>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={closeNuevoProducto} className="rounded-lg border px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={guardarNuevoProducto}
            disabled={productSaving}
            className={`rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 ${
              productSaving ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {productSaving ? 'Guardando...' : 'Guardar producto'}
          </button>
        </div>
      </Modal>

      <Modal open={openReparaciones} onClose={() => setOpenReparaciones(false)} title="Galería de reparaciones">
        <div className="mb-4 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg cursor-pointer font-semibold hover:bg-green-700">
            Subir fotos/videos
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onUpload} />
          </label>
          <p className="text-xs text-gray-600">
            Formatos: JPG/PNG/MP4. Se guardan en este navegador para que el administrador los gestione; no se suben al servidor.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {repMedia.map((m) => {
            const isVideo = (m.mime ?? '').startsWith('video') || m.src.startsWith('data:video')
            return (
              <div key={m.id} className="relative bg-gray-50 rounded-xl p-2 border border-gray-200">
                {isVideo ? (
                  <video src={m.src} controls className="w-full h-40 object-cover rounded-lg" />
                ) : (
                  <img src={m.src} alt={m.tipo} className="w-full h-40 object-cover rounded-lg" />
                )}
                <div className="mt-2">
                  <p className="text-xs font-semibold text-gray-700 truncate">{m.tipo}</p>
                  {m.name && <p className="text-[11px] text-gray-500 truncate">{m.name}</p>}
                  {m.origin === 'local' && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Subido por administrador</span>
                      <button
                        onClick={() => removeLocalMedia(m.id)}
                        className="text-red-500 hover:text-red-600 font-semibold"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* Modales de cotización */}
      <RepairQuoteModal open={openCotizarRep} onClose={() => setOpenCotizarRep(false)} />
      <BuyQuoteModal open={openCotizarCompra} onClose={() => setOpenCotizarCompra(false)} />
      <CreditQuoteModal open={openCotizarCredito} onClose={() => setOpenCotizarCredito(false)} />
    </div>
  )
}
