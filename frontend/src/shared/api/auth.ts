import { apiRequest } from './client'

export type AdminUser = {
  adminId?: number
  id?: number
  email: string
  name: string
}

export async function login(payload: { email: string; password: string }) {
  return apiRequest<{ user: AdminUser }>('/auth/login', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function logout() {
  return apiRequest<null>('/auth/logout', {
    method: 'POST',
    auth: true,
  })
}

export async function fetchMe() {
  return apiRequest<{ user: AdminUser }>('/auth/me', {
    auth: true,
  })
}
