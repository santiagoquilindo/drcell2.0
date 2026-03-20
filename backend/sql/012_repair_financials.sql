ALTER TABLE repair_tickets
    ADD COLUMN IF NOT EXISTS mano_obra NUMERIC(12,2) NOT NULL DEFAULT 0;

WITH parts_totals AS (
    SELECT
        repair_id,
        COALESCE(SUM(cantidad * precio_unitario_referencial), 0) AS subtotal_repuestos
    FROM repair_parts
    WHERE estado = 'consumido'
    GROUP BY repair_id
)
UPDATE repair_tickets rt
SET mano_obra = GREATEST(rt.costo_final - COALESCE(pt.subtotal_repuestos, 0), 0),
    costo_final = GREATEST(rt.costo_final, 0)
FROM parts_totals pt
WHERE pt.repair_id = rt.id;

UPDATE repair_tickets
SET mano_obra = GREATEST(costo_final, 0)
WHERE mano_obra = 0
  AND id NOT IN (
    SELECT repair_id
    FROM repair_parts
  );
