# Despliegue de Dr Cell

Guía para preparar una publicación del backend (API Node/Express) y del frontend (React + Vite). El monorepo permite desplegar cada parte de forma independiente.

---

## 1. Backend (API Express)

### Requisitos

- Node.js 20+
- PostgreSQL accesible desde el servidor

### Variables de entorno

Duplica `backend/.env.example` y ajusta:

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto HTTP del API (p.ej., `4000`). |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (incluye usuario, contraseña, host y base). |
| `CORS_ORIGIN` | Lista separada por comas con los orígenes permitidos (dominio público del frontend). |
| `ADMIN_API_KEY` | Token que se envía en el header `x-api-key` para rutas protegidas. |
| `PUBLIC_APP_URL` | URL pública donde vive el frontend (se usa para los QR de seguimiento). |
| `OPENAI_API_KEY` | (Opcional) clave para activar el asistente IA. |
| `BUSINESS_*` | Datos mostrados en facturas/stickers. |

### Instalación y compilación

```bash
cd backend
npm install
npm run build    # genera dist/
```

Para ejecutar en producción:

```bash
node dist/index.js
```

> **Recuerda** inicializar tu base con `sql/001_init.sql` y `sql/002_inventory.sql` si todavía no existen las tablas.

### Supervisión

En un servidor Linux puedes usar PM2, systemd o el manejador de procesos de tu proveedor cloud:

```bash
pm2 start dist/index.js --name doctorcel-api
```

---

## 2. Frontend (Vite + React)

### Variables de entorno

Edita `frontend/.env`:

| Variable | Descripción |
| --- | --- |
| `VITE_API_URL` | URL pública del backend (incluye `/api`). Ejemplo: `https://api.doctorcel.com/api`. |

### Build estático

```bash
cd frontend
npm install
npm run build   # genera dist/ listo para cualquier hosting estático
```

El contenido de `frontend/dist/` se puede subir a Netlify, Vercel, Cloudflare Pages, un bucket S3 + CloudFront, etc. Para una vista previa local:

```bash
npm run preview -- --host 0.0.0.0 --port 4173
```

---

## 3. Checklist antes de publicar

- [ ] `PUBLIC_APP_URL` apunta al dominio real (no `localhost`) y el QR del sticker abre `https://tu-dominio/seguimiento?ticket=...`.
- [ ] `CORS_ORIGIN` incluye los dominios desde los que se servirá el frontend.
- [ ] `VITE_API_URL` coincide con la URL HTTPS del backend.
- [ ] La base PostgreSQL tiene los scripts de inicialización ejecutados.
- [ ] `npm run build` funciona en backend y frontend (sin warnings rojos).
- [ ] Para accesos administrativos, la API key (`ADMIN_API_KEY`) está almacenada en un lugar seguro (por ejemplo, variable secreta en el host).

Con estos pasos el proyecto queda listo para subirse a cualquier plataforma (Railway, Render, DigitalOcean, AWS, etc.) manteniendo frontend y backend desacoplados pero comunicándose vía HTTPS.
