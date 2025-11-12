import { Router } from 'express'
import { z } from 'zod'

import { pool } from '../config/database.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const clientSchema = z.object({
  nombre: z.string().min(1),
  documento: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  direccion: z.string().optional(),
  notas: z.string().optional(),
})

router.use(requireAdmin)

router.get('/', async (req, res, next) => {
  const { q } = req.query
  try {
    const values: unknown[] = []
    let where = ''

    if (typeof q === 'string' && q.trim()) {
      values.push(`%${q.trim().toLowerCase()}%`)
      where = `WHERE LOWER(nombre) LIKE $1 OR LOWER(COALESCE(documento,'')) LIKE $1`
    }

    const result = await pool.query(
      `
        SELECT id, nombre, documento, telefono, email, direccion, notas, created_at AS "createdAt"
        FROM clients
        ${where}
        ORDER BY created_at DESC
        LIMIT 50
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
    const result = await pool.query(
      'SELECT id, nombre, documento, telefono, email, direccion, notas, created_at AS "createdAt" FROM clients WHERE id = $1',
      [id],
    )
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' })
    }
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const data = clientSchema.parse(req.body)
    const result = await pool.query(
      `
        INSERT INTO clients (nombre, documento, telefono, email, direccion, notas)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, nombre, documento, telefono, email, direccion, notas, created_at AS "createdAt"
      `,
      [
        data.nombre.trim(),
        data.documento?.trim() ?? null,
        data.telefono?.trim() ?? null,
        data.email?.trim() ?? null,
        data.direccion?.trim() ?? null,
        data.notas ?? null,
      ],
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

export default router
