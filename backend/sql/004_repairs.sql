CREATE TYPE repair_status AS ENUM ('ingresado', 'diagnostico', 'en_proceso', 'listo', 'entregado');

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    documento TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_documento ON clients ((lower(coalesce(documento, '')))) WHERE documento IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS repair_ticket_seq;

CREATE TABLE IF NOT EXISTS repair_tickets (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(32) UNIQUE NOT NULL,
    cliente_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    dispositivo_tipo TEXT,
    marca TEXT,
    modelo TEXT,
    referencia TEXT,
    color TEXT,
    serie TEXT,
    motivo_ingreso TEXT,
    diagnostico TEXT,
    accesorios TEXT,
    estado repair_status NOT NULL DEFAULT 'ingresado',
    costo_estimado NUMERIC(12,2) DEFAULT 0,
    costo_final NUMERIC(12,2) DEFAULT 0,
    responsable TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repair_updates (
    id SERIAL PRIMARY KEY,
    repair_id INTEGER NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
    estado repair_status NOT NULL,
    comentario TEXT,
    registrado_por TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repairs_cliente ON repair_tickets(cliente_id);
CREATE INDEX IF NOT EXISTS idx_repairs_estado ON repair_tickets(estado);
CREATE INDEX IF NOT EXISTS idx_repair_updates_repair ON repair_updates(repair_id);
