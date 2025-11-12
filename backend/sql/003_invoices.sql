CREATE TYPE invoice_type AS ENUM ('factura', 'cotizacion');
CREATE TYPE invoice_status AS ENUM ('borrador', 'emitida', 'pagada');

CREATE SEQUENCE IF NOT EXISTS invoice_consecutivo_seq;

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    consecutivo VARCHAR(32) UNIQUE NOT NULL,
    tipo invoice_type NOT NULL DEFAULT 'cotizacion',
    estado invoice_status NOT NULL DEFAULT 'borrador',
    cliente_nombre TEXT NOT NULL,
    cliente_identificacion TEXT,
    cliente_email TEXT,
    cliente_telefono TEXT,
    cliente_direccion TEXT,
    notas TEXT,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    impuesto NUMERIC(12,2) NOT NULL DEFAULT 0,
    descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    anticipo NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    inventario_item_id INTEGER REFERENCES inventario_items(id),
    descripcion TEXT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    impuesto_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
    descuento_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
