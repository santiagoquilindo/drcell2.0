import type { PoolClient } from 'pg'
import { Router } from 'express'
import { z } from 'zod'

import { pool } from '../config/database.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { createInvoicePdf } from '../lib/createInvoicePdf.js'

const router = Router()

const invoiceItemSchema = z.object({
  descripcion: z.string().min(1),
  inventarioItemId: z.number().int().positive().optional(),
  cantidad: z.coerce.number().int().positive(),
  precioUnitario: z.coerce.number().nonnegative(),
  impuestoPorcentaje: z.coerce.number().min(0).max(100).default(0),
  descuentoPorcentaje: z.coerce.number().min(0).max(100).default(0),
})

const invoiceSchema = z.object({
  tipo: z.enum(['factura', 'cotizacion']).default('cotizacion'),
  clienteNombre: z.string().min(1),
  clienteIdentificacion: z.string().optional(),
  clienteTelefono: z.string().optional(),
  clienteEmail: z.string().email().optional(),
  clienteDireccion: z.string().optional(),
  notas: z.string().optional(),
  anticipo: z.coerce.number().min(0).default(0),
  items: z.array(invoiceItemSchema).min(1),
})

const statusSchema = z.object({
  estado: z.enum(['borrador', 'emitida', 'pagada']),
  notas: z.string().optional(),
  anticipo: z.coerce.number().min(0).optional(),
})

router.use(requireAdmin)

router.get('/', async (req, res, next) => {
  const { estado, tipo, q } = req.query
  try {
    const filters: string[] = []
    const values: unknown[] = []

    if (tipo === 'factura' || tipo === 'cotizacion') {
      values.push(tipo)
      filters.push(`i.tipo = $${values.length}`)
    }
    if (estado === 'borrador' || estado === 'emitida' || estado === 'pagada') {
      values.push(estado)
      filters.push(`i.estado = $${values.length}`)
    }
    if (typeof q === 'string' && q.trim()) {
      values.push(`%${q.trim().toLowerCase()}%`)
      filters.push(`LOWER(i.cliente_nombre) LIKE $${values.length}`)
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

    const result = await pool.query(
      `
        SELECT
          i.id,
          i.consecutivo,
          i.tipo,
          i.estado,
          i.cliente_nombre AS "clienteNombre",
          i.cliente_identificacion AS "clienteIdentificacion",
          i.cliente_email AS "clienteEmail",
          i.cliente_telefono AS "clienteTelefono",
          i.cliente_direccion AS "clienteDireccion",
          i.notas,
          i.subtotal,
          i.impuesto,
          i.descuento,
          i.total,
          i.anticipo,
          i.saldo,
          i.created_at AS "createdAt",
          i.updated_at AS "updatedAt",
          COUNT(ii.id)::int AS "itemsCount"
        FROM invoices i
        LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
        ${whereClause}
        GROUP BY i.id
        ORDER BY i.created_at DESC
      `,
      values,
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const data = invoiceSchema.parse(req.body)
    const totals = calculateTotals(data.items)
    const saldo = Math.max(totals.total - data.anticipo, 0)

    await client.query('BEGIN')
    const consecutivo = await generateConsecutivo(client)
    const invoiceResult = await client.query(
      `
        INSERT INTO invoices
          (consecutivo, tipo, estado, cliente_nombre, cliente_identificacion, cliente_email,
           cliente_telefono, cliente_direccion, notas, subtotal, impuesto, descuento, total, anticipo, saldo)
        VALUES
          ($1, $2, 'emitida', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `,
      [
        consecutivo,
        data.tipo,
        data.clienteNombre,
        data.clienteIdentificacion ?? null,
        data.clienteEmail ?? null,
        data.clienteTelefono ?? null,
        data.clienteDireccion ?? null,
        data.notas ?? null,
        totals.subtotal,
        totals.impuesto,
        totals.descuento,
        totals.total,
        data.anticipo,
        saldo,
      ],
    )

    const invoiceId = invoiceResult.rows[0]?.id as number

    for (const item of totals.items) {
      await client.query(
        `
          INSERT INTO invoice_items
            (invoice_id, inventario_item_id, descripcion, cantidad, precio_unitario,
             impuesto_porcentaje, descuento_porcentaje, total)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          invoiceId,
          item.inventarioItemId ?? null,
          item.descripcion,
          item.cantidad,
          item.precioUnitario,
          item.impuestoPorcentaje,
          item.descuentoPorcentaje,
          item.total,
        ],
      )
    }

    await client.query('COMMIT')
    const invoice = await fetchInvoiceDetail(invoiceId)
    res.status(201).json(invoice)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id inválido' })
    }
    const invoice = await fetchInvoiceDetail(id)
    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' })
    }
    res.json(invoice)
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id inválido' })
    }
    const data = statusSchema.parse(req.body)
    const current = await fetchInvoiceDetail(id)
    if (!current) {
      return res.status(404).json({ message: 'Factura no encontrada' })
    }

    const anticipo = data.anticipo ?? current.anticipo
    const saldo = Math.max(current.total - anticipo, 0)

    const update = await pool.query(
      `
        UPDATE invoices
        SET estado = $2,
            notas = COALESCE($3, notas),
            anticipo = $4,
            saldo = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          consecutivo,
          tipo,
          estado,
          cliente_nombre AS "clienteNombre",
          cliente_identificacion AS "clienteIdentificacion",
          cliente_email AS "clienteEmail",
          cliente_telefono AS "clienteTelefono",
          cliente_direccion AS "clienteDireccion",
          notas,
          subtotal,
          impuesto,
          descuento,
          total,
          anticipo,
          saldo,
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          (SELECT COUNT(*)::int FROM invoice_items WHERE invoice_id = $1) AS "itemsCount"
      `,
      [id, data.estado, data.notas ?? null, anticipo, saldo],
    )

    res.json(update.rows[0])
  } catch (error) {
    next(error)
  }
})

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id inválido' })
    }
    const invoice = await fetchInvoiceDetail(id)
    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' })
    }
    const pdf = await createInvoicePdf(invoice)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="factura-${invoice.consecutivo}.pdf"`)
    res.send(pdf)
  } catch (error) {
    next(error)
  }
})

export default router

type InvoiceItem = {
  id: number
  descripcion: string
  inventarioItemId: number | null
  cantidad: number
  precioUnitario: number
  impuestoPorcentaje: number
  descuentoPorcentaje: number
  total: number
}

type InvoiceRecord = {
  id: number
  consecutivo: string
  tipo: 'factura' | 'cotizacion'
  estado: 'borrador' | 'emitida' | 'pagada'
  clienteNombre: string
  clienteIdentificacion: string | null
  clienteEmail: string | null
  clienteTelefono: string | null
  clienteDireccion: string | null
  notas: string | null
  subtotal: number
  impuesto: number
  descuento: number
  total: number
  anticipo: number
  saldo: number
  createdAt: string
  updatedAt: string
}

export type InvoiceWithItems = InvoiceRecord & { items: InvoiceItem[] }

async function fetchInvoiceDetail(id: number): Promise<InvoiceWithItems | null> {
  const invoiceResult = await pool.query<InvoiceRecord>(
    `
      SELECT
        id,
        consecutivo,
        tipo,
        estado,
        cliente_nombre AS "clienteNombre",
        cliente_identificacion AS "clienteIdentificacion",
        cliente_email AS "clienteEmail",
        cliente_telefono AS "clienteTelefono",
        cliente_direccion AS "clienteDireccion",
        notas,
        subtotal,
        impuesto,
        descuento,
        total,
        anticipo,
        saldo,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM invoices
      WHERE id = $1
    `,
    [id],
  )

  if (invoiceResult.rowCount === 0) {
    return null
  }

  const itemsResult = await pool.query<InvoiceItem>(
    `
      SELECT
        id,
        inventario_item_id AS "inventarioItemId",
        descripcion,
        cantidad,
        precio_unitario AS "precioUnitario",
        impuesto_porcentaje AS "impuestoPorcentaje",
        descuento_porcentaje AS "descuentoPorcentaje",
        total
      FROM invoice_items
      WHERE invoice_id = $1
      ORDER BY id ASC
    `,
    [id],
  )

  return {
    ...invoiceResult.rows[0]!,
    items: itemsResult.rows,
  }
}

type CalculatedItem = z.infer<typeof invoiceItemSchema> & {
  total: number
  descuentoValor: number
  impuestoValor: number
}

function calculateTotals(items: z.infer<typeof invoiceItemSchema>[]): {
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  items: CalculatedItem[]
} {
  const mapped: CalculatedItem[] = items.map((item) => {
    const base = item.cantidad * item.precioUnitario
    const descuentoValor = (base * item.descuentoPorcentaje) / 100
    const baseSinDescuento = base - descuentoValor
    const impuestoValor = (baseSinDescuento * item.impuestoPorcentaje) / 100
    const total = baseSinDescuento + impuestoValor
    return {
      ...item,
      total,
      descuentoValor,
      impuestoValor,
    }
  })

  const subtotal = mapped.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0)
  const descuento = mapped.reduce((acc, item) => acc + item.descuentoValor, 0)
  const impuesto = mapped.reduce((acc, item) => acc + item.impuestoValor, 0)
  const total = subtotal - descuento + impuesto

  return {
    subtotal,
    descuento,
    impuesto,
    total,
    items: mapped,
  }
}

async function generateConsecutivo(client: PoolClient) {
  const result = await client.query<{ seq: string }>(
    `SELECT LPAD(nextval('invoice_consecutivo_seq')::text, 4, '0') AS seq`,
  )
  const today = new Date()
  const year = today.getFullYear().toString().slice(-2)
  const month = (today.getMonth() + 1).toString().padStart(2, '0')
  const day = today.getDate().toString().padStart(2, '0')
  return `DC${year}${month}${day}-${result.rows[0]!.seq}`
}
