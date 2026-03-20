CREATE TABLE IF NOT EXISTS inventory_categories (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO inventory_categories (nombre, descripcion, estado)
SELECT DISTINCT INITCAP(TRIM(categoria)), 'Categoria migrada desde inventario legacy', 'activo'
FROM inventario_items
WHERE categoria IS NOT NULL
  AND TRIM(categoria) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_categories c
    WHERE LOWER(c.nombre) = LOWER(TRIM(inventario_items.categoria))
  );

ALTER TABLE inventario_items
    ADD COLUMN IF NOT EXISTS sku TEXT,
    ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES inventory_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'otro' CHECK (tipo IN ('repuesto', 'insumo', 'accesorio', 'producto', 'otro')),
    ADD COLUMN IF NOT EXISTS unidad_medida TEXT NOT NULL DEFAULT 'unidad',
    ADD COLUMN IF NOT EXISTS permite_stock_negativo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS image_path TEXT,
    ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE inventario_items
    ALTER COLUMN stock_actual TYPE NUMERIC(12,3) USING stock_actual::NUMERIC(12,3),
    ALTER COLUMN stock_minimo TYPE NUMERIC(12,3) USING stock_minimo::NUMERIC(12,3),
    ALTER COLUMN precio_compra TYPE NUMERIC(12,2) USING precio_compra::NUMERIC(12,2),
    ALTER COLUMN precio_venta TYPE NUMERIC(12,2) USING precio_venta::NUMERIC(12,2);

UPDATE inventario_items i
SET categoria_id = c.id
FROM inventory_categories c
WHERE i.categoria_id IS NULL
  AND i.categoria IS NOT NULL
  AND TRIM(i.categoria) <> ''
  AND LOWER(c.nombre) = LOWER(TRIM(i.categoria));

UPDATE inventario_items
SET sku = CONCAT('INV-', LPAD(id::text, 5, '0'))
WHERE sku IS NULL OR TRIM(sku) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventario_items_sku_unique
ON inventario_items (sku);

CREATE INDEX IF NOT EXISTS idx_inventario_items_categoria_id ON inventario_items(categoria_id);
CREATE INDEX IF NOT EXISTS idx_inventario_items_estado ON inventario_items(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_items_stock_actual ON inventario_items(stock_actual);

CREATE TABLE IF NOT EXISTS inventario_movimientos (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES inventario_items(id) ON DELETE CASCADE,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste', 'consumo_reparacion', 'devolucion')),
    cantidad NUMERIC(12,3) NOT NULL CHECK (cantidad >= 0),
    motivo TEXT NOT NULL,
    referencia TEXT,
    observaciones TEXT,
    stock_antes NUMERIC(12,3) NOT NULL,
    stock_despues NUMERIC(12,3) NOT NULL,
    admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_item_id ON inventario_movimientos(item_id);
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_tipo ON inventario_movimientos(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_created_at ON inventario_movimientos(created_at DESC);
