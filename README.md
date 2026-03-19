# Dr. Cell

Monorepo con dos aplicaciones:

- `frontend/`: React + Vite para catálogo público, tracking y panel admin.
- `backend/`: Express + PostgreSQL para auth admin, productos, reparaciones e inventario.

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Desarrollo local

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

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

## Scripts principales

Backend:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run start:prod`
- `npm run create-admin -- <email> <password> "<nombre>"`

Frontend:

- `npm run dev`
- `npm run build`
- `npm run build:prod`
- `npm run preview`
- `npm run preview:prod`

## Variables de entorno clave

Backend:

- `DATABASE_URL`
- `CORS_ORIGIN`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_HOURS`
- `SESSION_COOKIE_DOMAIN`
- `SESSION_COOKIE_SAME_SITE`
- `SESSION_COOKIE_SECURE`
- `TRUST_PROXY`
- `UPLOADS_DIR`
- `PUBLIC_APP_URL`

Frontend:

- `VITE_API_URL`
- `VITE_WHATSAPP_NUMBER`

## Producción

La guía completa de despliegue está en:

- [docs/DEPLOY.md](/Users/Personal/Documents/d/proyectos%20nuevos/dr%20cell%20git%20hub/drcell/docs/DEPLOY.md)
- [docs/PRELAUNCH.md](/Users/Personal/Documents/d/proyectos%20nuevos/dr%20cell%20git%20hub/drcell/docs/PRELAUNCH.md)

## Estado actual

- Fase 1: auth admin, productos, catálogo y carrito con WhatsApp.
- Fase 2: reparaciones admin y tracking público.
- Fase 3: mejora UX/UI pública y administrativa.
- Fase 4: preparación para despliegue y operación productiva básica.
