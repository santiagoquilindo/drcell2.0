import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'

import { env } from '../config/env.js'
import { pool } from '../config/database.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const dataUrlImageSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value), 'La imagen debe ser PNG, JPG o WEBP')
  .refine((value) => !value || getDataUrlByteLength(value) <= 3 * 1024 * 1024, 'La imagen no puede superar 3 MB')

const baseSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)

const createSlug = (value: string) => `${baseSlug(value) || 'producto'}-${crypto.randomBytes(3).toString('hex')}`

const productSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  descripcion: z.string().trim().min(1).max(1500),
  categoria: z.enum(['nuevos', 'usados', 'accesorios']),
  precio: z.coerce.number().positive(),
  stock: z.coerce.number().int().nonnegative().default(0),
  inventarioItemId: z.number().int().positive().nullable().optional(),
  activo: z.coerce.boolean().default(true),
  imagen: dataUrlImageSchema,
})

router.get('/admin/all', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          p.id,
          p.nombre,
          p.slug,
          p.descripcion,
          p.categoria,
          p.precio,
          CASE
            WHEN p.inventario_item_id IS NOT NULL THEN COALESCE(i.stock_actual, 0)
            ELSE p.stock
          END AS stock,
          p.stock AS "stockManual",
          p.inventario_item_id AS "inventarioItemId",
          i.nombre AS "inventarioItemNombre",
          p.activo,
          COALESCE(p.image_path, p.imagen_url) AS "imagenUrl",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt"
        FROM productos p
        LEFT JOIN inventario_items i ON i.id = p.inventario_item_id
        ORDER BY p.created_at DESC
      `,
    )
    res.json(result.rows.map(mapProductRow))
  } catch (error) {
    next(error)
  }
})

router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          p.id,
          p.nombre,
          p.slug,
          p.descripcion,
          p.categoria,
          p.precio,
          CASE
            WHEN p.inventario_item_id IS NOT NULL THEN COALESCE(i.stock_actual, 0)
            ELSE p.stock
          END AS stock,
          p.stock AS "stockManual",
          p.inventario_item_id AS "inventarioItemId",
          i.nombre AS "inventarioItemNombre",
          p.activo,
          COALESCE(p.image_path, p.imagen_url) AS "imagenUrl",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt"
        FROM productos p
        LEFT JOIN inventario_items i ON i.id = p.inventario_item_id
        WHERE p.activo = TRUE
        ORDER BY p.created_at DESC
      `,
    )
    res.json(result.rows.map(mapProductRow))
  } catch (error) {
    next(error)
  }
})

router.post('/', requireAdmin, async (req, res, next) => {
  let imagePath: string | null = null
  try {
    const data = productSchema.parse(req.body)
    await ensureLinkedInventoryItem(data.inventarioItemId ?? null)
    imagePath = await saveProductImage(data.imagen)
    const slug = await generateUniqueSlug(data.nombre)
    const result = await pool.query(
      `
        INSERT INTO productos (nombre, slug, descripcion, categoria, precio, stock, inventario_item_id, activo, image_path)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          nombre,
          slug,
          descripcion,
          categoria,
          precio,
          activo,
          COALESCE(image_path, imagen_url) AS "imagenUrl",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        data.nombre.trim(),
        slug,
        data.descripcion.trim(),
        data.categoria,
        data.precio,
        data.stock,
        data.inventarioItemId ?? null,
        data.activo,
        imagePath,
      ],
    )
    const product = await fetchProductById(result.rows[0].id)
    if (!product) {
      throw new Error('No se pudo cargar el producto creado')
    }
    res.status(201).json(product)
  } catch (error) {
    if (error instanceof Error && imagePath) {
      await deleteProductImage(imagePath)
    }
    if (handleProductError(error, res)) return
    next(error)
  }
})

router.put('/:id', requireAdmin, async (req, res, next) => {
  let imagePath: string | null = null
  let previousImagePath: string | null = null
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }
    const data = productSchema.parse(req.body)
    await ensureLinkedInventoryItem(data.inventarioItemId ?? null)
    const current = await pool.query<{ imagePath: string | null }>(
      'SELECT COALESCE(image_path, imagen_url) AS "imagePath" FROM productos WHERE id = $1',
      [id],
    )
    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' })
    }
    previousImagePath = current.rows[0].imagePath
    imagePath = data.imagen ? await saveProductImage(data.imagen) : previousImagePath
    const slug = await generateUniqueSlug(data.nombre, id)
    const result = await pool.query(
      `
        UPDATE productos
        SET nombre = $1,
            slug = $2,
            descripcion = $3,
            categoria = $4,
            precio = $5,
            stock = $6,
            inventario_item_id = $7,
            activo = $8,
            image_path = $9,
            updated_at = NOW()
        WHERE id = $10
        RETURNING id
      `,
      [
        data.nombre.trim(),
        slug,
        data.descripcion.trim(),
        data.categoria,
        data.precio,
        data.stock,
        data.inventarioItemId ?? null,
        data.activo,
        imagePath,
        id,
      ],
    )
    if (data.imagen && previousImagePath) {
      await deleteProductImage(previousImagePath)
    }
    const product = await fetchProductById(result.rows[0].id)
    if (!product) {
      throw new Error('No se pudo cargar el producto actualizado')
    }
    res.json(product)
  } catch (error) {
    if (imagePath && imagePath !== previousImagePath) {
      await deleteProductImage(imagePath)
    }
    if (handleProductError(error, res)) return
    next(error)
  }
})

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Id invalido' })
    }
    const existing = await pool.query<{ imagePath: string | null }>(
      'SELECT COALESCE(image_path, imagen_url) AS "imagePath" FROM productos WHERE id = $1',
      [id],
    )
    const result = await pool.query('DELETE FROM productos WHERE id = $1', [id])
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' })
    }
    if ((existing.rowCount ?? 0) > 0 && existing.rows[0].imagePath) {
      await deleteProductImage(existing.rows[0].imagePath)
    }
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router

async function fetchProductById(id: number, client: PoolLike = pool) {
  const result = await client.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.slug,
        p.descripcion,
        p.categoria,
        p.precio,
        CASE
          WHEN p.inventario_item_id IS NOT NULL THEN COALESCE(i.stock_actual, 0)
          ELSE p.stock
        END AS stock,
        p.stock AS "stockManual",
        p.inventario_item_id AS "inventarioItemId",
        i.nombre AS "inventarioItemNombre",
        p.activo,
        COALESCE(p.image_path, p.imagen_url) AS "imagenUrl",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt"
      FROM productos p
      LEFT JOIN inventario_items i ON i.id = p.inventario_item_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [id],
  )

  return result.rows[0] ? mapProductRow(result.rows[0]) : null
}

type PoolLike = {
  query: typeof pool.query
}

async function ensureLinkedInventoryItem(id: number | null, client: PoolLike = pool) {
  if (!id) return

  const result = await client.query<{ id: number; estado: string }>(
    `
      SELECT id, estado
      FROM inventario_items
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  )

  if (result.rowCount === 0) {
    throw new Error('El item de inventario vinculado no existe')
  }

  if (result.rows[0].estado !== 'activo') {
    throw new Error('Solo puedes vincular items de inventario activos')
  }
}

const productUploadsDirectory = path.resolve(process.cwd(), env.UPLOADS_DIR, 'products')

async function saveProductImage(dataUrl?: string) {
  if (!dataUrl) return null

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i)
  if (!match) {
    throw new Error('Formato de imagen no soportado')
  }

  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase()
  const buffer = Buffer.from(match[2], 'base64')
  await fs.mkdir(productUploadsDirectory, { recursive: true })
  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`
  await fs.writeFile(path.join(productUploadsDirectory, filename), buffer)
  return `/uploads/products/${filename}`
}

async function generateUniqueSlug(name: string, excludeId?: number) {
  const root = baseSlug(name) || 'producto'

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${crypto.randomBytes(2).toString('hex')}`
    const candidate = `${root}${suffix}`.slice(0, 120)
    const values: Array<number | string> = [candidate]
    const where = excludeId ? 'AND id <> $2' : ''
    if (excludeId) values.push(excludeId)

    const existing = await pool.query('SELECT id FROM productos WHERE slug = $1 ' + where + ' LIMIT 1', values)
    if (existing.rowCount === 0) {
      return candidate
    }
  }

  return createSlug(name)
}

function getDataUrlByteLength(dataUrl: string) {
  const [, payload = ''] = dataUrl.split(',', 2)
  return Buffer.byteLength(payload, 'base64')
}

async function deleteProductImage(imagePath: string) {
  if (!imagePath.startsWith('/uploads/products/')) return
  const filename = path.basename(imagePath)
  const absolutePath = path.join(productUploadsDirectory, filename)
  await fs.rm(absolutePath, { force: true })
}

function mapProductRow(row: Record<string, unknown>) {
  return {
    ...row,
    precio: Number(row.precio ?? 0),
    stock: Number(row.stock ?? 0),
    stockManual: Number(row.stockManual ?? 0),
  }
}

function handleProductError(error: unknown, res: { status: (code: number) => { json: (body: { message: string }) => unknown } }) {
  if (
    error instanceof Error &&
    ['El item de inventario vinculado no existe', 'Solo puedes vincular items de inventario activos'].includes(error.message)
  ) {
    return res.status(400).json({ message: error.message })
  }

  return null
}
