import type { CategoriaProducto, Producto } from '@modules/catalog'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

type ApiProducto = {
  id: number
  nombre: string
  descripcion: string
  categoria: CategoriaProducto
  precio: number
  imagenUrl?: string | null
  createdAt?: string
}

const mapProducto = (data: ApiProducto): Producto => ({
  id: data.id,
  nombre: data.nombre,
  descripcion: data.descripcion ?? '',
  categoria: data.categoria,
  precio: data.precio,
  imagenUrl: data.imagenUrl ?? undefined,
  createdAt: data.createdAt,
  origin: 'remote',
})

export async function fetchProductos(): Promise<Producto[]> {
  const res = await fetch(`${API_BASE_URL}/products`)
  if (!res.ok) {
    throw new Error('No se pudieron obtener los productos')
  }
  const data: ApiProducto[] = await res.json()
  return data.map(mapProducto)
}

type CreateProductoInput = {
  nombre: string
  descripcion: string
  categoria: CategoriaProducto
  precio: number
  imagenUrl?: string
}

export async function crearProducto(input: CreateProductoInput, token: string): Promise<Producto> {
  if (!token) {
    throw new Error('Acceso de administrador requerido')
  }
  const res = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const message = await res
      .json()
      .catch(() => ({ message: 'No se pudo guardar el producto' }))
    throw new Error(message?.message ?? 'No se pudo guardar el producto')
  }

  const data: ApiProducto = await res.json()
  return mapProducto(data)
}

export async function eliminarProducto(id: number, token: string): Promise<void> {
  if (!token) {
    throw new Error('Acceso de administrador requerido')
  }
  const res = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const message = await res
      .json()
      .catch(() => ({ message: 'No se pudo eliminar el producto' }))
    throw new Error(message?.message ?? 'No se pudo eliminar el producto')
  }
}
