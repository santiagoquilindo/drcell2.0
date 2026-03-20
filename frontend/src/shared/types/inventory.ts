export type InventoryCategoryStatus = 'activo' | 'inactivo'
export type InventoryItemType = 'repuesto' | 'insumo' | 'accesorio' | 'producto' | 'otro'
export type InventoryItemStatus = 'activo' | 'inactivo'
export type InventoryMovementType = 'entrada' | 'salida' | 'ajuste' | 'consumo_reparacion' | 'devolucion'

export type InventoryCategory = {
  id: number
  nombre: string
  descripcion: string | null
  estado: InventoryCategoryStatus
  createdAt: string
  updatedAt: string
}

export type InventoryProvider = {
  id: number
  nombre: string
  contacto: string | null
  telefono: string | null
  email: string | null
  notas: string | null
  createdAt: string
}

export type InventoryItem = {
  id: number
  nombre: string
  sku: string
  descripcion: string | null
  categoriaId: number | null
  categoriaNombre: string | null
  proveedorId: number | null
  proveedorNombre: string | null
  tipo: InventoryItemType
  unidadMedida: string
  costoCompra: number
  precioVenta: number
  stockActual: number
  stockMinimo: number
  permiteStockNegativo: boolean
  estado: InventoryItemStatus
  imagenUrl: string | null
  createdAt: string
  updatedAt: string
}

export type InventoryMovement = {
  id: number
  itemId: number
  itemNombre: string
  itemSku: string
  tipoMovimiento: InventoryMovementType
  cantidad: number
  motivo: string
  referencia: string | null
  observaciones: string | null
  stockAntes: number
  stockDespues: number
  adminUserId: number | null
  usuarioResponsable: string | null
  createdAt: string
}

export type InventoryItemDetail = InventoryItem & {
  movements: InventoryMovement[]
}

export type InventoryCategoryPayload = {
  nombre: string
  descripcion?: string
  estado?: InventoryCategoryStatus
}

export type InventoryItemPayload = {
  nombre: string
  sku: string
  descripcion?: string
  categoriaId: number
  proveedorId?: number | null
  tipo: InventoryItemType
  unidadMedida: string
  costoCompra: number
  precioVenta: number
  stockInicial?: number
  stockMinimo: number
  permiteStockNegativo: boolean
  estado: InventoryItemStatus
  imagen?: string
}

export type InventoryMovementPayload = {
  tipoMovimiento: InventoryMovementType
  cantidad?: number
  stockObjetivo?: number
  motivo: string
  referencia?: string
  observaciones?: string
}
