CREATE TYPE devolucion_estado AS ENUM (
    'reportada',
    'revision_tecnica',
    'entregada_proveedor',
    'espera_regreso',
    'devuelta_reemplazo',
    'devuelta_reembolso',
    'reparada_entregada',
    'rechazada',
    'cerrada'
);

CREATE SEQUENCE IF NOT EXISTS devolucion_codigo_seq;

CREATE TABLE IF NOT EXISTS devoluciones (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(32) UNIQUE NOT NULL,
    inventario_item_id INTEGER REFERENCES inventario_items(id),
    producto_nombre TEXT,
    proveedor_id INTEGER REFERENCES proveedores(id),
    cliente_id INTEGER REFERENCES clients(id),
    motivo TEXT NOT NULL,
    diagnostico TEXT,
    estado devolucion_estado NOT NULL DEFAULT 'reportada',
    sla_proveedor TIMESTAMPTZ,
    sla_alerta TEXT,
    resultado_final TEXT,
    ajuste_stock BOOLEAN DEFAULT FALSE,
    ajuste_notas TEXT,
    cerrada_por TEXT,
    cerrada_en TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devolucion_movimientos (
    id SERIAL PRIMARY KEY,
    devolucion_id INTEGER NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    entregado_por TEXT NOT NULL,
    recibido_por TEXT NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devolucion_historial (
    id SERIAL PRIMARY KEY,
    devolucion_id INTEGER NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
    estado devolucion_estado NOT NULL,
    comentario TEXT,
    actor TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devolucion_adjuntos (
    id SERIAL PRIMARY KEY,
    devolucion_id INTEGER NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    url TEXT NOT NULL,
    nombre TEXT,
    subido_por TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devoluciones_estado ON devoluciones(estado);
CREATE INDEX IF NOT EXISTS idx_devoluciones_sla ON devoluciones(sla_proveedor);
CREATE INDEX IF NOT EXISTS idx_devolucion_historial_dev ON devolucion_historial(devolucion_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_movimientos_dev ON devolucion_movimientos(devolucion_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_adjuntos_dev ON devolucion_adjuntos(devolucion_id);
