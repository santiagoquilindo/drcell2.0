import React from 'react'
import { Header } from '@components/Header'
import { Footer } from '@components/Footer'
import { Modal } from '@components/Modal'
import { WhatsAppFloat } from '@components/WhatsAppFloat'
import { LOGOS_CREDITO } from '@modules/credits'
import { PRODUCTOS_BASE, type Producto, type CategoriaProducto } from '@modules/catalog'
import { REPARACIONES_BASE, RepairMediaItem } from '@modules/repairs'
import {
  INVENTORY_SAMPLE_CATEGORIES,
  type InventoryAlert,
  type InventoryFilter,
  type InventoryItem,
  type InventoryProvider,
} from '@modules/inventory'
import { ProductCard } from '@components/ProductCard'
import { useCart } from '@context/cart'
import {
  clearAdminToken as clearApiAdminToken,
  crearProducto,
  createInventoryItem,
  createProvider,
  eliminarProducto,
  deleteInventoryItem,
  fetchInventory,
  fetchInventoryAlerts,
  fetchProductos,
  fetchProviders,
  setAdminToken as setApiAdminToken,
  updateInventoryItem,
} from '@utils/api'
import { formatoCOP } from '@utils/money'
import { abrirWhatsApp, construirMensajeWhatsApp, msgCompraVenta } from '@utils/whatsapp'
import {
  AlertTriangle,
  BellRing,
  CreditCard,
  Factory,
  Images,
  MapPin,
  Minus,
  PackagePlus,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { ImageWithFallback } from '@components/ImageWithFallback'

const REPAIR_MEDIA_STORAGE_KEY = 'repair_media_dc2'
const ADMIN_STORAGE_KEY = 'dc_admin_token'

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

const INVENTORY_FILTER_TABS: InventoryFilter[] = ['todos', 'ok', 'bajo']

const createInventoryFormState = () => ({
  nombre: '',
  categoria: '',
  proveedorId: '',
  stockActual: '0',
  stockMinimo: '0',
  precioCompra: '0',
  precioVenta: '0',
  descripcion: '',
})

const createProviderFormState = () => ({
  nombre: '',
  contacto: '',
  telefono: '',
  email: '',
  notas: '',
})

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

  const [adminToken, setAdminTokenState] = React.useState<string | null>(null)
  const isAdmin = Boolean(adminToken)
  const [openAdminModal, setOpenAdminModal] = React.useState(false)
  const [adminKeyInput, setAdminKeyInput] = React.useState('')
  const [adminError, setAdminError] = React.useState<string | null>(null)

  const [inventoryItems, setInventoryItems] = React.useState<InventoryItem[]>([])
  const [inventoryAlerts, setInventoryAlerts] = React.useState<InventoryAlert[]>([])
  const [inventoryProviders, setInventoryProviders] = React.useState<InventoryProvider[]>([])
  const [inventoryLoading, setInventoryLoading] = React.useState(false)
  const [inventoryError, setInventoryError] = React.useState<string | null>(null)
  const [inventoryFilter, setInventoryFilter] = React.useState<InventoryFilter>('todos')
  const [inventorySearchInput, setInventorySearchInput] = React.useState('')
  const [appliedInventorySearch, setAppliedInventorySearch] = React.useState('')
  const [inventoryModalOpen, setInventoryModalOpen] = React.useState(false)
  const [providerModalOpen, setProviderModalOpen] = React.useState(false)
  const [inventorySaving, setInventorySaving] = React.useState(false)
  const [providerSaving, setProviderSaving] = React.useState(false)
  const [inventoryFormError, setInventoryFormError] = React.useState<string | null>(null)
  const [providerFormError, setProviderFormError] = React.useState<string | null>(null)
  const [editingInventoryId, setEditingInventoryId] = React.useState<number | null>(null)
  const [inventoryForm, setInventoryForm] = React.useState(createInventoryFormState)
  const [providerForm, setProviderForm] = React.useState(createProviderFormState)

  React.useEffect(() => {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (stored) {
      setAdminTokenState(stored)
      setApiAdminToken(stored)
    }
  }, [])

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
        const message = error instanceof Error ? error.message : 'No se pudo obtener el catalogo'
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

  const closeAdminModal = () => {
    setOpenAdminModal(false)
    setAdminError(null)
    setAdminKeyInput('')
  }

  const handleAdminLogin = () => {
    const value = adminKeyInput.trim()
    if (value === '') {
      setAdminError('Ingresa la clave de administrador.')
      return
    }
    setApiAdminToken(value)
    setAdminTokenState(value)
    localStorage.setItem(ADMIN_STORAGE_KEY, value)
    setAdminError(null)
    setOpenAdminModal(false)
    setAdminKeyInput('')
  }

  const handleAdminLogout = React.useCallback(() => {
    clearApiAdminToken()
    setAdminTokenState(null)
    localStorage.removeItem(ADMIN_STORAGE_KEY)
    setAdminError(null)
    setAdminKeyInput('')
    setProductError(null)
    setProductosError(null)
    setInventoryModalOpen(false)
    setProviderModalOpen(false)
    setInventoryForm(createInventoryFormState())
    setProviderForm(createProviderFormState())
    setInventoryFormError(null)
    setProviderFormError(null)
    setEditingInventoryId(null)
    setInventorySearchInput('')
    setAppliedInventorySearch('')
    setInventoryFilter('todos')
  }, [])

  const handleAdminAccess = React.useCallback(() => {
    if (isAdmin) {
      handleAdminLogout()
    } else {
      setOpenAdminModal(true)
    }
  }, [isAdmin, handleAdminLogout])

  const handleProtectedActionError = React.useCallback(
    (message: string) => {
      const normalized = message.toLowerCase()
      if (normalized.includes('no autorizado') || normalized.includes('restringido')) {
        handleAdminLogout()
        setAdminError('Clave incorrecta o expirada. Ingresa nuevamente.')
        setOpenAdminModal(true)
      }
    },
    [handleAdminLogout],
  )

  const [activeCard, setActiveCard] = React.useState<number | null>(null)

  const serviceCards = [
    {
      id: 'reparaciones',
      title: 'Reparaciones',
      subtitle: 'Expertos en todo tipo de reparaciones',
      img: '/reparacion.png',
      buttons: [
        { label: 'Cotizar por WhatsApp', primary: true, onClick: () => setOpenCotizarRep(true) },
        { label: 'Ver galeria de trabajos', onClick: () => setOpenReparaciones(true) },
      ],
    },
    {
      id: 'compra',
      title: 'Compra y Venta',
      subtitle: 'Celulares nuevos y usados',
      img: '/logodrcell.png',
      buttons: [
        { label: 'Cotizar por WhatsApp', primary: true, onClick: () => setOpenCotizarCompra(true) },
        { label: 'Mensaje rapido', onClick: () => abrirWhatsApp(msgCompraVenta()) },
      ],
    },
    {
      id: 'credito',
      title: 'Credito Facil',
      subtitle: 'Financiacion a tu medida',
      img: '/credito.png',
      buttons: [
        { label: 'Cotizar por WhatsApp', primary: true, onClick: () => setOpenCotizarCredito(true) },
        { label: 'Ver entidades', onClick: () => setOpenCredito(true) },
      ],
    },
  ]

  const toggleServiceCard = (index: number) => {
    setActiveCard((prev) => (prev === index ? null : index))
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

  const inventoryStats = React.useMemo(() => {
    const totalItems = inventoryItems.length
    const lowStock = inventoryItems.filter((item) => item.stockActual <= item.stockMinimo).length
    const totalUnits = inventoryItems.reduce((acc, item) => acc + item.stockActual, 0)
    const totalValue = inventoryItems.reduce((acc, item) => acc + item.stockActual * item.precioCompra, 0)
    return { totalItems, lowStock, totalUnits, totalValue }
  }, [inventoryItems])

  const resetInventoryForm = React.useCallback(() => {
    setInventoryForm(createInventoryFormState())
    setInventoryFormError(null)
    setEditingInventoryId(null)
  }, [])

  const updateInventoryFormField = React.useCallback(
    (field: keyof typeof inventoryForm) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = event.target.value
        setInventoryForm((prev) => ({ ...prev, [field]: value }))
        setInventoryFormError(null)
      },
    [],
  )

  const updateProviderFormField = React.useCallback(
    (field: keyof typeof providerForm) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value
        setProviderForm((prev) => ({ ...prev, [field]: value }))
        setProviderFormError(null)
      },
    [],
  )

  const resetProviderForm = React.useCallback(() => {
    setProviderForm(createProviderFormState())
    setProviderFormError(null)
  }, [])

  const openInventoryModalForCreate = React.useCallback(() => {
    resetInventoryForm()
    setInventoryModalOpen(true)
  }, [resetInventoryForm])

  const closeInventoryModal = React.useCallback(() => {
    setInventoryModalOpen(false)
    resetInventoryForm()
  }, [resetInventoryForm])

  const openInventoryModalForEdit = React.useCallback((item: InventoryItem) => {
    setInventoryForm({
      nombre: item.nombre,
      categoria: item.categoria,
      proveedorId: item.proveedorId ? String(item.proveedorId) : '',
      stockActual: String(item.stockActual),
      stockMinimo: String(item.stockMinimo),
      precioCompra: String(item.precioCompra),
      precioVenta: String(item.precioVenta),
      descripcion: item.descripcion ?? '',
    })
    setInventoryFormError(null)
    setEditingInventoryId(item.id)
    setInventoryModalOpen(true)
  }, [])

  const closeProviderModal = React.useCallback(() => {
    setProviderModalOpen(false)
    resetProviderForm()
  }, [resetProviderForm])

  const openProviderModal = React.useCallback(() => {
    resetProviderForm()
    setProviderModalOpen(true)
  }, [resetProviderForm])

  const handleInventorySearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAppliedInventorySearch(inventorySearchInput.trim())
  }

  const clearInventoryFilters = () => {
    setInventorySearchInput('')
    setAppliedInventorySearch('')
    setInventoryFilter('todos')
  }

  const refreshAlerts = React.useCallback(async () => {
    if (!isAdmin) return
    try {
      const data = await fetchInventoryAlerts()
      setInventoryAlerts(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron obtener las alertas'
      handleProtectedActionError(message)
    }
  }, [handleProtectedActionError, isAdmin])

  const refreshProviders = React.useCallback(async () => {
    if (!isAdmin) return
    try {
      const data = await fetchProviders()
      setInventoryProviders(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron obtener los proveedores'
      setInventoryError((prev) => prev ?? message)
      handleProtectedActionError(message)
    }
  }, [handleProtectedActionError, isAdmin])

  const refreshInventory = React.useCallback(
    async (options?: { withSpinner?: boolean }) => {
      if (!isAdmin) return
      if (options?.withSpinner !== false) {
        setInventoryLoading(true)
      }
      try {
        const data = await fetchInventory({ q: appliedInventorySearch, estado: inventoryFilter })
        setInventoryItems(data)
        setInventoryError(null)
        await refreshAlerts()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo obtener el inventario'
        setInventoryError(message)
        handleProtectedActionError(message)
      } finally {
        if (options?.withSpinner !== false) {
          setInventoryLoading(false)
        }
      }
    },
    [appliedInventorySearch, handleProtectedActionError, inventoryFilter, isAdmin, refreshAlerts],
  )

  React.useEffect(() => {
    if (!isAdmin) {
      setInventoryItems([])
      setInventoryAlerts([])
      setInventoryProviders([])
      setInventoryError(null)
      setInventoryModalOpen(false)
      setProviderModalOpen(false)
      setInventoryForm(createInventoryFormState())
      setProviderForm(createProviderFormState())
      setInventoryFormError(null)
      setProviderFormError(null)
      setEditingInventoryId(null)
      setInventorySearchInput('')
      setAppliedInventorySearch('')
      setInventoryFilter('todos')
      return
    }
    refreshProviders()
    refreshAlerts()
  }, [isAdmin, refreshAlerts, refreshProviders])

  React.useEffect(() => {
    if (!isAdmin) return
    refreshInventory()
  }, [isAdmin, refreshInventory])

  const handleInventorySubmit = async () => {
    if (!isAdmin) {
      setInventoryFormError('Acceso restringido. Inicia sesión como administrador.')
      setOpenAdminModal(true)
      return
    }

    const nombre = inventoryForm.nombre.trim()
    const categoria = inventoryForm.categoria.trim()
    const descripcion = inventoryForm.descripcion.trim()
    const proveedorId =
      inventoryForm.proveedorId.trim() === '' ? null : Number.parseInt(inventoryForm.proveedorId.trim(), 10)
    const stockActual = Number.parseInt(inventoryForm.stockActual, 10)
    const stockMinimo = Number.parseInt(inventoryForm.stockMinimo, 10)
    const precioCompra = Number.parseFloat(inventoryForm.precioCompra)
    const precioVenta = Number.parseFloat(inventoryForm.precioVenta)

    if (!nombre) {
      setInventoryFormError('Ingresa el nombre del repuesto o accesorio.')
      return
    }
    if (!categoria) {
      setInventoryFormError('Selecciona o escribe una categoría.')
      return
    }
    if (Number.isNaN(stockActual) || stockActual < 0) {
      setInventoryFormError('Ingresa un stock actual válido (0 o más).')
      return
    }
    if (Number.isNaN(stockMinimo) || stockMinimo < 0) {
      setInventoryFormError('Ingresa un stock mínimo válido (0 o más).')
      return
    }
    if (Number.isNaN(precioCompra) || precioCompra < 0) {
      setInventoryFormError('Ingresa un precio de compra válido.')
      return
    }
    if (Number.isNaN(precioVenta) || precioVenta < 0) {
      setInventoryFormError('Ingresa un precio de venta válido.')
      return
    }
    if (proveedorId !== null && Number.isNaN(proveedorId)) {
      setInventoryFormError('Selecciona un proveedor válido.')
      return
    }

    const payload = {
      nombre,
      categoria,
      proveedorId,
      stockActual,
      stockMinimo,
      precioCompra,
      precioVenta,
      descripcion: descripcion || undefined,
    }

    setInventorySaving(true)
    try {
      if (editingInventoryId) {
        await updateInventoryItem(editingInventoryId, payload)
      } else {
        await createInventoryItem(payload)
      }
      await refreshInventory({ withSpinner: false })
      closeInventoryModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el inventario'
      setInventoryFormError(message)
      handleProtectedActionError(message)
    } finally {
      setInventorySaving(false)
    }
  }

  const handleInventoryDelete = async (item: InventoryItem) => {
    if (!isAdmin) {
      setOpenAdminModal(true)
      return
    }
    const confirmed = window.confirm(`¿Eliminar ${item.nombre} del inventario?`)
    if (!confirmed) return
    try {
      await deleteInventoryItem(item.id)
      await refreshInventory({ withSpinner: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el registro'
      setInventoryError(message)
      handleProtectedActionError(message)
    }
  }

  const handleProviderSubmit = async () => {
    if (!isAdmin) {
      setProviderFormError('Acceso restringido. Inicia sesión como administrador.')
      setOpenAdminModal(true)
      return
    }
    const nombre = providerForm.nombre.trim()
    const email = providerForm.email.trim()
    if (!nombre) {
      setProviderFormError('Ingresa el nombre del proveedor.')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProviderFormError('Ingresa un correo válido.')
      return
    }

    setProviderSaving(true)
    try {
      await createProvider({
        nombre,
        contacto: providerForm.contacto.trim() || undefined,
        telefono: providerForm.telefono.trim() || undefined,
        email: email || undefined,
        notas: providerForm.notas.trim() || undefined,
      })
      await refreshProviders()
      closeProviderModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el proveedor'
      setProviderFormError(message)
      handleProtectedActionError(message)
    } finally {
      setProviderSaving(false)
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
    if (!isAdmin) {
      setProductError('Acceso restringido. Inicia sesion como administrador.')
      setOpenAdminModal(true)
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
      handleProtectedActionError(message)
    } finally {
      setProductSaving(false)
    }
  }

  const handleRemoveProducto = async (id: number) => {
    if (!isAdmin) {
      setProductosError('Acceso restringido. Inicia sesion como administrador.')
      setOpenAdminModal(true)
      return
    }
    const snapshot = remoteProductos.slice()
    setRemoteProductos((prev) => prev.filter((item) => item.id !== id))
    try {
      await eliminarProducto(id)
      setProductosError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el producto'
        setProductosError(message)
        setRemoteProductos(snapshot)
        if (message.toLowerCase().includes('no autorizado') || message.toLowerCase().includes('restringido')) {
          handleAdminLogout()
          setAdminError('Clave incorrecta. Intenta de nuevo.')
          setOpenAdminModal(true)
        }
      }
    }

  // Carrito
  const add = (p: Producto) =>
    dispatch({ type: 'add', item: { id: p.id, nombre: p.nombre, precio: p.precio } })
  const rm = (id: number) => dispatch({ type: 'rm', id })
  const qty = (id: number, delta: number) => dispatch({ type: 'qty', id, delta })

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Header
        onLocation={() => setOpenUbicacion(true)}
        onCart={() => setShowCart(true)}
        onAdminAccess={handleAdminAccess}
        isAdmin={isAdmin}
      />

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
            <CreditCard size={16} /> Credito con Addi, Sistecrédito y Cupo Brilla
          </button>
          <button onClick={() => setOpenReparaciones(true)} className="flex items-center gap-2 hover:underline">
            <Images size={16} /> Reparaciones realizadas
          </button>
        </div>
      </div>

      <WhatsAppFloat />

      <main className="container mx-auto px-4 py-8">
        {/* Servicios */}
        <section className="bg-white border border-green-300 rounded-2xl shadow-lg shadow-green-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-green-700 mb-4">Nuestros Servicios</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {serviceCards.map((card, index) => (
              <article
                key={card.id}
                className="[perspective:1200px] cursor-pointer"
                onClick={() => toggleServiceCard(index)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleServiceCard(index)
                  }
                }}
              >
                <div
                  className={`relative h-full w-full min-h-[260px] transition-transform duration-700 ease-in-out [transform-style:preserve-3d] ${
                    activeCard === index ? '[transform:rotateY(180deg)]' : ''
                  }`}
                >
                  <div className="absolute inset-0 bg-white border border-green-300 p-4 rounded-xl [backface-visibility:hidden] cursor-pointer">
                    <img src={card.img} alt={card.title} className="mb-3 h-32 w-full object-cover rounded-xl" loading="lazy" />
                    <h3 className="font-bold text-green-700">{card.title}</h3>
                    <p className="text-sm text-gray-600">{card.subtitle}</p>
                  </div>

                  <div className="absolute inset-0 bg-white border border-green-300 p-4 rounded-xl [transform:rotateY(180deg)] [backface-visibility:hidden] flex flex-col justify-center">
                    <div className="grid grid-cols-1 gap-2">
                      {card.buttons.map((btn) => (
                        <button
                          key={btn.label}
                          onClick={btn.onClick}
                          className={`w-full rounded-lg py-2 font-semibold transition-colors ${
                            btn.primary
                              ? 'text-white bg-green-600 hover:bg-green-700'
                              : 'text-green-700 border border-green-300 hover:border-green-500'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {isAdmin && (
          <>
            {/* Inventario administrable */}
            <section
              id="inventario-admin"
              className="mb-8 rounded-2xl border border-green-300 bg-gradient-to-br from-green-50 via-white to-green-50 p-6 shadow-lg shadow-green-200"
            >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-green-600">
                <PackagePlus size={16} />
                Gestion en tiempo real
              </p>
              <h2 className="text-2xl font-bold text-green-800">Inventario de repuestos y accesorios</h2>
              <p className="text-sm text-gray-600">
                Visualiza el stock disponible, recibe alertas automáticas y registra proveedores autorizados.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={openInventoryModalForCreate}
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-green-200 hover:bg-green-700"
              >
                <PackagePlus size={16} />
                Nuevo repuesto
              </button>
              <button
                onClick={openProviderModal}
                className="inline-flex items-center gap-2 rounded-full border border-green-400 px-4 py-2 text-sm font-semibold text-green-700 hover:border-green-500"
              >
                <Factory size={16} />
                Registrar proveedor
              </button>
            </div>
          </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[3fr,1.15fr]">
              <div className="space-y-4">
                <form onSubmit={handleInventorySearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600" />
                    <input
                      type="search"
                      className="w-full rounded-full border border-green-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-green-500"
                      placeholder="Buscar por nombre, categoria o proveedor"
                      value={inventorySearchInput}
                      onChange={(event) => setInventorySearchInput(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {INVENTORY_FILTER_TABS.map((tab) => (
                      <button
                        type="button"
                        key={tab}
                        onClick={() => setInventoryFilter(tab)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                          inventoryFilter === tab
                            ? 'bg-green-600 text-white'
                            : 'border border-green-200 text-green-700 hover:border-green-400'
                        }`}
                      >
                        {tab === 'todos' ? 'Todo el stock' : tab === 'ok' ? 'Stock saludable' : 'Bajo inventario'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-full border border-green-400 px-4 py-2 text-sm font-semibold text-green-700 hover:border-green-500"
                    >
                      Buscar
                    </button>
                    <button
                      type="button"
                      onClick={clearInventoryFilters}
                      className="inline-flex items-center gap-2 rounded-full border border-green-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-green-400"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={() => refreshInventory()}
                      className="inline-flex items-center gap-2 rounded-full border border-green-500 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
                    >
                      <RefreshCcw size={16} />
                      Actualizar
                    </button>
                  </div>
                </form>

                {inventoryError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {inventoryError}
                  </p>
                )}

                <div className="overflow-x-auto rounded-2xl border border-green-200 bg-white shadow-inner shadow-green-50">
                  {inventoryLoading ? (
                    <div className="p-6 text-center text-sm text-gray-600">Cargando inventario...</div>
                  ) : inventoryItems.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-600">
                      No hay registros para los filtros seleccionados.
                    </div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-green-50 text-green-800">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Repuesto</th>
                          <th className="px-4 py-3 text-left font-semibold">Proveedor</th>
                          <th className="px-4 py-3 text-center font-semibold">Stock</th>
                          <th className="px-4 py-3 text-right font-semibold">Compra</th>
                          <th className="px-4 py-3 text-right font-semibold">Venta</th>
                          <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryItems.map((item) => {
                          const isLow = item.stockActual <= item.stockMinimo
                          const margin = item.precioVenta - item.precioCompra
                          return (
                            <tr
                              key={item.id}
                              className={`${isLow ? 'bg-red-50/60' : 'bg-white'} border-b border-green-50`}
                            >
                              <td className="px-4 py-3">
                                <p className="font-semibold text-green-900">{item.nombre}</p>
                                <p className="text-xs text-gray-500">{item.categoria}</p>
                                {item.descripcion && (
                                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{item.descripcion}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {item.proveedorNombre ?? 'Sin proveedor'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <p className="font-semibold text-green-900">
                                  {item.stockActual} und
                                  {isLow && (
                                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                      <AlertTriangle size={12} />
                                      Bajo
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500">Min: {item.stockMinimo}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <p className="font-semibold text-green-900">{formatoCOP(item.precioCompra)}</p>
                                <p className="text-xs text-gray-500">Margen: {formatoCOP(margin)}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <p className="font-semibold text-green-900">{formatoCOP(item.precioVenta)}</p>
                                <p className="text-xs text-gray-500">
                                  Actualizado: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Hoy'}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    className="inline-flex items-center gap-1 rounded-full border border-green-200 px-3 py-1 text-xs font-semibold text-green-700 hover:border-green-500"
                                    onClick={() => openInventoryModalForEdit(item)}
                                  >
                                    <Pencil size={14} />
                                    Editar
                                  </button>
                                  <button
                                    className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:border-red-400"
                                    onClick={() => handleInventoryDelete(item)}
                                  >
                                    <Trash2 size={14} />
                                    Borrar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase text-green-600">Referencias</p>
                    <p className="text-2xl font-bold text-green-800">{inventoryStats.totalItems}</p>
                    <p className="text-xs text-gray-500">Repuestos registrados</p>
                  </div>
                  <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase text-green-600">Unidades</p>
                    <p className="text-2xl font-bold text-green-800">{inventoryStats.totalUnits}</p>
                    <p className="text-xs text-gray-500">Stock disponible</p>
                  </div>
                  <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase text-green-600">Alertas</p>
                    <p className="text-2xl font-bold text-red-600">{inventoryStats.lowStock}</p>
                    <p className="text-xs text-gray-500">Repuestos por debajo del minimo</p>
                  </div>
                  <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase text-green-600">Valor en bodega</p>
                    <p className="text-xl font-bold text-green-800">{formatoCOP(inventoryStats.totalValue)}</p>
                    <p className="text-xs text-gray-500">Basado en costo de compra</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-red-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-red-600">
                    <BellRing size={16} />
                    <p className="font-semibold">Alertas por bajo inventario</p>
                  </div>
                  {inventoryAlerts.length === 0 ? (
                    <p className="text-sm text-gray-600">Todo en orden. No hay alertas activas.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {inventoryAlerts.map((alert) => (
                        <li
                          key={alert.id}
                          className="flex items-center justify-between rounded-lg border border-red-100 px-3 py-2"
                        >
                          <span className="font-semibold text-green-900">{alert.nombre}</span>
                          <span className="text-xs text-red-600">
                            {alert.stockActual} / min {alert.stockMinimo}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-green-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-green-700">
                    <Factory size={16} />
                    <p className="font-semibold">Proveedores registrados</p>
                  </div>
                  {inventoryProviders.length === 0 ? (
                    <p className="text-sm text-gray-600">Aun no has agregado proveedores.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {inventoryProviders.slice(0, 4).map((prov) => (
                        <li key={prov.id} className="rounded-lg border border-green-100 px-3 py-2">
                          <p className="font-semibold text-green-900">{prov.nombre}</p>
                          <p className="text-xs text-gray-500">
                            {prov.contacto ?? 'Contacto por asignar'} • {prov.telefono ?? 'Sin telefono'}
                          </p>
                        </li>
                      ))}
                      {inventoryProviders.length > 4 && (
                        <li className="text-xs text-gray-500">+{inventoryProviders.length - 4} proveedores mas</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>
        </section>
          </>
        )}

        {/* Filtros / busqueda */}
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
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto md:items-center md:justify-end">
              <div className="relative w-full sm:w-64 md:w-80">
                <input
                  type="search"
                  placeholder="Buscar producto (nombre o descripcion)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full rounded-lg bg-white border border-gray-300 focus:border-green-600 outline-none px-4 py-2 text-neutral-800 placeholder:text-gray-400"
                  aria-label="Buscar producto"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"></span>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setOpenNuevoProducto(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-300 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
                >
                  <Plus size={16} /> Agregar producto
                </button>
              )}
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
                    onRemove={isAdmin && p.origin === 'remote' ? handleRemoveProducto : undefined}
                  />
                ))}
              </div>

              {pages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Paginación del catalogo">
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
        <p className="text-xs text-gray-600 mt-3">Credito sujeto a aprobación de la entidad aliada.</p>
      </Modal>

      <Modal open={openNuevoProducto} onClose={closeNuevoProducto} title="Agregar producto al catalogo">
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

      {isAdmin && (
        <Modal
          open={inventoryModalOpen}
          onClose={closeInventoryModal}
          title={editingInventoryId ? 'Editar inventario' : 'Registrar inventario'}
        >
        <div className="space-y-3">
          {inventoryFormError && <p className="text-sm text-red-500">{inventoryFormError}</p>}

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Nombre del repuesto</span>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-green-600 outline-none"
              placeholder="Ej: Pantalla iPhone 12 original"
              value={inventoryForm.nombre}
              onChange={updateInventoryFormField('nombre')}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Categoria</span>
            <input
              list="inventory-categories"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-green-600 outline-none"
              placeholder="Selecciona o escribe una categoria"
              value={inventoryForm.categoria}
              onChange={updateInventoryFormField('categoria')}
            />
            <datalist id="inventory-categories">
              {INVENTORY_SAMPLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Proveedor</span>
            <select
              className="w-full rounded border border-gray-300 px-3 py-2"
              value={inventoryForm.proveedorId}
              onChange={updateInventoryFormField('proveedorId')}
            >
              <option value="">Sin proveedor</option>
              {inventoryProviders.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              No aparece el proveedor? Usa el boton "Registrar proveedor" desde el panel.
            </p>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block mb-1 text-gray-700">Stock actual</span>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={inventoryForm.stockActual}
                onChange={updateInventoryFormField('stockActual')}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 text-gray-700">Stock minimo</span>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={inventoryForm.stockMinimo}
                onChange={updateInventoryFormField('stockMinimo')}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block mb-1 text-gray-700">Precio de compra</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={inventoryForm.precioCompra}
                onChange={updateInventoryFormField('precioCompra')}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 text-gray-700">Precio de venta</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={inventoryForm.precioVenta}
                onChange={updateInventoryFormField('precioVenta')}
              />
            </label>
          </div>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Descripcion</span>
            <textarea
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Notas internas para el tecnico o asesor (opcional)"
              value={inventoryForm.descripcion}
              onChange={updateInventoryFormField('descripcion')}
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={closeInventoryModal} className="rounded-lg border px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={handleInventorySubmit}
            disabled={inventorySaving}
            className={`rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 ${
              inventorySaving ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {inventorySaving ? 'Guardando...' : editingInventoryId ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
        </Modal>
      )}

      {isAdmin && (
        <Modal open={providerModalOpen} onClose={closeProviderModal} title="Registrar proveedor">
        <div className="space-y-3">
          {providerFormError && <p className="text-sm text-red-500">{providerFormError}</p>}

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Nombre comercial</span>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-green-600 outline-none"
              placeholder="Ej: Repuestos Express SAS"
              value={providerForm.nombre}
              onChange={updateProviderFormField('nombre')}
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Contacto principal</span>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Persona o cargo"
              value={providerForm.contacto}
              onChange={updateProviderFormField('contacto')}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block mb-1 text-gray-700">Telefono</span>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder="+57 310 000 0000"
                value={providerForm.telefono}
                onChange={updateProviderFormField('telefono')}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 text-gray-700">Correo</span>
              <input
                type="email"
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder="ventas@proveedor.com"
                value={providerForm.email}
                onChange={updateProviderFormField('email')}
              />
            </label>
          </div>

          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Notas</span>
            <textarea
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Politicas de garantia, tiempos de entrega, etc."
              value={providerForm.notas}
              onChange={updateProviderFormField('notas')}
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={closeProviderModal} className="rounded-lg border px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={handleProviderSubmit}
            disabled={providerSaving}
            className={`rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 ${
              providerSaving ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {providerSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        </Modal>
      )}

      <Modal open={openAdminModal} onClose={closeAdminModal} title="Acceso administrador">
        <div className="space-y-3">
          {adminError && <p className="text-sm text-red-500">{adminError}</p>}
          <label className="text-sm">
            <span className="block mb-1 text-gray-700">Clave de administrador</span>
            <input
              type="password"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-green-600 outline-none"
              placeholder="Ingresa la clave definida en el backend"
              value={adminKeyInput}
              onChange={(e) => {
                setAdminKeyInput(e.target.value)
                setAdminError(null)
              }}
            />
          </label>
          <p className="text-xs text-gray-500">
            La clave se valida localmente y se adjunta en el encabezado `x-api-key` para crear o eliminar productos,
            y habilitar la carga de fotos o videos.
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={closeAdminModal} className="rounded-lg border px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={handleAdminLogin}
            className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
          >
            Ingresar
          </button>
        </div>
      </Modal>

      <Modal open={openReparaciones} onClose={() => setOpenReparaciones(false)} title="Galeria de reparaciones">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <label className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg cursor-pointer font-semibold hover:bg-green-700">
              Subir fotos/videos
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onUpload} />
            </label>
          ) : (
            <p className="text-xs text-gray-600">Solo el administrador puede subir fotos o videos.</p>
          )}
          <p className="text-xs text-gray-600">
            Formatos: JPG/PNG/MP4. Los archivos se mantienen en este navegador; no se suben al servidor.
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
                  {m.origin === 'local' && isAdmin && (
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
