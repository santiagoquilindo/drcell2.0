import crypto from 'node:crypto'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { Router } from 'express'
import { z } from 'zod'
import type { DatabaseError } from 'pg'

import { pool } from '../config/database.js'
import { env } from '../config/env.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const categoryStatusEnum = z.enum(['activo', 'inactivo'])
const itemTypeEnum = z.enum(['repuesto', 'insumo', 'accesorio', 'producto', 'otro'])
const movementTypeEnum = z.enum(['entrada', 'salida', 'ajuste', 'consumo_reparacion', 'devolucion'])
const itemStatusEnum = z.enum(['activo', 'inactivo'])

const dataUrlImageSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value), 'La imagen debe ser PNG, JPG o WEBP')
  .refine((value) => !value || getDataUrlByteLength(value) <= 3 * 1024 * 1024, 'La imagen no puede superar 3 MB')

const categorySchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  descripcion: z.string().trim().max(400).optional(),
  estado: categoryStatusEnum.default('activo'),
})

const categoryUpdateSchema = categorySchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'No hay datos para actualizar',
})

const itemCreateSchema = z.object({
  nombre: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(60),
  descripcion: z.string().trim().max(1500).optional(),
  categoriaId: z.number().int().positive(),
  proveedorId: z.number().int().positive().nullable().optional(),
  tipo: itemTypeEnum,
  unidadMedida: z.string().trim().min(1).max(40),
  costoCompra: z.coerce.number().min(0).max(999999999),
  precioVenta: z.coerce.number().min(0).max(999999999),
  stockInicial: z.coerce.number().min(0).max(999999999).default(0),
  stockMinimo: z.coerce.number().min(0).max(999999999).default(0),
  permiteStockNegativo: z.coerce.boolean().default(false),
  estado: itemStatusEnum.default('activo'),
  imagen: dataUrlImageSchema,
})

const itemUpdateSchema = z
  .object({
    nombre: z.string().trim().min(1).max(160).optional(),
    sku: z.string().trim().min(1).max(60).optional(),
    descripcion: z.string().trim().max(1500).optional(),
    categoriaId: z.number().int().positive().optional(),
    proveedorId: z.number().int().positive().nullable().optional(),
    tipo: itemTypeEnum.optional(),
    unidadMedida: z.string().trim().min(1).max(40).optional(),
    costoCompra: z.coerce.number().min(0).max(999999999).optional(),
    precioVenta: z.coerce.number().min(0).max(999999999).optional(),
    stockMinimo: z.coerce.number().min(0).max(999999999).optional(),
    permiteStockNegativo: z.coerce.boolean().optional(),
    estado: itemStatusEnum.optional(),
    imagen: dataUrlImageSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No hay datos para actualizar',
  })

const movementCreateSchema = z
  .object({
    tipoMovimiento: movementTypeEnum,
    cantidad: z.coerce.number().positive().max(999999999).optional(),
    stockObjetivo: z.coerce.number().min(0).max(999999999).optional(),
    motivo: z.string().trim().min(1).max(200),
    referencia: z.string().trim().max(120).optional(),
    observaciones: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipoMovimiento === 'ajuste') {
      if (data.stockObjetivo === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stockObjetivo'],
          message: 'Debes indicar el stock objetivo para un ajuste',
        })
      }
      return
    }

    if (data.cantidad === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cantidad'],
        message: 'Debes indicar una cantidad valida',
      })
    }
  })

router.use(requireAdmin)

router.get('/categories', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          nombre,
          descripcion,
          estado,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM inventory_categories
        ORDER BY nombre ASC
      `,
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.post('/categories', async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body)
    const result = await pool.query(
      `
        INSERT INTO inventory_categories (nombre, descripcion, estado)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          nombre,
          descripcion,
          estado,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [data.nombre, data.descripcion ?? null, data.estado],
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

router.patch('/categories/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const data = categoryUpdateSchema.parse(req.body)
    const fields: string[] = []
    const values: unknown[] = []

    const push = (column: string, value: unknown) => {
      values.push(value)
      fields.push(`${column} = $${values.length}`)
    }

    if (data.nombre !== undefined) push('nombre', data.nombre)
    if (data.descripcion !== undefined) push('descripcion', data.descripcion ?? null)
    if (data.estado !== undefined) push('estado', data.estado)
    values.push(id)

    const result = await pool.query(
      `
        UPDATE inventory_categories
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING
          id,
          nombre,
          descripcion,
          estado,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      values,
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Categoria no encontrada' })
    }

    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

router.get('/low-stock', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          i.id,
          i.nombre,
          i.sku,
          i.tipo,
          i.unidad_medida AS "unidadMedida",
          i.stock_actual AS "stockActual",
          i.stock_minimo AS "stockMinimo",
          i.estado,
          c.id AS "categoriaId",
          c.nombre AS "categoriaNombre",
          p.id AS "proveedorId",
          p.nombre AS "proveedorNombre",
          i.updated_at AS "updatedAt",
          i.image_path AS "imagenUrl"
        FROM inventario_items i
        LEFT JOIN inventory_categories c ON c.id = i.categoria_id
        LEFT JOIN proveedores p ON p.id = i.proveedor_id
        WHERE i.estado = 'activo'
          AND i.stock_actual <= i.stock_minimo
        ORDER BY i.stock_actual ASC, i.nombre ASC
      `,
    )
    res.json(mapItemRows(result.rows))
  } catch (error) {
    next(error)
  }
})

router.get('/alerts', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          i.id,
          i.nombre,
          i.sku,
          i.tipo,
          i.unidad_medida AS "unidadMedida",
          i.stock_actual AS "stockActual",
          i.stock_minimo AS "stockMinimo",
          i.estado,
          c.id AS "categoriaId",
          c.nombre AS "categoriaNombre",
          p.id AS "proveedorId",
          p.nombre AS "proveedorNombre",
          i.updated_at AS "updatedAt",
          i.image_path AS "imagenUrl"
        FROM inventario_items i
        LEFT JOIN inventory_categories c ON c.id = i.categoria_id
        LEFT JOIN proveedores p ON p.id = i.proveedor_id
        WHERE i.estado = 'activo'
          AND i.stock_actual <= i.stock_minimo
        ORDER BY i.stock_actual ASC, i.nombre ASC
      `,
    )
    res.json(mapItemRows(result.rows))
  } catch (error) {
    next(error)
  }
})

router.get('/movements', async (req, res, next) => {
  const { itemId, tipo, from, to, q } = req.query
  try {
    const filters: string[] = []
    const values: unknown[] = []

    if (itemId) {
      const parsedId = Number(itemId)
      if (!Number.isInteger(parsedId)) {
        return res.status(400).json({ message: 'Item invalido' })
      }
      values.push(parsedId)
      filters.push(`m.item_id = $${values.length}`)
    }

    if (tipo && movementTypeEnum.options.includes(String(tipo) as z.infer<typeof movementTypeEnum>)) {
      values.push(tipo)
      filters.push(`m.tipo_movimiento = $${values.length}`)
    }

    if (typeof from === 'string' && from.trim()) {
      values.push(new Date(from))
      filters.push(`m.created_at >= $${values.length}`)
    }

    if (typeof to === 'string' && to.trim()) {
      values.push(new Date(to))
      filters.push(`m.created_at <= $${values.length}`)
    }

    if (typeof q === 'string' && q.trim()) {
      values.push(`%${q.trim().toLowerCase()}%`)
      filters.push(
        `(LOWER(i.nombre) LIKE $${values.length} OR LOWER(i.sku) LIKE $${values.length} OR LOWER(COALESCE(m.referencia, '')) LIKE $${values.length})`,
      )
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const result = await pool.query(
      `
        SELECT
          m.id,
          m.item_id AS "itemId",
          i.nombre AS "itemNombre",
          i.sku AS "itemSku",
          m.tipo_movimiento AS "tipoMovimiento",
          m.cantidad,
          m.motivo,
          m.referencia,
          m.observaciones,
          m.stock_antes AS "stockAntes",
          m.stock_despues AS "stockDespues",
          m.admin_user_id AS "adminUserId",
          au.name AS "usuarioResponsable",
          m.created_at AS "createdAt"
        FROM inventario_movimientos m
        INNER JOIN inventario_items i ON i.id = m.item_id
        LEFT JOIN admin_users au ON au.id = m.admin_user_id
        ${where}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 200
      `,
      values,
    )
    res.json(mapMovementRows(result.rows))
  } catch (error) {
    next(error)
  }
})

router.get('/items/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const item = await fetchItemDetail(id)
    if (!item) {
      return res.status(404).json({ message: 'Item no encontrado' })
    }

    const movements = await fetchItemMovements(id)
    res.json({ ...item, movements })
  } catch (error) {
    next(error)
  }
})

router.get('/items', async (req, res, next) => {
  try {
    const list = await fetchInventoryItems(req.query)
    res.json(list)
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const list = await fetchInventoryItems(req.query)
    res.json(list)
  } catch (error) {
    next(error)
  }
})

router.post('/items', async (req, res, next) => {
  const client = await pool.connect()
  let imagePath: string | null = null
  try {
    const data = itemCreateSchema.parse(req.body)
    await ensureCategoryExists(data.categoriaId)
    await ensureProviderExists(data.proveedorId ?? null)

    await client.query('BEGIN')
    imagePath = await saveInventoryImage(data.imagen)
    const result = await client.query(
      `
        INSERT INTO inventario_items
          (nombre, sku, descripcion, categoria_id, proveedor_id, tipo, unidad_medida, costo_compra, precio_venta,
           stock_actual, stock_minimo, permite_stock_negativo, estado, image_path, updated_at, created_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
        RETURNING id
      `,
      [
        data.nombre,
        normalizeSku(data.sku),
        data.descripcion ?? null,
        data.categoriaId,
        data.proveedorId ?? null,
        data.tipo,
        data.unidadMedida,
        data.costoCompra,
        data.precioVenta,
        data.stockInicial,
        data.stockMinimo,
        data.permiteStockNegativo,
        data.estado,
        imagePath,
      ],
    )

    if (data.stockInicial > 0) {
      await insertMovement(client, {
        itemId: result.rows[0].id,
        tipoMovimiento: 'entrada',
        cantidad: data.stockInicial,
        motivo: 'Stock inicial',
        referencia: 'CREACION_ITEM',
        observaciones: 'Carga inicial al crear el item',
        stockAntes: 0,
        stockDespues: data.stockInicial,
        adminUserId: req.admin?.adminId ?? null,
      })
    }

    await client.query('COMMIT')
    const created = await fetchItemDetail(result.rows[0].id)
    res.status(201).json(created)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (imagePath) {
      await deleteInventoryImage(imagePath)
    }
    next(error)
  } finally {
    client.release()
  }
})

router.post('/', async (req, res, next) => {
  const client = await pool.connect()
  let imagePath: string | null = null
  try {
    const data = itemCreateSchema.parse(req.body)
    await ensureCategoryExists(data.categoriaId)
    await ensureProviderExists(data.proveedorId ?? null)

    await client.query('BEGIN')
    imagePath = await saveInventoryImage(data.imagen)
    const result = await client.query(
      `
        INSERT INTO inventario_items
          (nombre, sku, descripcion, categoria_id, proveedor_id, tipo, unidad_medida, costo_compra, precio_venta,
           stock_actual, stock_minimo, permite_stock_negativo, estado, image_path, updated_at, created_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
        RETURNING id
      `,
      [
        data.nombre,
        normalizeSku(data.sku),
        data.descripcion ?? null,
        data.categoriaId,
        data.proveedorId ?? null,
        data.tipo,
        data.unidadMedida,
        data.costoCompra,
        data.precioVenta,
        data.stockInicial,
        data.stockMinimo,
        data.permiteStockNegativo,
        data.estado,
        imagePath,
      ],
    )

    if (data.stockInicial > 0) {
      await insertMovement(client, {
        itemId: result.rows[0].id,
        tipoMovimiento: 'entrada',
        cantidad: data.stockInicial,
        motivo: 'Stock inicial',
        referencia: 'CREACION_ITEM',
        observaciones: 'Carga inicial al crear el item',
        stockAntes: 0,
        stockDespues: data.stockInicial,
        adminUserId: req.admin?.adminId ?? null,
      })
    }

    await client.query('COMMIT')
    const created = await fetchItemDetail(result.rows[0].id)
    res.status(201).json(created)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (imagePath) {
      await deleteInventoryImage(imagePath)
    }
    if (handleInventoryError(error, res)) return
    next(error)
  } finally {
    client.release()
  }
})

router.patch('/items/:id', async (req, res, next) => {
  let imagePath: string | null = null
  let previousImagePath: string | null = null
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const data = itemUpdateSchema.parse(req.body)
    const current = await fetchItemDetail(id)
    if (!current) {
      return res.status(404).json({ message: 'Item no encontrado' })
    }

    if (data.categoriaId !== undefined) {
      await ensureCategoryExists(data.categoriaId)
    }

    if (data.proveedorId !== undefined) {
      await ensureProviderExists(data.proveedorId ?? null)
    }

    const fields: string[] = []
    const values: unknown[] = []
    const push = (column: string, value: unknown) => {
      values.push(value)
      fields.push(`${column} = $${values.length}`)
    }

    if (data.nombre !== undefined) push('nombre', data.nombre)
    if (data.sku !== undefined) push('sku', normalizeSku(data.sku))
    if (data.descripcion !== undefined) push('descripcion', data.descripcion ?? null)
    if (data.categoriaId !== undefined) push('categoria_id', data.categoriaId)
    if (data.proveedorId !== undefined) push('proveedor_id', data.proveedorId ?? null)
    if (data.tipo !== undefined) push('tipo', data.tipo)
    if (data.unidadMedida !== undefined) push('unidad_medida', data.unidadMedida)
    if (data.costoCompra !== undefined) push('costo_compra', data.costoCompra)
    if (data.precioVenta !== undefined) push('precio_venta', data.precioVenta)
    if (data.stockMinimo !== undefined) push('stock_minimo', data.stockMinimo)
    if (data.permiteStockNegativo !== undefined) push('permite_stock_negativo', data.permiteStockNegativo)
    if (data.estado !== undefined) push('estado', data.estado)

    previousImagePath = current.imagenUrl
    if (data.imagen !== undefined) {
      imagePath = data.imagen ? await saveInventoryImage(data.imagen) : null
      push('image_path', imagePath)
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No hay datos para actualizar' })
    }

    values.push(id)
    const result = await pool.query(
      `
        UPDATE inventario_items
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id
      `,
      values,
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Item no encontrado' })
    }

    if (data.imagen !== undefined && previousImagePath && imagePath !== previousImagePath) {
      await deleteInventoryImage(previousImagePath)
    }

    const updated = await fetchItemDetail(id)
    res.json(updated)
  } catch (error) {
    if (imagePath && imagePath !== previousImagePath) {
      await deleteInventoryImage(imagePath)
    }
    if (handleInventoryError(error, res)) return
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  let imagePath: string | null = null
  let previousImagePath: string | null = null
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const data = itemUpdateSchema.parse(req.body)
    const current = await fetchItemDetail(id)
    if (!current) {
      return res.status(404).json({ message: 'Item no encontrado' })
    }

    if (data.categoriaId !== undefined) {
      await ensureCategoryExists(data.categoriaId)
    }

    if (data.proveedorId !== undefined) {
      await ensureProviderExists(data.proveedorId ?? null)
    }

    const fields: string[] = []
    const values: unknown[] = []
    const push = (column: string, value: unknown) => {
      values.push(value)
      fields.push(`${column} = $${values.length}`)
    }

    if (data.nombre !== undefined) push('nombre', data.nombre)
    if (data.sku !== undefined) push('sku', normalizeSku(data.sku))
    if (data.descripcion !== undefined) push('descripcion', data.descripcion ?? null)
    if (data.categoriaId !== undefined) push('categoria_id', data.categoriaId)
    if (data.proveedorId !== undefined) push('proveedor_id', data.proveedorId ?? null)
    if (data.tipo !== undefined) push('tipo', data.tipo)
    if (data.unidadMedida !== undefined) push('unidad_medida', data.unidadMedida)
    if (data.costoCompra !== undefined) push('costo_compra', data.costoCompra)
    if (data.precioVenta !== undefined) push('precio_venta', data.precioVenta)
    if (data.stockMinimo !== undefined) push('stock_minimo', data.stockMinimo)
    if (data.permiteStockNegativo !== undefined) push('permite_stock_negativo', data.permiteStockNegativo)
    if (data.estado !== undefined) push('estado', data.estado)

    previousImagePath = current.imagenUrl
    if (data.imagen !== undefined) {
      imagePath = data.imagen ? await saveInventoryImage(data.imagen) : null
      push('image_path', imagePath)
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No hay datos para actualizar' })
    }

    values.push(id)
    const result = await pool.query(
      `
        UPDATE inventario_items
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id
      `,
      values,
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Item no encontrado' })
    }

    if (data.imagen !== undefined && previousImagePath && imagePath !== previousImagePath) {
      await deleteInventoryImage(previousImagePath)
    }

    const updated = await fetchItemDetail(id)
    res.json(updated)
  } catch (error) {
    if (imagePath && imagePath !== previousImagePath) {
      await deleteInventoryImage(imagePath)
    }
    if (handleInventoryError(error, res)) return
    next(error)
  }
})

router.post('/items/:id/movements', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const data = movementCreateSchema.parse(req.body)
    await client.query('BEGIN')

    const itemResult = await client.query<{
      id: number
      stockActual: string
      permiteStockNegativo: boolean
      estado: string
    }>(
      `
        SELECT
          id,
          stock_actual AS "stockActual",
          permite_stock_negativo AS "permiteStockNegativo",
          estado
        FROM inventario_items
        WHERE id = $1
        FOR UPDATE
      `,
      [id],
    )

    if (itemResult.rowCount === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Item no encontrado' })
    }

    const item = itemResult.rows[0]
    const stockAntes = Number(item.stockActual)
    let stockDespues = stockAntes
    let cantidad = Number(data.cantidad ?? 0)

    if (data.tipoMovimiento === 'ajuste') {
      stockDespues = Number(data.stockObjetivo)
      cantidad = Math.abs(stockDespues - stockAntes)
      if (stockDespues === stockAntes) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'El ajuste no cambia el stock actual' })
      }
    } else if (data.tipoMovimiento === 'entrada' || data.tipoMovimiento === 'devolucion') {
      stockDespues = stockAntes + cantidad
    } else {
      stockDespues = stockAntes - cantidad
    }

    if (stockDespues < 0 && !item.permiteStockNegativo) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'El item no permite quedar con stock negativo' })
    }

    await client.query('UPDATE inventario_items SET stock_actual = $2, updated_at = NOW() WHERE id = $1', [id, stockDespues])
    await insertMovement(client, {
      itemId: id,
      tipoMovimiento: data.tipoMovimiento,
      cantidad,
      motivo: data.motivo,
      referencia: data.referencia ?? null,
      observaciones: data.observaciones ?? null,
      stockAntes,
      stockDespues,
      adminUserId: req.admin?.adminId ?? null,
    })
    await client.query('COMMIT')

    const itemDetail = await fetchItemDetail(id)
    res.status(201).json(itemDetail)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    client.release()
  }
})

type PoolLike = {
  query: typeof pool.query
}

type InventoryItemRow = {
  id: number
  nombre: string
  sku: string
  descripcion: string | null
  categoriaId: number | null
  categoriaNombre: string | null
  proveedorId: number | null
  proveedorNombre: string | null
  tipo: z.infer<typeof itemTypeEnum>
  unidadMedida: string
  costoCompra: string | number
  precioVenta: string | number
  stockActual: string | number
  stockMinimo: string | number
  permiteStockNegativo: boolean
  estado: z.infer<typeof itemStatusEnum>
  imagenUrl: string | null
  createdAt: Date
  updatedAt: Date
}

async function fetchInventoryItems(query: Record<string, unknown>) {
  const filters: string[] = []
  const values: unknown[] = []

  if (typeof query.q === 'string' && query.q.trim()) {
    values.push(`%${query.q.trim().toLowerCase()}%`)
    filters.push(`(LOWER(i.nombre) LIKE $${values.length} OR LOWER(i.sku) LIKE $${values.length})`)
  }

  if (typeof query.categoriaId === 'string' && query.categoriaId.trim()) {
    const categoriaId = Number(query.categoriaId)
    if (Number.isInteger(categoriaId)) {
      values.push(categoriaId)
      filters.push(`i.categoria_id = $${values.length}`)
    }
  }

  if (typeof query.tipo === 'string' && itemTypeEnum.options.includes(query.tipo as z.infer<typeof itemTypeEnum>)) {
    values.push(query.tipo)
    filters.push(`i.tipo = $${values.length}`)
  }

  if (typeof query.estado === 'string' && itemStatusEnum.options.includes(query.estado as z.infer<typeof itemStatusEnum>)) {
    values.push(query.estado)
    filters.push(`i.estado = $${values.length}`)
  }

  if (query.lowStock === 'true' || query.lowStock === '1') {
    filters.push('i.stock_actual <= i.stock_minimo')
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const result = await pool.query(
    `
      SELECT
        i.id,
        i.nombre,
        i.sku,
        i.descripcion,
        i.categoria_id AS "categoriaId",
        c.nombre AS "categoriaNombre",
        i.proveedor_id AS "proveedorId",
        p.nombre AS "proveedorNombre",
        i.tipo,
        i.unidad_medida AS "unidadMedida",
        i.costo_compra AS "costoCompra",
        i.precio_venta AS "precioVenta",
        i.stock_actual AS "stockActual",
        i.stock_minimo AS "stockMinimo",
        i.permite_stock_negativo AS "permiteStockNegativo",
        i.estado,
        i.image_path AS "imagenUrl",
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt"
      FROM inventario_items i
      LEFT JOIN inventory_categories c ON c.id = i.categoria_id
      LEFT JOIN proveedores p ON p.id = i.proveedor_id
      ${where}
      ORDER BY i.updated_at DESC, i.nombre ASC
    `,
    values,
  )

  return mapItemRows(result.rows)
}

async function fetchItemDetail(id: number) {
  const result = await pool.query<InventoryItemRow>(
    `
      SELECT
        i.id,
        i.nombre,
        i.sku,
        i.descripcion,
        i.categoria_id AS "categoriaId",
        c.nombre AS "categoriaNombre",
        i.proveedor_id AS "proveedorId",
        p.nombre AS "proveedorNombre",
        i.tipo,
        i.unidad_medida AS "unidadMedida",
        i.costo_compra AS "costoCompra",
        i.precio_venta AS "precioVenta",
        i.stock_actual AS "stockActual",
        i.stock_minimo AS "stockMinimo",
        i.permite_stock_negativo AS "permiteStockNegativo",
        i.estado,
        i.image_path AS "imagenUrl",
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt"
      FROM inventario_items i
      LEFT JOIN inventory_categories c ON c.id = i.categoria_id
      LEFT JOIN proveedores p ON p.id = i.proveedor_id
      WHERE i.id = $1
      LIMIT 1
    `,
    [id],
  )

  if (result.rowCount === 0) return null
  const [item] = mapItemRows(result.rows)
  return item
}

async function fetchItemMovements(id: number) {
  const result = await pool.query(
    `
      SELECT
        m.id,
        m.item_id AS "itemId",
        i.nombre AS "itemNombre",
        i.sku AS "itemSku",
        m.tipo_movimiento AS "tipoMovimiento",
        m.cantidad,
        m.motivo,
        m.referencia,
        m.observaciones,
        m.stock_antes AS "stockAntes",
        m.stock_despues AS "stockDespues",
        m.admin_user_id AS "adminUserId",
        au.name AS "usuarioResponsable",
        m.created_at AS "createdAt"
      FROM inventario_movimientos m
      INNER JOIN inventario_items i ON i.id = m.item_id
      LEFT JOIN admin_users au ON au.id = m.admin_user_id
      WHERE m.item_id = $1
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 100
    `,
    [id],
  )

  return mapMovementRows(result.rows)
}

async function ensureCategoryExists(id: number) {
  const result = await pool.query('SELECT id FROM inventory_categories WHERE id = $1 LIMIT 1', [id])
  if (result.rowCount === 0) {
    throw new Error('La categoria seleccionada no existe')
  }
}

async function ensureProviderExists(id: number | null) {
  if (!id) return
  const result = await pool.query('SELECT id FROM proveedores WHERE id = $1 LIMIT 1', [id])
  if (result.rowCount === 0) {
    throw new Error('El proveedor seleccionado no existe')
  }
}

async function insertMovement(
  client: PoolLike,
  input: {
    itemId: number
    tipoMovimiento: z.infer<typeof movementTypeEnum>
    cantidad: number
    motivo: string
    referencia: string | null
    observaciones: string | null
    stockAntes: number
    stockDespues: number
    adminUserId: number | null
  },
) {
  await client.query(
    `
      INSERT INTO inventario_movimientos
        (item_id, tipo_movimiento, cantidad, motivo, referencia, observaciones, stock_antes, stock_despues, admin_user_id)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,
    [
      input.itemId,
      input.tipoMovimiento,
      input.cantidad,
      input.motivo,
      input.referencia,
      input.observaciones,
      input.stockAntes,
      input.stockDespues,
      input.adminUserId,
    ],
  )
}

const inventoryUploadsDirectory = path.resolve(process.cwd(), env.UPLOADS_DIR, 'inventory')

async function saveInventoryImage(dataUrl?: string) {
  if (!dataUrl) return null

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i)
  if (!match) {
    throw new Error('Formato de imagen no soportado')
  }

  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase()
  const buffer = Buffer.from(match[2], 'base64')
  await fs.mkdir(inventoryUploadsDirectory, { recursive: true })
  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`
  await fs.writeFile(path.join(inventoryUploadsDirectory, filename), buffer)
  return `/uploads/inventory/${filename}`
}

async function deleteInventoryImage(imagePath: string) {
  if (!imagePath.startsWith('/uploads/inventory/')) return
  const filename = path.basename(imagePath)
  const absolutePath = path.join(inventoryUploadsDirectory, filename)
  await fs.rm(absolutePath, { force: true })
}

function mapItemRows(rows: InventoryItemRow[]) {
  return rows.map((row) => ({
    ...row,
    costoCompra: Number(row.costoCompra ?? 0),
    precioVenta: Number(row.precioVenta ?? 0),
    stockActual: Number(row.stockActual ?? 0),
    stockMinimo: Number(row.stockMinimo ?? 0),
  }))
}

function mapMovementRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    ...row,
    cantidad: Number(row.cantidad ?? 0),
    stockAntes: Number(row.stockAntes ?? 0),
    stockDespues: Number(row.stockDespues ?? 0),
  }))
}

function getDataUrlByteLength(dataUrl: string) {
  const [, payload = ''] = dataUrl.split(',', 2)
  return Buffer.byteLength(payload, 'base64')
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase()
}

export default router

function handleInventoryError(error: unknown, res: { status: (code: number) => { json: (body: { message: string }) => unknown } }) {
  const databaseError = error as DatabaseError | undefined
  if (databaseError?.code === '23505') {
    return res.status(409).json({ message: 'Ya existe un item o categoria con ese valor unico' })
  }
  if (error instanceof Error && ['La categoria seleccionada no existe', 'El proveedor seleccionado no existe'].includes(error.message)) {
    return res.status(400).json({ message: error.message })
  }
  return null
}
