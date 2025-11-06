export type RepairMediaItem = {
  id: string
  tipo: string
  src: string
  origin: 'base' | 'local'
  mime?: string
  name?: string
  uploadedAt?: number
}

export const REPARACIONES_BASE: RepairMediaItem[] = [
  {
    id: 'base-cambio-pantalla',
    tipo: 'Cambio de pantalla',
    src: 'https://images.unsplash.com/photo-1583225272832-1d0956ac9b62?q=80&w=1200&auto=format&fit=crop',
    origin: 'base',
  },
  {
    id: 'base-reparacion-placa',
    tipo: 'Reparación placa',
    src: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop',
    origin: 'base',
  },
  {
    id: 'base-cambio-bateria',
    tipo: 'Cambio batería',
    src: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=1200&auto=format&fit=crop',
    origin: 'base',
  },
]
