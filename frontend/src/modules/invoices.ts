export type InvoiceType = 'factura' | 'cotizacion'
export type InvoiceStatus = 'borrador' | 'emitida' | 'pagada'

export type InvoiceItemInput = {
  descripcion: string
  inventarioItemId?: number | null
  cantidad: number
  precioUnitario: number
  impuestoPorcentaje?: number
  descuentoPorcentaje?: number
}

export type InvoiceItem = Required<Omit<InvoiceItemInput, 'inventarioItemId'>> & {
  id: number
  inventarioItemId: number | null
  total: number
}

export type InvoiceSummary = {
  id: number
  consecutivo: string
  tipo: InvoiceType
  estado: InvoiceStatus
  clienteNombre: string
  clienteIdentificacion?: string | null
  clienteTelefono?: string | null
  clienteEmail?: string | null
  clienteDireccion?: string | null
  notas?: string | null
  subtotal: number
  impuesto: number
  descuento: number
  total: number
  anticipo: number
  saldo: number
  createdAt: string
  updatedAt: string
  itemsCount: number
}

export type InvoiceDetail = Omit<InvoiceSummary, 'itemsCount'> & {
  items: InvoiceItem[]
}
