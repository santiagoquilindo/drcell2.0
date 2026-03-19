# Despliegue Dr. Cell

## 1. Estructura esperada en producción

- Backend Node.js compilado con `npm run build`
- Frontend compilado con `npm run build`
- PostgreSQL accesible desde el backend
- Directorio persistente para imágenes de productos montado en el backend

Recomendación mínima:

- Frontend servido como estático desde Nginx, Vercel o un host similar
- Backend servido como proceso Node detrás de Nginx o un proxy inverso
- `UPLOADS_DIR` apuntando a un volumen persistente

## 2. Variables de entorno backend

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://usuario:password@host:5432/doctorcel
CORS_ORIGIN=https://dr-cell.com,https://admin.dr-cell.com
SESSION_COOKIE_NAME=drcell_session
SESSION_TTL_HOURS=168
SESSION_COOKIE_DOMAIN=.dr-cell.com
SESSION_COOKIE_SAME_SITE=lax
SESSION_COOKIE_SECURE=true
TRUST_PROXY=true
UPLOADS_DIR=/var/www/drcell/uploads

BUSINESS_NAME="Dr. Cell"
BUSINESS_TRADE_NAME="Dr. Cell"
BUSINESS_TAX_ID=""
BUSINESS_ADDRESS=""
BUSINESS_PHONE=""
BUSINESS_EMAIL="contacto@dr-cell.com"
PUBLIC_APP_URL=https://dr-cell.com
OPENAI_API_KEY=
```

Notas:

- Si frontend y backend viven bajo el mismo dominio raíz, `SESSION_COOKIE_DOMAIN=.dr-cell.com` funciona bien.
- Si se usan dominios completamente distintos, revisa `SESSION_COOKIE_SAME_SITE=none` y `SESSION_COOKIE_SECURE=true`.
- `TRUST_PROXY=true` es importante si el backend queda detrás de Nginx/Cloudflare/Render/Fly/otra capa proxy.

## 3. Variables de entorno frontend

```env
VITE_API_URL=https://api.dr-cell.com/api
VITE_WHATSAPP_NUMBER=573001112233
```

## 4. Preparar base de datos

Ejecuta:

```bash
psql -d doctorcel -f sql/001_init.sql
psql -d doctorcel -f sql/002_inventory.sql
psql -d doctorcel -f sql/003_invoices.sql
psql -d doctorcel -f sql/004_repairs.sql
psql -d doctorcel -f sql/005_returns.sql
psql -d doctorcel -f sql/006_diagnostic.sql
psql -d doctorcel -f sql/007_retention_cleanup.sql
psql -d doctorcel -f sql/008_phase1_auth_products.sql
```

Crear admin inicial:

```bash
cd backend
npm run create-admin -- admin@dr-cell.com TuPasswordSegura "Administrador Dr Cell"
```

## 5. Build y arranque backend

```bash
cd backend
npm install
npm run build
npm run start:prod
```

Healthcheck disponible:

- `GET /api/health`

## 6. Build y publicación frontend

```bash
cd frontend
npm install
npm run build:prod
```

Publica el contenido de `frontend/dist/`.

Rutas a verificar:

- `/`
- `/tracking`
- `/admin/login`
- `/admin/products`
- `/admin/repairs`

## 7. Estrategia mínima de uploads

En esta etapa, las imágenes viven en el filesystem del backend.

Recomendación mínima segura:

- crear un directorio persistente fuera del release temporal
- montar ese directorio como `UPLOADS_DIR`
- exponerlo desde `/uploads`

Ejemplo:

- `UPLOADS_DIR=/var/www/drcell/uploads`
- archivos de producto en `/var/www/drcell/uploads/products`

Si el servidor se recrea sin persistencia, se perderán las imágenes. Ese es el principal riesgo operativo pendiente de esta estrategia local.

## 8. Checklist manual end-to-end

- login admin
- CRUD de productos
- ver imágenes de productos en catálogo público
- agregar al carrito
- abrir mensaje de WhatsApp
- crear reparación
- editar reparación
- cambiar estado
- consultar tracking por código

## 9. Siguiente mejora recomendada

En una siguiente etapa conviene decidir si el sticker/PDF de reparación se expone desde la UI admin y si los uploads migran a un storage externo o volumen administrado.
