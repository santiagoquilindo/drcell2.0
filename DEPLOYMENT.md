# Despliegue de Dr Cell

Guia corta para publicar backend y frontend del monorepo.

## 1. Backend

### Variables de entorno

Duplica `backend/.env.example` y ajusta:

| Variable | Descripcion |
| --- | --- |
| `PORT` | Puerto HTTP del API. |
| `DATABASE_URL` | Conexion a PostgreSQL. |
| `CORS_ORIGIN` | Origenes permitidos del frontend. |
| `SESSION_COOKIE_NAME` | Nombre de la cookie de sesion admin. |
| `SESSION_TTL_HOURS` | Duracion de la sesion en horas. |
| `SESSION_COOKIE_DOMAIN` | Dominio compartido de la cookie si aplica. |
| `SESSION_COOKIE_SAME_SITE` | Politica `SameSite` de la cookie. |
| `SESSION_COOKIE_SECURE` | Fuerza `Secure` en la cookie. |
| `TRUST_PROXY` | Activa `trust proxy` detras de Nginx/Cloudflare/Render/Fly. |
| `UPLOADS_DIR` | Directorio persistente para imagenes. |
| `PUBLIC_APP_URL` | URL publica del frontend usada en los QR de seguimiento. |
| `OPENAI_API_KEY` | Opcional para el asistente IA. |
| `BUSINESS_*` | Datos impresos en facturas y stickers. |

### Autenticacion real

- El acceso administrativo usa `POST /api/auth/login`.
- El backend crea una cookie `HttpOnly` y persiste la sesion en `admin_sessions`.
- `ADMIN_API_KEY` y `x-api-key` quedan obsoletos para el flujo vigente.

### Instalacion y build

```bash
cd backend
npm install
npm run build
node dist/index.js
```

### Base de datos

Ejecuta todos los SQL vigentes:

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

## 2. Frontend

### Variables de entorno

Edita `frontend/.env`:

| Variable | Descripcion |
| --- | --- |
| `VITE_API_URL` | URL publica del backend incluyendo `/api`. |
| `VITE_WHATSAPP_NUMBER` | Numero comercial para el carrito. |

### Build estatico

```bash
cd frontend
npm install
npm run build
```

Para panel en despliegue separado:

```bash
cd frontend
npm run build:admin
```

## 3. Rutas vigentes a verificar

- `/`
- `/seguimiento`
- `/admin/login`
- `/admin/products`
- `/admin/inventory`
- `/admin/repairs`

Compatibilidad:

- `/tracking` redirige a `/seguimiento`.

## 4. Checklist antes de publicar

- `PUBLIC_APP_URL` apunta al dominio real.
- El QR del sticker abre `https://tu-dominio/seguimiento?ticket=...&verifier=....`.
- `CORS_ORIGIN` incluye los dominios reales del frontend.
- `VITE_API_URL` coincide con la URL HTTPS del backend.
- La base PostgreSQL tiene ejecutados todos los SQL vigentes.
- `npm run build` funciona en backend y frontend.
- El login admin y la cookie de sesion funcionan sobre el dominio real.
- `SESSION_COOKIE_*` y `TRUST_PROXY` estan alineados con el despliegue real.

## 5. Uploads

- Las imagenes viven en el filesystem del backend.
- `UPLOADS_DIR` debe apuntar a un volumen persistente.
- Productos se guardan en `/uploads/products`.
- Inventario se guarda en `/uploads/inventory`.

## 6. Operacion recomendada

- Programa una tarea periodica para `sql/007_retention_cleanup.sql`.
- Mantén backups de PostgreSQL.
- Revisa que el dominio y la cookie compartan configuracion correcta antes de abrir el panel al publico.
