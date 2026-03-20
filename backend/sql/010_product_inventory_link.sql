ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS inventario_item_id INTEGER REFERENCES inventario_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_productos_inventario_item_id
ON productos (inventario_item_id);
