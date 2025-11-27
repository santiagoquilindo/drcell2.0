-- Limpieza de datos con retención de 60 días
-- Ejecutar este script periódicamente (por ejemplo, una vez al día mediante cron/render scheduler)
-- para mantener únicamente los registros recientes y liberar espacio en la base de datos.

BEGIN;

-- 1. Reparaciones finalizadas (estado entregado) mayores a 60 días.
WITH old_repairs AS (
  SELECT id
  FROM repair_tickets
  WHERE estado = 'entregado'
    AND updated_at < NOW() - INTERVAL '60 days'
)
DELETE FROM repair_tickets
WHERE id IN (SELECT id FROM old_repairs);

-- 2. Historial de reparaciones (por si hay tickets abiertos muy antiguos).
DELETE FROM repair_updates
WHERE created_at < NOW() - INTERVAL '60 days';

-- 3. Facturas y cotizaciones mayores a 60 días.
DELETE FROM invoices
WHERE updated_at < NOW() - INTERVAL '60 days';

-- 4. Devoluciones cerradas mayores a 60 días (por cascada limpia movimientos/historial/adjuntos).
DELETE FROM devoluciones
WHERE estado = 'cerrada'
  AND updated_at < NOW() - INTERVAL '60 days';

COMMIT;

