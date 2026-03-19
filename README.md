# Dr. Cell

Monorepo con dos aplicaciones separadas:

- `frontend/`: React + Vite para catálogo público y panel administrador.
- `backend/`: API Express + PostgreSQL con autenticación admin, productos, inventario y reparaciones.

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Puesta en marcha

### Backend

```bash
cd backend
npm install
copy .env.example .env
psql -d doctorcel -f sql/001_init.sql
psql -d doctorcel -f sql/002_inventory.sql
psql -d doctorcel -f sql/003_invoices.sql
psql -d doctorcel -f sql/004_repairs.sql
psql -d doctorcel -f sql/005_returns.sql
psql -d doctorcel -f sql/006_diagnostic.sql
psql -d doctorcel -f sql/007_retention_cleanup.sql
psql -d doctorcel -f sql/008_phase1_auth_products.sql
npm run create-admin -- admin@drcell.com TuPasswordSegura "Administrador Dr Cell"
npm run dev
```

La API queda disponible en `http://localhost:4000/api`.

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

El catálogo público vive en `/` y el acceso administrativo en `/admin/login`.

## Variables de entorno clave

Backend:

- `DATABASE_URL`
- `CORS_ORIGIN`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_HOURS`
- `PUBLIC_APP_URL`

Frontend:

- `VITE_API_URL`
- `VITE_WHATSAPP_NUMBER`

## Estructura

```text
backend/
  src/
    app.ts
    index.ts
    config/
    lib/
    middleware/
    routes/
    scripts/
  sql/
  uploads/
frontend/
  src/
    app/
    features/
      admin/
      public/
    shared/
```

## Estado actual

- Fase 1 completada: auth admin real, CRUD de productos, uploads locales, catálogo público, carrito y envío a WhatsApp.
- Fase 1.1 completada: endurecimiento de auth, validación de imágenes, limpieza de rutas inseguras, ajuste de CORS y limpieza técnica base.

## Siguiente fase

- Integrar servicios y reparaciones en la nueva UI administrativa y pública.
- Consolidar inventario operativo sobre la arquitectura nueva.
- Añadir pruebas automatizadas a módulos críticos.
