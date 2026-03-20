# Dr. Cell

Monorepo con dos aplicaciones:

- `frontend/`: React + Vite para catalogo publico, seguimiento y panel admin.
- `backend/`: Express + PostgreSQL para autenticacion admin, productos, inventario, reparaciones, facturas, devoluciones y asistente.

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
psql -d doctorcel -f sql/009_inventory_module.sql
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
- `npm run build:admin`
- `npm run preview`
- `npm run preview:prod`

## Variables de entorno reales

Backend:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_HOURS`
- `SESSION_COOKIE_DOMAIN`
- `SESSION_COOKIE_SAME_SITE`
- `SESSION_COOKIE_SECURE`
- `TRUST_PROXY`
- `UPLOADS_DIR`
- `BUSINESS_NAME`
- `BUSINESS_TRADE_NAME`
- `BUSINESS_TAX_ID`
- `BUSINESS_ADDRESS`
- `BUSINESS_PHONE`
- `BUSINESS_EMAIL`
- `PUBLIC_APP_URL`
- `OPENAI_API_KEY`

Frontend:

- `VITE_API_URL`
- `VITE_WHATSAPP_NUMBER`

## Autenticacion vigente

- El backend usa sesiones persistidas en `admin_sessions`.
- `POST /api/auth/login` valida email y password y emite una cookie `HttpOnly`.
- `GET /api/auth/me` y las rutas admin dependen de `requireAdmin`.
- `ADMIN_API_KEY` y `x-api-key` ya no son el mecanismo vigente.

## Rutas principales vigentes

Frontend:

- `/`
- `/seguimiento`
- `/admin/login`
- `/admin/products`
- `/admin/inventory`
- `/admin/repairs`

Backend:

- `/api/auth/*`
- `/api/products`
- `/api/inventory/*`
- `/api/providers`
- `/api/clients`
- `/api/repairs/*`
- `/api/invoices/*`
- `/api/returns/*`
- `/api/assistant/diagnostic`
- `/api/health`

## Notas de compatibilidad

- `/tracking` se mantiene solo como redireccion hacia `/seguimiento`.
- El esquema vigente de inventario usa `inventario_items.image_path`; el modulo ya no depende de `inventario_items.imagen_url`.

## Produccion

La guia completa de despliegue esta en:

- [docs/DEPLOY.md](/Users/Personal/Documents/d/proyectos%20nuevos/dr%20cell%20git%20hub/drcell/docs/DEPLOY.md)
- [docs/PRELAUNCH.md](/Users/Personal/Documents/d/proyectos%20nuevos/dr%20cell%20git%20hub/drcell/docs/PRELAUNCH.md)
