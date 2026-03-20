# Despliegue Dr. Cell

## 1. Estructura esperada en produccion

- Backend Node.js compilado con `npm run build`
- Frontend compilado con `npm run build`
- PostgreSQL accesible desde el backend
- Directorio persistente para imagenes en el backend

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

- Si frontend y backend viven bajo el mismo dominio raiz, `SESSION_COOKIE_DOMAIN=.dr-cell.com` funciona bien.
- Si se usan dominios completamente distintos, revisa `SESSION_COOKIE_SAME_SITE=none` y `SESSION_COOKIE_SECURE=true`.
- `TRUST_PROXY=true` es importante detras de proxy inverso.

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
psql -d doctorcel -f sql/009_inventory_module.sql
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

Healthcheck:

- `GET /api/health`

## 6. Build y publicacion frontend

```bash
cd frontend
npm install
npm run build:prod
```

Publica `frontend/dist/`.

Rutas a verificar:

- `/`
- `/seguimiento`
- `/admin/login`
- `/admin/products`
- `/admin/inventory`
- `/admin/repairs`

Compatibilidad:

- `/tracking` redirige a `/seguimiento`.

## 7. Estrategia minima de uploads

- crear un directorio persistente fuera del release temporal
- montar ese directorio como `UPLOADS_DIR`
- exponerlo desde `/uploads`

Ejemplo:

- `UPLOADS_DIR=/var/www/drcell/uploads`
- `/var/www/drcell/uploads/products`
- `/var/www/drcell/uploads/inventory`

## 8. Checklist manual end-to-end

- login admin
- CRUD de productos
- inventario: listado, detalle, creacion, edicion y movimientos
- ver imagenes de productos en catalogo publico
- agregar al carrito
- abrir mensaje de WhatsApp
- crear reparacion
- editar reparacion
- cambiar estado
- consultar seguimiento por QR o por codigo

## 9. Siguiente mejora recomendada

La siguiente etapa natural es decidir la integracion real entre stock comercial (`productos`) e inventario operativo (`inventario_items`), y definir si devoluciones/facturas tendran frontend propio.
