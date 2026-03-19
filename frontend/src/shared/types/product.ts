export type ProductCategory = 'nuevos' | 'usados' | 'accesorios'

export type Product = {
  id: number
  nombre: string
  slug: string
  descripcion: string
  categoria: ProductCategory
  precio: number
  stock: number
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
  activo: boolean
  imagen?: string
}
