import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'

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
  activo: z.coerce.boolean().default(true),
  imagen: dataUrlImageSchema,
})

router.get('/admin/all', requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          nombre,
          slug,
          descripcion,
          categoria,
          precio,
          stock,
          activo,
          image_path AS "imagenUrl",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM productos
        ORDER BY created_at DESC
      `,
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          nombre,
          slug,
          descripcion,
          categoria,
          precio,
          stock,
          activo,
          image_path AS "imagenUrl",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM productos
        WHERE activo = TRUE
        ORDER BY created_at DESC
      `,
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.post('/', requireAdmin, async (req, res, next) => {
  let imagePath: string | null = null
  try {
    const data = productSchema.parse(req.body)
    imagePath = await saveProductImage(data.imagen)
    const slug = await generateUniqueSlug(data.nombre)
    const result = await pool.query(
      `
        INSERT INTO productos (nombre, slug, descripcion, categoria, precio, stock, activo, image_path)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          nombre,
          slug,
          descripcion,
          categoria,
          precio,
          stock,
          activo,
          image_path AS "imagenUrl",
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
        data.activo,
        imagePath,
      ],
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    if (error instanceof Error && imagePath) {
      await deleteProductImage(imagePath)
    }
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
    const current = await pool.query<{ imagePath: string | null }>('SELECT image_path AS "imagePath" FROM productos WHERE id = $1', [id])
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
            activo = $7,
            image_path = $8,
            updated_at = NOW()
        WHERE id = $9
        RETURNING
          id,
          nombre,
          slug,
          descripcion,
          categoria,
          precio,
          stock,
          activo,
          image_path AS "imagenUrl",
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
        data.activo,
        imagePath,
        id,
      ],
    )
    if (data.imagen && previousImagePath) {
      await deleteProductImage(previousImagePath)
    }
    res.json(result.rows[0])
  } catch (error) {
    if (imagePath && imagePath !== previousImagePath) {
      await deleteProductImage(imagePath)
    }
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
      'SELECT image_path AS "imagePath" FROM productos WHERE id = $1',
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

async function saveProductImage(dataUrl?: string) {
  if (!dataUrl) return null

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i)
  if (!match) {
    throw new Error('Formato de imagen no soportado')
  }

  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase()
  const buffer = Buffer.from(match[2], 'base64')
  const directory = path.resolve(process.cwd(), 'uploads', 'products')
  await fs.mkdir(directory, { recursive: true })
  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`
  await fs.writeFile(path.join(directory, filename), buffer)
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
  const absolutePath = path.resolve(process.cwd(), imagePath.replace(/^\/+/, ''))
  await fs.rm(absolutePath, { force: true })
}
