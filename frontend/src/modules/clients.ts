export type Client = {
  id: number
  nombre: string
  documento?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  notas?: string | null
  createdAt?: string
}

export type ClientInput = {
  nombre: string
  documento?: string
  telefono?: string
  email?: string
  direccion?: string
  notas?: string
}
