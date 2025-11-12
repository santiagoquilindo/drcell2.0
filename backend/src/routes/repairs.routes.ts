import type { PoolClient } from 'pg'
import { Router } from 'express'
import { z } from 'zod'

import { pool } from '../config/database.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { createRepairSticker } from '../lib/createRepairSticker.js'

const router = Router()

const statusEnum = z.enum(['ingresado', 'diagnostico', 'en_proceso', 'listo', 'entregado'])

const clientSchema = z.object({
  nombre: z.string().min(1),
  documento: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  direccion: z.string().optional(),
  notas: z.string().optional(),
})

const repairCreateSchema = z
  .object({
    clientId: z.number().int().positive().optional(),
    client: clientSchema.optional(),
    dispositivoTipo: z.string().optional(),
    marca: z.string().optional(),
    modelo: z.string().optional(),
    referencia: z.string().optional(),
    color: z.string().optional(),
    serie: z.string().optional(),
    motivoIngreso: z.string().min(1),
    diagnostico: z.string().optional(),
    accesorios: z.string().optional(),
    estado: statusEnum.optional(),
    costoEstimado: z.coerce.number().min(0).optional(),
    costoFinal: z.coerce.number().min(0).optional(),
    responsable: z.string().optional(),
    notas: z.string().optional(),
  })
  .refine((data) => data.clientId || data.client, {
    message: 'Debe seleccionar o crear un cliente',
    path: ['clientId'],
  })

const repairUpdateSchema = z.object({
  dispositivoTipo: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  referencia: z.string().optional(),
  color: z.string().optional(),
  serie: z.string().optional(),
  motivoIngreso: z.string().optional(),
  diagnostico: z.string().optional(),
  accesorios: z.string().optional(),
  estado: statusEnum.optional(),
  costoEstimado: z.coerce.number().min(0).optional(),
  costoFinal: z.coerce.number().min(0).optional(),
  responsable: z.string().optional(),
  notas: z.string().optional(),
})

const progressSchema = z.object({
  estado: statusEnum,
  comentario: z.string().optional(),
  registradoPor: z.string().optional(),
})

router.use(requireAdmin)

router.get('/', async (req, res, next) => {
  const { q, estado } = req.query
  try {
    const filters: string[] = []
    const values: unknown[] = []

    if (typeof q === 'string' && q.trim()) {
      values.push(`%${q.trim().toLowerCase()}%`)
      filters.push(`(LOWER(rt.codigo) LIKE $${values.length} OR LOWER(c.nombre) LIKE $${values.length})`)
    }
    if (estado && statusEnum.options.includes(estado as any)) {
      values.push(estado)
      filters.push(`rt.estado = $${values.length}`)
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

    const result = await pool.query(
      `
        SELECT
          rt.id,
          rt.codigo,
          rt.estado,
          rt.marca,
          rt.modelo,
          rt.dispositivo_tipo AS "dispositivoTipo",
          rt.motivo_ingreso AS "motivoIngreso",
          rt.responsable,
          rt.created_at AS "createdAt",
          c.id AS "clienteId",
          c.nombre AS "clienteNombre",
          rt.costo_estimado AS "costoEstimado",
          rt.costo_final AS "costoFinal"
        FROM repair_tickets rt
        INNER JOIN clients c ON c.id = rt.cliente_id
        ${where}
        ORDER BY rt.created_at DESC
        LIMIT 100
      `,
      values,
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const repair = await fetchRepair(id)
    if (!repair) {
      return res.status(404).json({ message: 'Reparación no encontrada' })
    }
    const updates = await fetchUpdates(id)
    res.json({ ...repair, updates })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const data = repairCreateSchema.parse(req.body)
    await client.query('BEGIN')

    const clienteId = data.clientId ?? (await createClientFromPayload(client, data.client!))
    const codigo = await generateRepairCode(client)

    const inserted = await client.query(
      `
        INSERT INTO repair_tickets
          (codigo, cliente_id, dispositivo_tipo, marca, modelo, referencia, color, serie, motivo_ingreso,
           diagnostico, accesorios, estado, costo_estimado, costo_final, responsable, notas)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *
      `,
      [
        codigo,
        clienteId,
        data.dispositivoTipo ?? null,
        data.marca ?? null,
        data.modelo ?? null,
        data.referencia ?? null,
        data.color ?? null,
        data.serie ?? null,
        data.motivoIngreso,
        data.diagnostico ?? null,
        data.accesorios ?? null,
        data.estado ?? 'ingresado',
        data.costoEstimado ?? 0,
        data.costoFinal ?? 0,
        data.responsable ?? null,
        data.notas ?? null,
      ],
    )

    await client.query(
      `
        INSERT INTO repair_updates (repair_id, estado, comentario, registrado_por)
        VALUES ($1, $2, $3, $4)
      `,
      [
        inserted.rows[0].id,
        data.estado ?? 'ingresado',
        data.notas ?? 'Ingreso',
        data.responsable ?? 'Sistema',
      ],
    )

    await client.query('COMMIT')
    const repair = await fetchRepair(inserted.rows[0].id)
    const updates = await fetchUpdates(inserted.rows[0].id)
    res.status(201).json({ ...repair!, updates })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const data = repairUpdateSchema.parse(req.body)
    const fields: string[] = []
    const values: unknown[] = []

    const push = (column: string, value: unknown) => {
      fields.push(`${column} = $${fields.length + 1}`)
      values.push(value)
    }

    Object.entries({
      dispositivo_tipo: data.dispositivoTipo,
      marca: data.marca,
      modelo: data.modelo,
      referencia: data.referencia,
      color: data.color,
      serie: data.serie,
      motivo_ingreso: data.motivoIngreso,
      diagnostico: data.diagnostico,
      accesorios: data.accesorios,
      estado: data.estado,
      costo_estimado: data.costoEstimado,
      costo_final: data.costoFinal,
      responsable: data.responsable,
      notas: data.notas,
    }).forEach(([column, value]) => {
      if (value !== undefined) push(column, value)
    })

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No hay datos para actualizar' })
    }

    values.push(id)
    const result = await pool.query(
      `
        UPDATE repair_tickets
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *
      `,
      values,
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Reparación no encontrada' })
    }

    const repair = await fetchRepair(id)
    const updates = await fetchUpdates(id)
    res.json({ ...repair!, updates })
  } catch (error) {
    next(error)
  }
})

router.post('/:id/updates', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const data = progressSchema.parse(req.body)
    const repair = await fetchRepair(id)
    if (!repair) {
      return res.status(404).json({ message: 'Reparación no encontrada' })
    }

    await pool.query('BEGIN')
    await pool.query('UPDATE repair_tickets SET estado = $2, updated_at = NOW() WHERE id = $1', [id, data.estado])
    const result = await pool.query(
      `
        INSERT INTO repair_updates (repair_id, estado, comentario, registrado_por)
        VALUES ($1,$2,$3,$4)
        RETURNING id, repair_id AS "repairId", estado, comentario, registrado_por AS "registradoPor", created_at AS "createdAt"
      `,
      [id, data.estado, data.comentario ?? null, data.registradoPor ?? null],
    )
    await pool.query('COMMIT')
    res.status(201).json(result.rows[0])
  } catch (error) {
    await pool.query('ROLLBACK')
    next(error)
  }
})

router.get('/:id/sticker', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const repair = await fetchRepair(id)
    if (!repair) {
      return res.status(404).json({ message: 'Reparación no encontrada' })
    }

    const pdf = await createRepairSticker({
      codigo: repair.codigo,
      clienteNombre: repair.cliente.nombre,
      dispositivo: [repair.marca, repair.modelo].filter(Boolean).join(' ') || repair.dispositivoTipo || 'Equipo',
      motivo: repair.motivoIngreso ?? 'Servicio',
      fecha: repair.createdAt,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename=sticker-${repair.codigo}.pdf`)
    res.send(pdf)
  } catch (error) {
    next(error)
  }
})

export default router

type RepairRecord = {
  id: number
  codigo: string
  estado: string
  dispositivoTipo: string | null
  marca: string | null
  modelo: string | null
  referencia: string | null
  color: string | null
  serie: string | null
  motivoIngreso: string | null
  diagnostico: string | null
  accesorios: string | null
  costoEstimado: number
  costoFinal: number
  responsable: string | null
  notas: string | null
  createdAt: Date
  updatedAt: Date
  cliente: {
    id: number
    nombre: string
    documento: string | null
    telefono: string | null
    email: string | null
  }
}

type RepairUpdateRecord = {
  id: number
  estado: string
  comentario: string | null
  registradoPor: string | null
  createdAt: Date
}

async function fetchRepair(id: number): Promise<RepairRecord | null> {
  const result = await pool.query(
    `
      SELECT
        rt.id,
        rt.codigo,
        rt.estado,
        rt.dispositivo_tipo AS "dispositivoTipo",
        rt.marca,
        rt.modelo,
        rt.referencia,
        rt.color,
        rt.serie,
        rt.motivo_ingreso AS "motivoIngreso",
        rt.diagnostico,
        rt.accesorios,
        rt.costo_estimado AS "costoEstimado",
        rt.costo_final AS "costoFinal",
        rt.responsable,
        rt.notas,
        rt.created_at AS "createdAt",
        rt.updated_at AS "updatedAt",
        c.id AS "clienteId",
        c.nombre AS "clienteNombre",
        c.documento AS "clienteDocumento",
        c.telefono AS "clienteTelefono",
        c.email AS "clienteEmail"
      FROM repair_tickets rt
      INNER JOIN clients c ON c.id = rt.cliente_id
      WHERE rt.id = $1
    `,
    [id],
  )

  if (result.rowCount === 0) return null
  const row = result.rows[0]
  return {
    id: row.id,
    codigo: row.codigo,
    estado: row.estado,
    dispositivoTipo: row.dispositivoTipo,
    marca: row.marca,
    modelo: row.modelo,
    referencia: row.referencia,
    color: row.color,
    serie: row.serie,
    motivoIngreso: row.motivoIngreso,
    diagnostico: row.diagnostico,
    accesorios: row.accesorios,
    costoEstimado: Number(row.costoEstimado ?? 0),
    costoFinal: Number(row.costoFinal ?? 0),
    responsable: row.responsable,
    notas: row.notas,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    cliente: {
      id: row.clienteId,
      nombre: row.clienteNombre,
      documento: row.clienteDocumento,
      telefono: row.clienteTelefono,
      email: row.clienteEmail,
    },
  }
}

async function fetchUpdates(id: number): Promise<RepairUpdateRecord[]> {
  const updates = await pool.query(
    `
      SELECT
        id,
        estado,
        comentario,
        registrado_por AS "registradoPor",
        created_at AS "createdAt"
      FROM repair_updates
      WHERE repair_id = $1
      ORDER BY created_at DESC
    `,
    [id],
  )
  return updates.rows
}

async function createClientFromPayload(conn: PoolClient, payload: z.infer<typeof clientSchema>) {
  const result = await conn.query(
    `
      INSERT INTO clients (nombre, documento, telefono, email, direccion, notas)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
    `,
    [
      payload.nombre.trim(),
      payload.documento?.trim() ?? null,
      payload.telefono?.trim() ?? null,
      payload.email?.trim() ?? null,
      payload.direccion?.trim() ?? null,
      payload.notas ?? null,
    ],
  )
  return result.rows[0].id as number
}

async function generateRepairCode(conn: PoolClient) {
  const result = await conn.query<{ seq: string }>(`SELECT LPAD(nextval('repair_ticket_seq')::text, 4, '0') AS seq`)
  const now = new Date()
  const code = `RPR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(
    2,
    '0',
  )}-${result.rows[0].seq}`
  return code
}
