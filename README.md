# Doctor Cell 2.0 - Monorepo

Repositorio dividido en dos paquetes independientes:

- `frontend/`: aplicación React + Vite.
- `backend/`: API Express que expone catálogos, inventario y proveedores sobre PostgreSQL.

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

#### Endpoints del módulo de inventario

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/providers` | Listado de proveedores registrados |
| `POST` | `/api/providers` | Registrar proveedor (nombre, contacto, etc.) |
| `GET` | `/api/inventory` | Inventario filtrable por texto (`q`) y estado (`bajo` \| `ok`) |
| `GET` | `/api/inventory/alerts` | Alertas automáticas cuando `stock_actual <= stock_minimo` |
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

Configura `VITE_API_URL` apuntando al backend (`http://localhost:4000/api` por defecto). Una vez autenticado como administrador desde el header, la página `Home.tsx` habilita el panel **Inventario de repuestos y accesorios**, desde donde se pueden registrar proveedores, administrar stock y monitorear alertas.

## Estructura

```
backend/
  src/
    app.ts          # configuración de Express
    index.ts        # arranque del servidor
    config/         # variables y conexión a PostgreSQL
    routes/         # módulos de productos, inventario y proveedores
  sql/              # scripts para inicializar tablas
frontend/
  src/              # componentes React, páginas y utilidades
  public/           # assets estáticos
```

## Próximos pasos sugeridos

- Agregar pruebas automatizadas a los endpoints protegidos.
- Sustituir el almacenamiento local de la galería de reparaciones por un servicio remoto.
- Preparar pipelines de despliegue para frontend y backend.
- Integrar autenticación completa (usuarios/admin) en lugar de una sola API key.
