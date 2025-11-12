import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { generateDiagnosticSuggestion } from '../lib/diagnosticAssistant.js';
const router = Router();
const requestSchema = z.object({
    dispositivo: z.string().optional(),
    motivo: z.string().min(3),
    descripcion: z.string().min(5),
    contacto: z.string().optional(),
    nombre: z.string().optional(),
});
router.post('/diagnostic', async (req, res, next) => {
    if (!env.OPENAI_API_KEY) {
        return res.status(503).json({ message: 'El asistente no está disponible en este momento' });
    }
    try {
        const data = requestSchema.parse(req.body);
        const similares = await fetchSimilarCases(data.dispositivo, data.motivo);
        const result = await generateDiagnosticSuggestion({
            dispositivo: data.dispositivo,
            motivo: data.motivo,
            descripcion: data.descripcion,
            similares,
        });
        await pool.query(`
        INSERT INTO diagnostic_sessions
          (dispositivo, motivo, descripcion, contacto, nombre_cliente, prompt, respuesta)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
            data.dispositivo ?? null,
            data.motivo,
            data.descripcion,
            data.contacto ?? null,
            data.nombre ?? null,
            result.prompt,
            result.data,
        ]);
        res.json(result.data);
    }
    catch (error) {
        await pool.query(`
        INSERT INTO diagnostic_sessions (dispositivo, motivo, descripcion, error)
        VALUES ($1,$2,$3,$4)
      `, [req.body?.dispositivo ?? null, req.body?.motivo ?? null, req.body?.descripcion ?? null, error instanceof Error ? error.message : String(error)]).catch(() => { });
        next(error);
    }
});
async function fetchSimilarCases(dispositivo, motivo) {
    const values = [];
    const searchTerm = motivo ? `%${motivo}%` : '%';
    const deviceTerm = dispositivo ? `%${dispositivo}%` : '%';
    const repairs = await pool.query(`
      SELECT
        'Reparación' AS tipo,
        TRIM(CONCAT(COALESCE(marca,''), ' ', COALESCE(modelo,''))) AS dispositivo,
        motivo_ingreso AS descripcion,
        diagnostico,
        NULL::text AS resultado
      FROM repair_tickets
      WHERE motivo_ingreso ILIKE $1 OR marca ILIKE $2 OR modelo ILIKE $2
      ORDER BY updated_at DESC
      LIMIT 3
    `, [searchTerm, deviceTerm]);
    const returns = await pool.query(`
      SELECT
        'Devolución' AS tipo,
        COALESCE(producto_nombre, 'Repuesto') AS dispositivo,
        motivo AS descripcion,
        diagnostico,
        resultado_final AS resultado
      FROM devoluciones
      WHERE motivo ILIKE $1 OR COALESCE(producto_nombre,'') ILIKE $2
      ORDER BY updated_at DESC
      LIMIT 2
    `, [searchTerm, deviceTerm]);
    return [...repairs.rows, ...returns.rows];
}
export default router;
