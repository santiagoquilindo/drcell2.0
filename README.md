# Dr Cell - Monorepo

Repositorio dividido en dos paquetes independientes:

- `frontend/`: aplicaci�n React + Vite.
- `backend/`: API Express que expone cat�logos, inventario y proveedores sobre PostgreSQL.

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Puesta en marcha

### Backend

```bash
cd backend
npm install
copy .env.example .env   # ajusta ADMIN_API_KEY, DATABASE_URL, CORS_ORIGIN, etc.
psql -d doctorcel -f sql/001_init.sql      # tabla de productos
psql -d doctorcel -f sql/002_inventory.sql # tablas de proveedores e inventario
npm run dev
```

La API queda en `http://localhost:4000/api`. Todas las rutas que modifican datos (productos, inventario y proveedores) requieren enviar el header `x-api-key` con el valor de `ADMIN_API_KEY`.

#### Endpoints del m�dulo de inventario

| M�todo | Ruta | Descripci�n |
| --- | --- | --- |
| `GET` | `/api/providers` | Listado de proveedores registrados |
| `POST` | `/api/providers` | Registrar proveedor (nombre, contacto, etc.) |
| `GET` | `/api/inventory` | Inventario filtrable por texto (`q`) y estado (`bajo` \| `ok`) |
| `GET` | `/api/inventory/alerts` | Alertas autom�ticas cuando `stock_actual <= stock_minimo` |
| `POST` | `/api/inventory` | Crear repuesto/accesorio con proveedor, stock y precios |
| `PATCH` | `/api/inventory/:id` | Actualizar proveedor, stock o precios |
| `DELETE` | `/api/inventory/:id` | Retirar un registro del inventario |

> Ejecuta `sql/002_inventory.sql` cada vez que levantes una base nueva para disponer de las tablas.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # ajusta VITE_API_URL si es necesario
npm run dev
```

Configura `VITE_API_URL` apuntando al backend (`http://localhost:4000/api` por defecto). El m�dulo p�blico vive en `/` y el portal administrativo en `/admin`. Al autenticarse en `/admin`, la aplicaci�n habilita el panel **Inventario de repuestos y accesorios**, desde donde se pueden registrar proveedores, administrar stock y monitorear alertas.

## Estructura

```
backend/
  src/
    app.ts          # configuraci�n de Express
    index.ts        # arranque del servidor
    config/         # variables y conexi�n a PostgreSQL
    routes/         # m�dulos de productos, inventario y proveedores
  sql/              # scripts para inicializar tablas
frontend/
  src/              # componentes React, p�ginas y utilidades
  public/           # assets est�ticos
```

## Pr�ximos pasos sugeridos

- Agregar pruebas automatizadas a los endpoints protegidos.
- Sustituir el almacenamiento local de la galer�a de reparaciones por un servicio remoto.
- Preparar pipelines de despliegue para frontend y backend.
- Integrar autenticaci�n completa (usuarios/admin) en lugar de una sola API key.
### Builds separados (usuario vs. admin)

`
# Sitio público
npm run build
# Archivos listos en frontend/dist

# Panel administrativo (mismo bundle pero con admin.html como index)
npm run build:admin
# Archivos para el panel en frontend/dist-admin
`

Despliega rontend/dist en el dominio público (https://dr-cell.com) y rontend/dist-admin en el subdominio del panel (https://admin.dr-cell.com). Ambos apuntan al mismo backend pero mantienen URLs separadas.
