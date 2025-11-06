import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
const router = Router();
const imageSchema = z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || value.startsWith('data:') || /^https?:\/\//i.test(value), 'La imagen debe ser una URL valida o un data URL');
const productSchema = z.object({
    nombre: z.string().min(1),
    descripcion: z.string().default(''),
    categoria: z.enum(['nuevos', 'usados', 'accesorios']),
    precio: z.coerce.number().positive(),
    imagenUrl: imageSchema,
});
router.get('/', async (_req, res, next) => {
    try {
        const result = await pool.query('SELECT id, nombre, descripcion, categoria, precio, imagen_url AS "imagenUrl", created_at AS "createdAt" FROM productos ORDER BY created_at DESC');
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const data = productSchema.parse(req.body);
        const result = await pool.query(`
        INSERT INTO productos (nombre, descripcion, categoria, precio, imagen_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, nombre, descripcion, categoria, precio, imagen_url AS "imagenUrl", created_at AS "createdAt"
      `, [data.nombre, data.descripcion, data.categoria, data.precio, data.imagenUrl ?? null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ message: 'Id invalido' });
        }
        const result = await pool.query('DELETE FROM productos WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
export default router;
