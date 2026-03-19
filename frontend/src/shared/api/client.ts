import { env } from '@shared/config/env'

type RequestOptions = RequestInit & {
  auth?: boolean
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    credentials: options.auth ? 'include' : options.credentials,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response
      .json()
      .then((payload) => (typeof payload?.message === 'string' ? payload.message : null))
      .catch(() => null)

    throw new ApiError(message ?? 'No se pudo completar la solicitud', response.status)
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}
