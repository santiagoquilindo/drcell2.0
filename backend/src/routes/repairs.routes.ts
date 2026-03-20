import type { DatabaseError, PoolClient } from 'pg'
import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import crypto from 'node:crypto'

import { pool } from '../config/database.js'
import { env } from '../config/env.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { createRepairSticker } from '../lib/createRepairSticker.js'

const router = Router()

const statusEnum = z.enum(['ingresado', 'diagnostico', 'en_proceso', 'listo', 'entregado'])

const clientSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  documento: z.string().trim().max(40).optional(),
  telefono: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(120).optional(),
  direccion: z.string().trim().max(200).optional(),
  notas: z.string().trim().max(1000).optional(),
})

const repairCreateSchema = z
  .object({
    clientId: z.number().int().positive().optional(),
    client: clientSchema.optional(),
    dispositivoTipo: z.string().trim().max(80).optional(),
    marca: z.string().trim().max(80).optional(),
    modelo: z.string().trim().max(120).optional(),
    referencia: z.string().trim().max(120).optional(),
    color: z.string().trim().max(40).optional(),
    serie: z.string().trim().max(120).optional(),
    motivoIngreso: z.string().trim().min(1).max(1500),
    diagnostico: z.string().trim().max(1500).optional(),
    accesorios: z.string().trim().max(500).optional(),
    estado: statusEnum.optional(),
    costoEstimado: z.coerce.number().min(0).max(999999999).optional(),
    manoObra: z.coerce.number().min(0).max(999999999).optional(),
    costoFinal: z.coerce.number().min(0).max(999999999).optional(),
    responsable: z.string().trim().max(120).optional(),
    notas: z.string().trim().max(1500).optional(),
  })
  .refine((data) => data.clientId || data.client, {
    message: 'Debes seleccionar o crear un cliente',
    path: ['clientId'],
  })

const repairUpdateSchema = z
  .object({
    dispositivoTipo: z.string().trim().max(80).optional(),
    marca: z.string().trim().max(80).optional(),
    modelo: z.string().trim().max(120).optional(),
    referencia: z.string().trim().max(120).optional(),
    color: z.string().trim().max(40).optional(),
    serie: z.string().trim().max(120).optional(),
    motivoIngreso: z.string().trim().min(1).max(1500).optional(),
    diagnostico: z.string().trim().max(1500).optional(),
    accesorios: z.string().trim().max(500).optional(),
    estado: statusEnum.optional(),
    costoEstimado: z.coerce.number().min(0).max(999999999).optional(),
    manoObra: z.coerce.number().min(0).max(999999999).optional(),
    costoFinal: z.coerce.number().min(0).max(999999999).optional(),
    responsable: z.string().trim().max(120).optional(),
    notas: z.string().trim().max(1500).optional(),
    client: clientSchema.partial().optional(),
  })
  .refine(
    (data) =>
      [
        data.dispositivoTipo,
        data.marca,
        data.modelo,
        data.referencia,
        data.color,
        data.serie,
        data.motivoIngreso,
        data.diagnostico,
        data.accesorios,
        data.estado,
        data.costoEstimado,
        data.manoObra,
        data.costoFinal,
        data.responsable,
        data.notas,
        data.client,
      ].some((value) => value !== undefined),
    {
      message: 'No hay datos para actualizar',
    },
  )

const progressSchema = z.object({
  estado: statusEnum,
  comentario: z.string().trim().max(1000).optional(),
  registradoPor: z.string().trim().max(120).optional(),
})

const repairPartStatusEnum = z.enum(['consumido', 'revertido'])

const repairPartCreateSchema = z.object({
  inventoryItemId: z.number().int().positive(),
  cantidad: z.coerce.number().positive().max(999999999),
  notas: z.string().trim().max(1000).optional(),
})

const trackingLookupSchema = z.object({
  code: z.string().trim().min(6).max(32),
  verifier: z.string().trim().min(4).max(12),
})

router.get('/public/:code', async (_req, res) => {
  res.status(400).json({ message: 'Debes consultar el ticket con codigo y verificacion.' })
})

router.post('/public/lookup', async (req, res, next) => {
  try {
    const { code, verifier } = trackingLookupSchema.parse(req.body)
    const repair = await fetchRepairByCode(code)
    if (!repair) {
      return res.status(404).json({ message: 'Reparacion no encontrada' })
    }

    if (!matchesTrackingVerifier(repair, verifier)) {
      return res.status(403).json({ message: 'Verificacion invalida para este ticket' })
    }

    const updates = await fetchUpdates(repair.id)
    res.json(mapRepairTrackingResponse(repair, updates))
  } catch (error) {
    next(error)
  }
})

router.use(requireAdmin)

router.get('/', async (req, res, next) => {
  const { q, estado } = req.query
  try {
    const filters: string[] = []
    const values: unknown[] = []

    if (typeof q === 'string' && q.trim()) {
      values.push(`%${q.trim().toLowerCase()}%`)
      filters.push(
        `(LOWER(rt.codigo) LIKE $${values.length} OR LOWER(c.nombre) LIKE $${values.length} OR LOWER(coalesce(rt.marca, '')) LIKE $${values.length} OR LOWER(coalesce(rt.modelo, '')) LIKE $${values.length})`,
      )
    }

    if (estado && statusEnum.options.includes(estado as (typeof statusEnum.options)[number])) {
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
          rt.updated_at AS "updatedAt",
          rt.mano_obra AS "manoObra",
          COALESCE(parts.subtotal_repuestos, 0) AS "subtotalRepuestos",
          (COALESCE(rt.mano_obra, 0) + COALESCE(parts.subtotal_repuestos, 0)) AS "costoFinal",
          c.id AS "clienteId",
          c.nombre AS "clienteNombre",
          c.telefono AS "clienteTelefono",
          rt.costo_estimado AS "costoEstimado"
        FROM repair_tickets rt
        INNER JOIN clients c ON c.id = rt.cliente_id
        LEFT JOIN (
          SELECT
            repair_id,
            COALESCE(SUM(cantidad * precio_unitario_referencial), 0) AS subtotal_repuestos
          FROM repair_parts
          WHERE estado = 'consumido'
          GROUP BY repair_id
        ) parts ON parts.repair_id = rt.id
        ${where}
        ORDER BY rt.updated_at DESC, rt.created_at DESC
        LIMIT 100
      `,
      values,
    )

    res.json(
      result.rows.map((row) => ({
        ...row,
        costoEstimado: Number(row.costoEstimado ?? 0),
        manoObra: Number(row.manoObra ?? 0),
        subtotalRepuestos: Number(row.subtotalRepuestos ?? 0),
        costoFinal: Number(row.costoFinal ?? 0),
      })),
    )
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const repair = await fetchRepair(id)
    if (!repair) {
      return res.status(404).json({ message: 'Reparacion no encontrada' })
    }

    const updates = await fetchUpdates(id)
    const parts = await fetchParts(id)
    res.json({ ...repair, updates, parts })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const data = repairCreateSchema.parse(req.body)
    await client.query('BEGIN')
    transactionStarted = true

    const clienteId = data.clientId ?? (await createClientFromPayload(client, data.client!))
    const codigo = await generateRepairCode(client)
    const manoObra = resolveRepairManualLabor({ inputManoObra: data.manoObra, legacyCostoFinal: data.costoFinal, subtotalRepuestos: 0 })
    const costoFinal = manoObra

    const inserted = await client.query(
      `
        INSERT INTO repair_tickets
          (codigo, cliente_id, dispositivo_tipo, marca, modelo, referencia, color, serie, motivo_ingreso,
           diagnostico, accesorios, estado, costo_estimado, mano_obra, costo_final, responsable, notas)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id
      `,
      [
        codigo,
        clienteId,
        asNullable(data.dispositivoTipo),
        asNullable(data.marca),
        asNullable(data.modelo),
        asNullable(data.referencia),
        asNullable(data.color),
        asNullable(data.serie),
        data.motivoIngreso.trim(),
        asNullable(data.diagnostico),
        asNullable(data.accesorios),
        data.estado ?? 'ingresado',
        data.costoEstimado ?? 0,
        manoObra,
        costoFinal,
        asNullable(data.responsable),
        asNullable(data.notas),
      ],
    )

    await client.query(
      `
        INSERT INTO repair_updates (repair_id, estado, comentario, registrado_por)
        VALUES ($1, $2, $3, $4)
      `,
      [inserted.rows[0].id, data.estado ?? 'ingresado', data.notas ?? 'Ingreso inicial', data.responsable ?? 'Sistema'],
    )

    await client.query('COMMIT')
    const repair = await fetchRepair(inserted.rows[0].id)
    const updates = await fetchUpdates(inserted.rows[0].id)
    const parts = await fetchParts(inserted.rows[0].id)
    res.status(201).json({ ...repair!, updates, parts })
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK')
    }
    const knownError = handleRepairMutationError(error, res)
    if (knownError) return
    next(error)
  } finally {
    client.release()
  }
})

router.patch('/:id', async (req, res, next) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const data = repairUpdateSchema.parse(req.body)
    const current = await fetchRepair(id)
    if (!current) {
      return res.status(404).json({ message: 'Reparacion no encontrada' })
    }

    if (
      current.estado === 'entregado' &&
      [data.costoEstimado, data.manoObra, data.costoFinal].some((value) => value !== undefined)
    ) {
      return res.status(409).json({ message: 'No puedes cambiar valores economicos en una reparacion entregada' })
    }

    await client.query('BEGIN')
    transactionStarted = true

    const fields: string[] = []
    const values: unknown[] = []

    const push = (column: string, value: unknown) => {
      fields.push(`${column} = $${values.length + 1}`)
      values.push(value)
    }

    const ticketFields: Record<string, unknown> = {
      dispositivo_tipo: asNullable(data.dispositivoTipo),
      marca: asNullable(data.marca),
      modelo: asNullable(data.modelo),
      referencia: asNullable(data.referencia),
      color: asNullable(data.color),
      serie: asNullable(data.serie),
      motivo_ingreso: data.motivoIngreso?.trim(),
      diagnostico: asNullable(data.diagnostico),
      accesorios: asNullable(data.accesorios),
      estado: data.estado,
      costo_estimado: data.costoEstimado,
      responsable: asNullable(data.responsable),
      notas: asNullable(data.notas),
    }

    Object.entries(ticketFields).forEach(([column, value]) => {
      if (value !== undefined) push(column, value)
    })

    if (fields.length > 0) {
      values.push(id)
      await client.query(
        `
          UPDATE repair_tickets
          SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${values.length}
        `,
        values,
      )
    }

    const nextManualLabor = resolveRepairManualLabor({
      inputManoObra: data.manoObra,
      legacyCostoFinal: data.costoFinal,
      subtotalRepuestos: current.subtotalRepuestos,
      currentManoObra: current.manoObra,
    })

    if (nextManualLabor !== current.manoObra) {
      await client.query('UPDATE repair_tickets SET mano_obra = $2, updated_at = NOW() WHERE id = $1', [id, nextManualLabor])
    }

    if (data.client) {
      const clientFields: string[] = []
      const clientValues: unknown[] = []
      const pushClient = (column: string, value: unknown) => {
        clientFields.push(`${column} = $${clientValues.length + 1}`)
        clientValues.push(value)
      }

      Object.entries({
        nombre: data.client.nombre?.trim(),
        documento: asNullable(data.client.documento),
        telefono: asNullable(data.client.telefono),
        email: asNullable(data.client.email),
        direccion: asNullable(data.client.direccion),
        notas: asNullable(data.client.notas),
      }).forEach(([column, value]) => {
        if (value !== undefined) pushClient(column, value)
      })

      if (clientFields.length > 0) {
        clientValues.push(current.cliente.id)
        await client.query(
          `
            UPDATE clients
            SET ${clientFields.join(', ')}
            WHERE id = $${clientValues.length}
          `,
          clientValues,
        )
      }
    }

    if (data.estado && data.estado !== current.estado) {
      await client.query(
        `
          INSERT INTO repair_updates (repair_id, estado, comentario, registrado_por)
          VALUES ($1, $2, $3, $4)
        `,
        [id, data.estado, 'Estado actualizado desde la edicion', data.responsable ?? current.responsable ?? 'Administrador'],
      )
    }

    await syncRepairFinancialTotals(client, id)

    await client.query('COMMIT')
    const repair = await fetchRepair(id)
    const updates = await fetchUpdates(id)
    const parts = await fetchParts(id)
    res.json({ ...repair!, updates, parts })
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK')
    }
    const knownError = handleRepairMutationError(error, res)
    if (knownError) return
    next(error)
  } finally {
    client.release()
  }
})

router.post('/:id/updates', async (req, res, next) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const data = progressSchema.parse(req.body)
    const repair = await fetchRepair(id)
    if (!repair) {
      return res.status(404).json({ message: 'Reparacion no encontrada' })
    }
    if (repair.estado === data.estado) {
      return res.status(409).json({ message: 'La reparacion ya se encuentra en ese estado' })
    }

    await client.query('BEGIN')
    transactionStarted = true
    await client.query('UPDATE repair_tickets SET estado = $2, updated_at = NOW() WHERE id = $1', [id, data.estado])
    const result = await client.query(
      `
        INSERT INTO repair_updates (repair_id, estado, comentario, registrado_por)
        VALUES ($1,$2,$3,$4)
        RETURNING id, repair_id AS "repairId", estado, comentario, registrado_por AS "registradoPor", created_at AS "createdAt"
      `,
      [id, data.estado, asNullable(data.comentario), asNullable(data.registradoPor)],
    )
    await client.query('COMMIT')
    res.status(201).json(result.rows[0])
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK')
    }
    next(error)
  } finally {
    client.release()
  }
})

router.post('/:id/parts', async (req, res, next) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const repairId = Number(req.params.id)
    if (!Number.isInteger(repairId)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const data = repairPartCreateSchema.parse(req.body)
    const repair = await fetchRepair(repairId)
    if (!repair) {
      return res.status(404).json({ message: 'Reparacion no encontrada' })
    }

    if (repair.estado === 'entregado') {
      return res.status(409).json({ message: 'No puedes consumir repuestos en una reparacion entregada' })
    }

    await client.query('BEGIN')
    transactionStarted = true

    const inventoryUpdate = await applyRepairPartConsumption(client, {
      itemId: data.inventoryItemId,
      cantidad: data.cantidad,
      referencia: repair.codigo,
      notas: data.notas ?? null,
      adminUserId: req.admin?.adminId ?? null,
    })

    const inserted = await client.query(
      `
        INSERT INTO repair_parts
          (repair_id, inventory_item_id, item_nombre, item_sku, cantidad, costo_unitario_referencial,
           precio_unitario_referencial, estado, notas, inventory_movement_id, created_by_admin_user_id)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,'consumido',$8,$9,$10)
        RETURNING id
      `,
      [
        repairId,
        data.inventoryItemId,
        inventoryUpdate.itemNombre,
        inventoryUpdate.itemSku,
        data.cantidad,
        inventoryUpdate.costoUnitarioReferencial,
        inventoryUpdate.precioUnitarioReferencial,
        data.notas ?? null,
        inventoryUpdate.movementId,
        req.admin?.adminId ?? null,
      ],
    )

    await syncRepairFinancialTotals(client, repairId)

    await client.query('COMMIT')
    const parts = await fetchParts(repairId)
    res.status(201).json(parts.find((part) => part.id === inserted.rows[0].id) ?? null)
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK')
    }
    const knownError = handleRepairMutationError(error, res)
    if (knownError) return
    next(error)
  } finally {
    client.release()
  }
})

router.post('/:id/parts/:partId/revert', async (req, res, next) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const repairId = Number(req.params.id)
    const partId = Number(req.params.partId)
    if (!Number.isInteger(repairId) || !Number.isInteger(partId)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const repair = await fetchRepair(repairId)
    if (!repair) {
      return res.status(404).json({ message: 'Reparacion no encontrada' })
    }

    if (repair.estado === 'entregado') {
      return res.status(409).json({ message: 'No puedes revertir repuestos en una reparacion entregada' })
    }

    await client.query('BEGIN')
    transactionStarted = true

    const partResult = await client.query<{
      id: number
      inventoryItemId: number
      cantidad: string
      estado: z.infer<typeof repairPartStatusEnum>
      itemNombre: string
      itemSku: string
    }>(
      `
        SELECT
          id,
          inventory_item_id AS "inventoryItemId",
          cantidad,
          estado,
          item_nombre AS "itemNombre",
          item_sku AS "itemSku"
        FROM repair_parts
        WHERE id = $1 AND repair_id = $2
        FOR UPDATE
      `,
      [partId, repairId],
    )

    if (partResult.rowCount === 0) {
      return res.status(404).json({ message: 'Consumo de repuesto no encontrado' })
    }

    const part = partResult.rows[0]
    if (part.estado === 'revertido') {
      return res.status(409).json({ message: 'Ese consumo ya fue revertido' })
    }

    const reversalMovementId = await revertRepairPartConsumption(client, {
      itemId: part.inventoryItemId,
      cantidad: Number(part.cantidad),
      referencia: repair.codigo,
      itemNombre: part.itemNombre,
      adminUserId: req.admin?.adminId ?? null,
    })

    await client.query(
      `
        UPDATE repair_parts
        SET estado = 'revertido',
            reversal_movement_id = $2,
            reverted_by_admin_user_id = $3,
            reverted_at = NOW()
        WHERE id = $1
      `,
      [partId, reversalMovementId, req.admin?.adminId ?? null],
    )

    await syncRepairFinancialTotals(client, repairId)

    await client.query('COMMIT')
    const parts = await fetchParts(repairId)
    res.json(parts.find((row) => row.id === partId) ?? null)
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK')
    }
    const knownError = handleRepairMutationError(error, res)
    if (knownError) return
    next(error)
  } finally {
    client.release()
  }
})

router.get('/:id/sticker', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const repair = await fetchRepair(id)
    if (!repair) {
      return res.status(404).json({ message: 'Reparacion no encontrada' })
    }

    const trackingVerifier = getTrackingVerifier(repair)
    const trackingUrl = trackingVerifier
      ? buildTrackingUrl(repair.codigo, trackingVerifier)
      : undefined

    const pdf = await createRepairSticker({
      codigo: repair.codigo,
      clienteNombre: repair.cliente.nombre,
      dispositivo: [repair.marca, repair.modelo].filter(Boolean).join(' ') || repair.dispositivoTipo || 'Equipo',
      motivo: repair.motivoIngreso ?? 'Servicio',
      fecha: repair.createdAt,
      trackingUrl,
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
  estado: RepairStatus
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
  manoObra: number
  subtotalRepuestos: number
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
    direccion: string | null
    notas: string | null
  }
}

type RepairUpdateRecord = {
  id: number
  estado: RepairStatus
  comentario: string | null
  registradoPor: string | null
  createdAt: Date
}

type RepairPartRecord = {
  id: number
  repairId: number
  inventoryItemId: number
  itemNombre: string
  itemSku: string
  cantidad: number
  costoUnitarioReferencial: number
  precioUnitarioReferencial: number
  estado: z.infer<typeof repairPartStatusEnum>
  notas: string | null
  inventoryMovementId: number | null
  reversalMovementId: number | null
  createdByAdminUserId: number | null
  revertedByAdminUserId: number | null
  createdAt: Date
  revertedAt: Date | null
}

type RepairStatus = z.infer<typeof statusEnum>

async function fetchRepair(id: number): Promise<RepairRecord | null> {
  return fetchRepairByCondition('rt.id = $1', [id])
}

async function fetchRepairByCode(code: string): Promise<RepairRecord | null> {
  return fetchRepairByCondition('UPPER(rt.codigo) = $1', [code.toUpperCase()])
}

async function fetchRepairByCondition(where: string, values: unknown[]): Promise<RepairRecord | null> {
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
        rt.mano_obra AS "manoObra",
        COALESCE(parts.subtotal_repuestos, 0) AS "subtotalRepuestos",
        (COALESCE(rt.mano_obra, 0) + COALESCE(parts.subtotal_repuestos, 0)) AS "costoFinal",
        rt.responsable,
        rt.notas,
        rt.created_at AS "createdAt",
        rt.updated_at AS "updatedAt",
        c.id AS "clienteId",
        c.nombre AS "clienteNombre",
        c.documento AS "clienteDocumento",
        c.telefono AS "clienteTelefono",
        c.email AS "clienteEmail",
        c.direccion AS "clienteDireccion",
        c.notas AS "clienteNotas"
      FROM repair_tickets rt
      INNER JOIN clients c ON c.id = rt.cliente_id
      LEFT JOIN (
        SELECT
          repair_id,
          COALESCE(SUM(cantidad * precio_unitario_referencial), 0) AS subtotal_repuestos
        FROM repair_parts
        WHERE estado = 'consumido'
        GROUP BY repair_id
      ) parts ON parts.repair_id = rt.id
      WHERE ${where}
    `,
    values,
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
    manoObra: Number(row.manoObra ?? 0),
    subtotalRepuestos: Number(row.subtotalRepuestos ?? 0),
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
      direccion: row.clienteDireccion,
      notas: row.clienteNotas,
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
      ORDER BY created_at DESC, id DESC
    `,
    [id],
  )
  return updates.rows
}

async function fetchParts(id: number): Promise<RepairPartRecord[]> {
  const result = await pool.query(
    `
      SELECT
        id,
        repair_id AS "repairId",
        inventory_item_id AS "inventoryItemId",
        item_nombre AS "itemNombre",
        item_sku AS "itemSku",
        cantidad,
        costo_unitario_referencial AS "costoUnitarioReferencial",
        precio_unitario_referencial AS "precioUnitarioReferencial",
        estado,
        notas,
        inventory_movement_id AS "inventoryMovementId",
        reversal_movement_id AS "reversalMovementId",
        created_by_admin_user_id AS "createdByAdminUserId",
        reverted_by_admin_user_id AS "revertedByAdminUserId",
        created_at AS "createdAt",
        reverted_at AS "revertedAt"
      FROM repair_parts
      WHERE repair_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [id],
  )

  return result.rows.map((row) => ({
    ...row,
    cantidad: Number(row.cantidad ?? 0),
    costoUnitarioReferencial: Number(row.costoUnitarioReferencial ?? 0),
    precioUnitarioReferencial: Number(row.precioUnitarioReferencial ?? 0),
  }))
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
      asNullable(payload.documento),
      asNullable(payload.telefono),
      asNullable(payload.email),
      asNullable(payload.direccion),
      asNullable(payload.notas),
    ],
  )
  return result.rows[0].id as number
}

async function generateRepairCode(conn: PoolClient) {
  const result = await conn.query<{ seq: string }>(`SELECT LPAD(nextval('repair_ticket_seq')::text, 4, '0') AS seq`)
  const now = new Date()
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase()
  return `RPR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(
    2,
    '0',
  )}-${result.rows[0].seq}-${suffix}`
}

function mapRepairTrackingResponse(repair: RepairRecord, updates: RepairUpdateRecord[]) {
  return {
    codigo: repair.codigo,
    estado: repair.estado,
    dispositivo: [repair.marca, repair.modelo].filter(Boolean).join(' ') || repair.dispositivoTipo || 'Equipo',
    motivoIngreso: repair.motivoIngreso,
    diagnostico: repair.diagnostico,
    accesorios: repair.accesorios,
    createdAt: repair.createdAt,
    updatedAt: repair.updatedAt,
    updates: updates.map((update) => ({
      id: update.id,
      estado: update.estado,
      comentario: update.comentario,
      createdAt: update.createdAt,
    })),
  }
}

function asNullable(value?: string | null) {
  if (value === undefined) return undefined
  if (value === null) return null

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function handleRepairMutationError(error: unknown, res: Response) {
  const databaseError = error as DatabaseError | undefined
  if (databaseError?.code === '23505') {
    return res.status(409).json({ message: 'Ya existe un cliente con ese documento' })
  }

  if (
    error instanceof Error &&
    [
      'El item de inventario seleccionado no existe',
      'Solo puedes consumir items de inventario activos',
      'El item de inventario no tiene stock suficiente para esta reparacion',
      'No puedes cambiar valores economicos en una reparacion entregada',
    ].includes(error.message)
  ) {
    return res.status(400).json({ message: error.message })
  }

  return null
}

function matchesTrackingVerifier(repair: RepairRecord, verifier: string) {
  const normalizedVerifier = verifier.trim().toLowerCase()
  if (!normalizedVerifier) return false

  const allowedVerifiers = [repair.cliente.documento, repair.cliente.telefono]
    .map((value) => value?.replace(/\D/g, '').slice(-4) ?? null)
    .filter((value): value is string => Boolean(value))

  return allowedVerifiers.includes(normalizedVerifier)
}

function getTrackingVerifier(repair: RepairRecord) {
  return repair.cliente.documento?.replace(/\D/g, '').slice(-4) || repair.cliente.telefono?.replace(/\D/g, '').slice(-4) || null
}

function buildTrackingUrl(code: string, verifier: string) {
  const base = env.PUBLIC_APP_URL ?? 'http://localhost:5178'
  const url = new URL('/seguimiento', base)
  url.searchParams.set('ticket', code)
  url.searchParams.set('verifier', verifier)
  return url.toString()
}

async function applyRepairPartConsumption(
  client: PoolClient,
  input: {
    itemId: number
    cantidad: number
    referencia: string
    notas: string | null
    adminUserId: number | null
  },
) {
  const itemResult = await client.query<{
    nombre: string
    sku: string
    stockActual: string
    costoCompra: string
    precioVenta: string
    permiteStockNegativo: boolean
    estado: string
  }>(
    `
      SELECT
        nombre,
        sku,
        stock_actual AS "stockActual",
        costo_compra AS "costoCompra",
        precio_venta AS "precioVenta",
        permite_stock_negativo AS "permiteStockNegativo",
        estado
      FROM inventario_items
      WHERE id = $1
      FOR UPDATE
    `,
    [input.itemId],
  )

  if (itemResult.rowCount === 0) {
    throw new Error('El item de inventario seleccionado no existe')
  }

  const item = itemResult.rows[0]
  if (item.estado !== 'activo') {
    throw new Error('Solo puedes consumir items de inventario activos')
  }

  const stockAntes = Number(item.stockActual)
  const stockDespues = stockAntes - input.cantidad
  if (stockDespues < 0 && !item.permiteStockNegativo) {
    throw new Error('El item de inventario no tiene stock suficiente para esta reparacion')
  }

  await client.query('UPDATE inventario_items SET stock_actual = $2, updated_at = NOW() WHERE id = $1', [input.itemId, stockDespues])
  const movementResult = await client.query<{ id: number }>(
    `
      INSERT INTO inventario_movimientos
        (item_id, tipo_movimiento, cantidad, motivo, referencia, observaciones, stock_antes, stock_despues, admin_user_id)
      VALUES
        ($1, 'consumo_reparacion', $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    [
      input.itemId,
      input.cantidad,
      'Consumo de repuesto en reparacion',
      input.referencia,
      input.notas ?? 'Movimiento automatico generado desde reparaciones',
      stockAntes,
      stockDespues,
      input.adminUserId,
    ],
  )

  return {
    movementId: movementResult.rows[0].id,
    itemNombre: item.nombre,
    itemSku: item.sku,
    costoUnitarioReferencial: Number(item.costoCompra ?? 0),
    precioUnitarioReferencial: Number(item.precioVenta ?? 0),
  }
}

async function revertRepairPartConsumption(
  client: PoolClient,
  input: {
    itemId: number
    cantidad: number
    referencia: string
    itemNombre: string
    adminUserId: number | null
  },
) {
  const itemResult = await client.query<{ stockActual: string }>(
    `
      SELECT stock_actual AS "stockActual"
      FROM inventario_items
      WHERE id = $1
      FOR UPDATE
    `,
    [input.itemId],
  )

  if (itemResult.rowCount === 0) {
    throw new Error('El item de inventario seleccionado no existe')
  }

  const stockAntes = Number(itemResult.rows[0].stockActual)
  const stockDespues = stockAntes + input.cantidad

  await client.query('UPDATE inventario_items SET stock_actual = $2, updated_at = NOW() WHERE id = $1', [input.itemId, stockDespues])
  const movementResult = await client.query<{ id: number }>(
    `
      INSERT INTO inventario_movimientos
        (item_id, tipo_movimiento, cantidad, motivo, referencia, observaciones, stock_antes, stock_despues, admin_user_id)
      VALUES
        ($1, 'devolucion', $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    [
      input.itemId,
      input.cantidad,
      'Reversion de consumo de repuesto en reparacion',
      input.referencia,
      `Reposicion automatica por reversion del consumo de ${input.itemNombre}`,
      stockAntes,
      stockDespues,
      input.adminUserId,
    ],
  )

  return movementResult.rows[0].id
}

function resolveRepairManualLabor(input: {
  inputManoObra?: number
  legacyCostoFinal?: number
  subtotalRepuestos: number
  currentManoObra?: number
}) {
  if (input.inputManoObra !== undefined) {
    return input.inputManoObra
  }

  if (input.legacyCostoFinal !== undefined) {
    return Math.max(input.legacyCostoFinal - input.subtotalRepuestos, 0)
  }

  return input.currentManoObra ?? 0
}

async function syncRepairFinancialTotals(client: PoolClient, repairId: number) {
  const subtotalResult = await client.query<{ subtotalRepuestos: string; manoObra: string }>(
    `
      SELECT
        COALESCE((
          SELECT SUM(cantidad * precio_unitario_referencial)
          FROM repair_parts
          WHERE repair_id = $1
            AND estado = 'consumido'
        ), 0) AS "subtotalRepuestos",
        mano_obra AS "manoObra"
      FROM repair_tickets
      WHERE id = $1
    `,
    [repairId],
  )

  if (subtotalResult.rowCount === 0) return

  const row = subtotalResult.rows[0]
  const subtotalRepuestos = Number(row.subtotalRepuestos ?? 0)
  const manoObra = Number(row.manoObra ?? 0)
  const costoFinal = subtotalRepuestos + manoObra

  await client.query('UPDATE repair_tickets SET costo_final = $2, updated_at = NOW() WHERE id = $1', [repairId, costoFinal])
}
