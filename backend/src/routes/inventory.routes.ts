import { Router } from 'express'
import { z } from 'zod'

import { pool } from '../config/database.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const inventorySchema = z.object({
  nombre: z.string().min(1),
  categoria: z.string().min(1),
  proveedorId: z.number().int().positive().optional().nullable(),
  stockActual: z.coerce.number().int().nonnegative(),
  stockMinimo: z.coerce.number().int().nonnegative(),
  precioCompra: z.coerce.number().nonnegative(),
  precioVenta: z.coerce.number().nonnegative(),
  descripcion: z.string().optional(),
})

const inventoryUpdateSchema = inventorySchema.partial()

router.get('/', requireAdmin, async (req, res, next) => {
  const { q, estado } = req.query
  try {
    const filters: string[] = []
    const values: unknown[] = []

    if (typeof q === 'string' && q.trim() !== '') {
      values.push(`%${q.trim().toLowerCase()}%`)
      filters.push(`LOWER(i.nombre) LIKE $${values.length}`)
    }

    if (estado === 'bajo') {
      filters.push('i.stock_actual <= i.stock_minimo')
    } else if (estado === 'ok') {
      filters.push('i.stock_actual > i.stock_minimo')
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''

    const result = await pool.query(
      `
        SELECT
          i.id,
          i.nombre,
          i.categoria,
          i.proveedor_id AS "proveedorId",
          p.nombre AS "proveedorNombre",
          i.stock_actual AS "stockActual",
          i.stock_minimo AS "stockMinimo",
          i.precio_compra AS "precioCompra",
          i.precio_venta AS "precioVenta",
          i.descripcion,
          i.updated_at AS "updatedAt"
        FROM inventario_items i
        LEFT JOIN proveedores p ON p.id = i.proveedor_id
        ${where}
        ORDER BY i.nombre ASC
      `,
      values,
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.get('/alerts', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT id, nombre, stock_actual AS "stockActual", stock_minimo AS "stockMinimo"
        FROM inventario_items
        WHERE stock_actual <= stock_minimo
        ORDER BY stock_actual ASC
      `,
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = inventorySchema.parse(req.body)
    const result = await pool.query(
      `
        INSERT INTO inventario_items
          (nombre, categoria, proveedor_id, stock_actual, stock_minimo, precio_compra, precio_venta, descripcion)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, nombre, categoria, proveedor_id AS "proveedorId", stock_actual AS "stockActual",
          stock_minimo AS "stockMinimo", precio_compra AS "precioCompra", precio_venta AS "precioVenta",
          descripcion, updated_at AS "updatedAt"
      `,
      [
        data.nombre,
        data.categoria,
        data.proveedorId ?? null,
        data.stockActual,
        data.stockMinimo,
        data.precioCompra,
        data.precioVenta,
        data.descripcion ?? null,
      ],
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }

    const data = inventoryUpdateSchema.parse(req.body)
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No hay datos para actualizar' })
    }

    const setClauses: string[] = []
    const values: unknown[] = []

    const pushSet = (column: string, value: unknown) => {
      values.push(value)
      setClauses.push(`${column} = $${values.length}`)
    }

    if (data.nombre !== undefined) pushSet('nombre', data.nombre)
    if (data.categoria !== undefined) pushSet('categoria', data.categoria)
    if (data.proveedorId !== undefined) pushSet('proveedor_id', data.proveedorId ?? null)
    if (data.stockActual !== undefined) pushSet('stock_actual', data.stockActual)
    if (data.stockMinimo !== undefined) pushSet('stock_minimo', data.stockMinimo)
    if (data.precioCompra !== undefined) pushSet('precio_compra', data.precioCompra)
    if (data.precioVenta !== undefined) pushSet('precio_venta', data.precioVenta)
    if (data.descripcion !== undefined) pushSet('descripcion', data.descripcion ?? null)

    values.push(id)

    const result = await pool.query(
      `
        UPDATE inventario_items
        SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id, nombre, categoria, proveedor_id AS "proveedorId", stock_actual AS "stockActual",
          stock_minimo AS "stockMinimo", precio_compra AS "precioCompra", precio_venta AS "precioVenta",
          descripcion, updated_at AS "updatedAt"
      `,
      values,
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Repuesto no encontrado' })
    }

    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }
    const result = await pool.query('DELETE FROM inventario_items WHERE id = $1', [id])
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Repuesto no encontrado' })
    }
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
