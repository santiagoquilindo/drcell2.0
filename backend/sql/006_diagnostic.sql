CREATE TABLE IF NOT EXISTS diagnostic_sessions (
    id SERIAL PRIMARY KEY,
    dispositivo TEXT,
    motivo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    contacto TEXT,
    nombre_cliente TEXT,
    prompt TEXT,
    respuesta JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_created_at ON diagnostic_sessions(created_at DESC);
