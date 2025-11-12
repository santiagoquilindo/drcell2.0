export type DiagnosticRequest = {
  dispositivo?: string
  motivo: string
  descripcion: string
  contacto?: string
  nombre?: string
}

export type DiagnosticResponse = {
  resumen: string
  probables_causas: string[]
  siguientes_pasos: string[]
  urgencia: 'alta' | 'media' | 'baja'
  nota_garantia: string
}
