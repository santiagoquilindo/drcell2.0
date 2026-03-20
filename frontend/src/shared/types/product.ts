export type ProductCategory = 'nuevos' | 'usados' | 'accesorios'

export type Product = {
  id: number
  nombre: string
  slug: string
  descripcion: string
  categoria: ProductCategory
  precio: number
  stock: number
  stockManual: number
  inventarioItemId: number | null
  inventarioItemNombre: string | null
  activo: boolean
  imagenUrl: string | null
  createdAt: string
  updatedAt: string
}

export type ProductPayload = {
  nombre: string
  descripcion: string
  categoria: ProductCategory
  precio: number
  stock: number
  inventarioItemId?: number | null
  activo: boolean
  imagen?: string
}
