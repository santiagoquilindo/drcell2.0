import dayjs from 'dayjs'
import { Router } from 'express'
import type { Pool, PoolClient } from 'pg'
import { z } from 'zod'

import { pool } from '../config/database.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const returnStatus = z.enum([
  'reportada',
  'revision_tecnica',
  'entregada_proveedor',
  'espera_regreso',
  'devuelta_reemplazo',
  'devuelta_reembolso',
  'reparada_entregada',
  'rechazada',
  'cerrada',
])

const movementSchema = z.object({
  tipo: z.string().min(2),
  entregadoPor: z.string().min(1),
  recibidoPor: z.string().min(1),
  fecha: z.string().datetime().optional(),
  notas: z.string().optional(),
})

const createSchema = z
  .object({
    inventarioItemId: z.number().int().positive().optional(),
    productoNombre: z.string().min(2).optional(),
    proveedorId: z.number().int().positive().optional(),
    clienteId: z.number().int().positive().optional(),
    motivo: z.string().min(3),
    diagnostico: z.string().optional(),
    slaProveedor: z.string().datetime().optional(),
    primerMovimiento: movementSchema,
  })
  .refine((data) => data.inventarioItemId || data.productoNombre, {
    message: 'Debe indicar el repuesto vinculado o un nombre de producto',
    path: ['productoNombre'],
  })

const updateSchema = z.object({
  motivo: z.string().optional(),
  diagnostico: z.string().optional(),
  proveedorId: z.number().int().positive().optional(),
  clienteId: z.number().int().positive().optional(),
  slaProveedor: z.string().datetime().optional(),
})

const historySchema = z.object({
  comentario: z.string().min(1),
})

const stateSchema = z.object({
  estado: returnStatus,
  comentario: z.string().optional(),
  slaProveedor: z.string().datetime().optional(),
})

const attachmentSchema = z.object({
  tipo: z.string().min(1),
  url: z.string().url(),
  nombre: z.string().optional(),
  subidoPor: z.string().min(1),
})

const closeSchema = z.object({
  resultadoFinal: z.string().min(3),
  ajusteStock: z.boolean(),
  ajusteNotas: z.string().optional(),
  cerradaPor: z.string().min(1),
})

const reportQuerySchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
  estado: returnStatus.optional(),
})

const TRANSITIONS: Record<z.infer<typeof returnStatus>, z.infer<typeof returnStatus>[]> = {
  reportada: ['revision_tecnica', 'rechazada'],
  revision_tecnica: ['entregada_proveedor', 'devuelta_reemplazo', 'devuelta_reembolso', 'reparada_entregada', 'rechazada'],
  entregada_proveedor: ['espera_regreso', 'devuelta_reemplazo', 'devuelta_reembolso', 'reparada_entregada', 'rechazada'],
  espera_regreso: ['devuelta_reemplazo', 'devuelta_reembolso', 'reparada_entregada', 'rechazada'],
  devuelta_reemplazo: ['cerrada'],
  devuelta_reembolso: ['cerrada'],
  reparada_entregada: ['cerrada'],
  rechazada: ['cerrada'],
  cerrada: [],
}

const SLA_ALERT_EXPR = `
  CASE
    WHEN d.sla_proveedor IS NULL THEN NULL
    WHEN NOW() > d.sla_proveedor THEN 'overdue'
    WHEN NOW() >= d.sla_proveedor - INTERVAL '24 hours' THEN '24h'
    WHEN NOW() >= d.sla_proveedor - INTERVAL '72 hours' THEN '72h'
    ELSE NULL
  END
`

router.use(requireAdmin)

router.get('/', async (req, res, next) => {
  try {
    const { estado, alerta, q } = req.query
    const where: string[] = []
    const values: unknown[] = []

    if (estado && typeof estado === 'string') {
      values.push(estado)
      where.push(`d.estado = $${values.length}`)
    }

    if (alerta && typeof alerta === 'string') {
      values.push(alerta)
      where.push(`${SLA_ALERT_EXPR} = $${values.length}`)
    }

    if (q && typeof q === 'string' && q.trim()) {
      values.push(`%${q.trim().toLowerCase()}%`)
      where.push(`(LOWER(d.codigo) LIKE $${values.length} OR LOWER(COALESCE(p.nombre,'')) LIKE $${values.length} OR LOWER(COALESCE(c.nombre,'')) LIKE $${values.length})`)
    }

    const query = `
      SELECT
        d.id,
        d.codigo,
        d.estado,
        d.motivo,
        d.diagnostico,
        d.sla_proveedor AS "slaProveedor",
        ${SLA_ALERT_EXPR} AS "slaAlerta",
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt",
        d.resultado_final AS "resultadoFinal",
        p.nombre AS "proveedorNombre",
        c.nombre AS "clienteNombre"
      FROM devoluciones d
      LEFT JOIN proveedores p ON p.id = d.proveedor_id
      LEFT JOIN clients c ON c.id = d.cliente_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY d.created_at DESC
      LIMIT 200
    `
    const result = await pool.query(query, values)
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const data = createSchema.parse(req.body)
    await client.query('BEGIN')
    const codigo = await nextReturnCode(client)
    const inserted = await client.query(
      `
        INSERT INTO devoluciones
          (codigo, inventario_item_id, producto_nombre, proveedor_id, cliente_id, motivo, diagnostico, sla_proveedor)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `,
      [
        codigo,
        data.inventarioItemId ?? null,
        data.productoNombre ?? null,
        data.proveedorId ?? null,
        data.clienteId ?? null,
        data.motivo,
        data.diagnostico ?? null,
        data.slaProveedor ? new Date(data.slaProveedor) : null,
      ],
    )
    const devolucionId = inserted.rows[0].id as number
    await insertMovement(client, devolucionId, data.primerMovimiento)
    await insertHistory(client, devolucionId, 'reportada', data.primerMovimiento.notas ?? 'Ingreso reportado')
    await client.query('COMMIT')
    const detail = await fetchReturnDetail(devolucionId)
    res.status(201).json(detail)
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
    const detail = await fetchReturnDetail(id)
    if (!detail) {
      return res.status(404).json({ message: 'Devolución no encontrada' })
    }
    res.json(detail)
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const data = updateSchema.parse(req.body)
    const fields: string[] = []
    const values: unknown[] = []

    const pushField = (column: string, value: unknown) => {
      values.push(value)
      fields.push(`${column} = $${values.length}`)
    }

    if (data.motivo !== undefined) pushField('motivo', data.motivo)
    if (data.diagnostico !== undefined) pushField('diagnostico', data.diagnostico)
    if (data.proveedorId !== undefined) pushField('proveedor_id', data.proveedorId ?? null)
    if (data.clienteId !== undefined) pushField('cliente_id', data.clienteId ?? null)
    if (data.slaProveedor !== undefined) pushField('sla_proveedor', new Date(data.slaProveedor))

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Sin cambios para actualizar' })
    }

    values.push(id)
    await pool.query(`UPDATE devoluciones SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`, values)
    const detail = await fetchReturnDetail(id)
    res.json(detail)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/movimientos', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const data = movementSchema.parse(req.body)
    const exists = await fetchReturn(id)
    if (!exists) {
      return res.status(404).json({ message: 'Devolución no encontrada' })
    }
    await insertMovement(pool, id, data)
    const movements = await fetchMovements(id)
    res.status(201).json(movements)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/historial', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const data = historySchema.parse(req.body)
    const exists = await fetchReturn(id)
    if (!exists) {
      return res.status(404).json({ message: 'Devolución no encontrada' })
    }
    await pool.query(
      `
        INSERT INTO devolucion_historial (devolucion_id, estado, comentario, actor)
        VALUES ($1,$2,$3,$4)
      `,
      [id, exists.estado, data.comentario, 'sistema'],
    )
    const history = await fetchHistory(id)
    res.status(201).json(history)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/estado', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = Number(req.params.id)
    const data = stateSchema.parse(req.body)
    await client.query('BEGIN')
    const current = await fetchReturn(id, client)
    if (!current) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Devolución no encontrada' })
    }

    if (!TRANSITIONS[current.estado].includes(data.estado)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Transición no permitida' })
    }

    if (data.estado === 'entregada_proveedor' && !(data.slaProveedor ?? current.sla_proveedor)) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Debes definir un SLA cuando se entrega al proveedor' })
    }

    await client.query(
      `
        UPDATE devoluciones
        SET estado = $2,
            sla_proveedor = COALESCE($3, sla_proveedor),
            updated_at = NOW()
        WHERE id = $1
      `,
      [id, data.estado, data.slaProveedor ? new Date(data.slaProveedor) : null],
    )

    await insertHistory(client, id, data.estado, data.comentario ?? `Estado actualizado a ${data.estado}`)
    await client.query('COMMIT')
    const detail = await fetchReturnDetail(id)
    res.json(detail)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

router.post('/:id/adjuntos', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const data = attachmentSchema.parse(req.body)
    const exists = await fetchReturn(id)
    if (!exists) {
      return res.status(404).json({ message: 'Devolución no encontrada' })
    }
    await pool.query(
      `
        INSERT INTO devolucion_adjuntos (devolucion_id, tipo, url, nombre, subido_por)
        VALUES ($1,$2,$3,$4,$5)
      `,
      [id, data.tipo, data.url, data.nombre ?? null, data.subidoPor],
    )
    const attachments = await fetchAttachments(id)
    res.status(201).json(attachments)
  } catch (error) {
    next(error)
  }
})

router.post('/:id/cerrar', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = Number(req.params.id)
    const data = closeSchema.parse(req.body)
    await client.query('BEGIN')
    const current = await fetchReturn(id, client)
    if (!current) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Devolución no encontrada' })
    }

    if (current.estado === 'cerrada') {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'La devolución ya está cerrada' })
    }

    const finalMovement = await client.query(
      `
        SELECT 1 FROM devolucion_movimientos
        WHERE devolucion_id = $1 AND tipo = 'entrega_final'
        LIMIT 1
      `,
      [id],
    )

    if (finalMovement.rowCount === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Registra la entrega final antes de cerrar' })
    }

    if (!data.ajusteStock) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Debes confirmar el ajuste de inventario para cerrar' })
    }

    await client.query(
      `
        UPDATE devoluciones
        SET estado = 'cerrada',
            resultado_final = $2,
            ajuste_stock = true,
            ajuste_notas = $3,
            cerrada_por = $4,
            cerrada_en = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [id, data.resultadoFinal, data.ajusteNotas ?? null, data.cerradaPor],
    )
    await insertHistory(client, id, 'cerrada', `Cerrada por ${data.cerradaPor}`)
    await client.query('COMMIT')
    const detail = await fetchReturnDetail(id)
    res.json(detail)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

router.get('/report/export', async (req, res, next) => {
  try {
    const { estado, desde, hasta } = reportQuerySchema.parse(req.query)
    const where: string[] = []
    const values: unknown[] = []
    if (estado) {
      values.push(estado)
      where.push(`d.estado = $${values.length}`)
    }
    if (desde) {
      values.push(new Date(desde))
      where.push(`d.created_at >= $${values.length}`)
    }
    if (hasta) {
      values.push(new Date(hasta))
      where.push(`d.created_at <= $${values.length}`)
    }
    const rows = await pool.query(
      `
        SELECT
          d.codigo,
          d.estado,
          d.motivo,
          d.diagnostico,
          d.created_at,
          d.updated_at,
          d.sla_proveedor,
          d.resultado_final,
          p.nombre AS proveedor,
          c.nombre AS cliente
        FROM devoluciones d
        LEFT JOIN proveedores p ON p.id = d.proveedor_id
        LEFT JOIN clients c ON c.id = d.cliente_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY d.created_at DESC
      `,
      values,
    )

    const csv = buildCsv(rows.rows)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="devoluciones.csv"')
    res.send(csv)
  } catch (error) {
    next(error)
  }
})

async function fetchReturnDetail(id: number) {
  const devolucion = await fetchReturn(id)
  if (!devolucion) return null
  const [movements, history, attachments] = await Promise.all([fetchMovements(id), fetchHistory(id), fetchAttachments(id)])
  return { ...devolucion, movements, history, attachments }
}

type PoolLike = Pool | PoolClient

async function fetchReturn(id: number, client: PoolLike = pool) {
  const result = await client.query(
    `
      SELECT
        d.*,
        ${SLA_ALERT_EXPR} AS "slaAlerta",
        p.nombre AS "proveedorNombre",
        c.nombre AS "clienteNombre"
      FROM devoluciones d
      LEFT JOIN proveedores p ON p.id = d.proveedor_id
      LEFT JOIN clients c ON c.id = d.cliente_id
      WHERE d.id = $1
    `,
    [id],
  )
  return result.rows[0] as
    | (Record<string, unknown> & {
        estado: z.infer<typeof returnStatus>
        sla_proveedor: Date | null
      })
    | undefined
}

async function fetchMovements(id: number) {
  const result = await pool.query(
    `
      SELECT id, tipo, entregado_por AS "entregadoPor", recibido_por AS "recibidoPor", fecha, notas
      FROM devolucion_movimientos
      WHERE devolucion_id = $1
      ORDER BY fecha ASC
    `,
    [id],
  )
  return result.rows
}

async function fetchHistory(id: number) {
  const result = await pool.query(
    `
      SELECT id, estado, comentario, actor, metadata, created_at AS "createdAt"
      FROM devolucion_historial
      WHERE devolucion_id = $1
      ORDER BY created_at DESC
    `,
    [id],
  )
  return result.rows
}

async function fetchAttachments(id: number) {
  const result = await pool.query(
    `
      SELECT id, tipo, url, nombre, subido_por AS "subidoPor", created_at AS "createdAt"
      FROM devolucion_adjuntos
      WHERE devolucion_id = $1
      ORDER BY created_at DESC
    `,
    [id],
  )
  return result.rows
}

async function insertMovement(client: PoolLike, devolucionId: number, data: z.infer<typeof movementSchema>) {
  await client.query(
    `
      INSERT INTO devolucion_movimientos (devolucion_id, tipo, entregado_por, recibido_por, fecha, notas)
      VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [
      devolucionId,
      data.tipo,
      data.entregadoPor,
      data.recibidoPor,
      data.fecha ? new Date(data.fecha) : new Date(),
      data.notas ?? null,
    ],
  )
}

async function insertHistory(client: PoolLike, devolucionId: number, estado: string, comentario: string) {
  await client.query(
    `
      INSERT INTO devolucion_historial (devolucion_id, estado, comentario, actor)
      VALUES ($1,$2,$3,'sistema')
    `,
    [devolucionId, estado, comentario],
  )
}

async function nextReturnCode(client: PoolLike) {
  const result = await client.query<{ seq: string }>(`SELECT LPAD(nextval('devolucion_codigo_seq')::text, 4, '0') AS seq`)
  const prefix = dayjs().format('YYMMDD')
  return `DEV-${prefix}-${result.rows[0].seq}`
}

function buildCsv(rows: Record<string, unknown>[]) {
  const headers = [
    'codigo',
    'estado',
    'motivo',
    'diagnostico',
    'fecha_creacion',
    'fecha_actualizacion',
    'sla_proveedor',
    'resultado',
    'proveedor',
    'cliente',
  ]

  const escape = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const str = value instanceof Date ? value.toISOString() : String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      [
        escape(row.codigo),
        escape(row.estado),
        escape(row.motivo),
        escape(row.diagnostico),
        escape(row.created_at),
        escape(row.updated_at),
        escape(row.sla_proveedor),
        escape(row.resultado_final),
        escape(row.proveedor),
        escape(row.cliente),
      ].join(','),
    )
  }
  return lines.join('\n')
}

export { router as returnsRouter }
export default router
