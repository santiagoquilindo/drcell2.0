import type { Product, ProductPayload } from '@shared/types/product'

import { apiRequest } from './client'

export async function fetchProducts(includeInactive = false) {
  const path = includeInactive ? '/products/admin/all' : '/products'
  return apiRequest<Product[]>(path, {
    auth: includeInactive,
  })
}

export async function createProduct(payload: ProductPayload) {
  return apiRequest<Product>('/products', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function updateProduct(id: number, payload: ProductPayload) {
  return apiRequest<Product>(`/products/${id}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function deleteProduct(id: number) {
  return apiRequest<null>(`/products/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}
