import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
const router = Router();
const providerSchema = z.object({
    nombre: z.string().min(1),
    contacto: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().email().optional(),
    notas: z.string().optional(),
});
router.get('/', requireAdmin, async (_req, res, next) => {
    try {
        const result = await pool.query('SELECT id, nombre, contacto, telefono, email, notas, created_at AS "createdAt" FROM proveedores ORDER BY nombre ASC');
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
});
router.post('/', requireAdmin, async (req, res, next) => {
    try {
        const data = providerSchema.parse(req.body);
        const result = await pool.query(`
        INSERT INTO proveedores (nombre, contacto, telefono, email, notas)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, nombre, contacto, telefono, email, notas, created_at AS "createdAt"
      `, [data.nombre, data.contacto ?? null, data.telefono ?? null, data.email ?? null, data.notas ?? null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
export default router;
