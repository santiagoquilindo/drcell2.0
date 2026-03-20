CREATE TABLE IF NOT EXISTS repair_parts (
    id SERIAL PRIMARY KEY,
    repair_id INTEGER NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
    inventory_item_id INTEGER NOT NULL REFERENCES inventario_items(id),
    item_nombre TEXT NOT NULL,
    item_sku TEXT NOT NULL,
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario_referencial NUMERIC(12,2) NOT NULL DEFAULT 0,
    precio_unitario_referencial NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'consumido' CHECK (estado IN ('consumido', 'revertido')),
    notas TEXT,
    inventory_movement_id INTEGER REFERENCES inventario_movimientos(id) ON DELETE SET NULL,
    reversal_movement_id INTEGER REFERENCES inventario_movimientos(id) ON DELETE SET NULL,
    created_by_admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    reverted_by_admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reverted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_repair_parts_repair_id ON repair_parts(repair_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_parts_inventory_item_id ON repair_parts(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_repair_parts_estado ON repair_parts(estado);
