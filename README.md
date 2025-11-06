# Doctor Cell 2.0 – Monorepo

Este proyecto ahora está organizado en dos carpetas principales:

- `frontend/`: aplicación React + Vite.
- `backend/`: API Express con PostgreSQL.

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Puesta en marcha

### Backend

```bash
cd backend
npm install
cp .env.example .env   # ajusta las variables a tu entorno
psql -d doctorcel -f sql/001_init.sql  # crea la tabla de productos
npm run dev
```

La API quedará disponible en `http://localhost:4000/api`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env # ajusta VITE_API_URL si es necesario
npm run dev
```

Configura la URL del backend en tus utilidades de red (por ejemplo `http://localhost:4000/api`) según sea necesario.

## Estructura

```
backend/
  src/
    app.ts             # configuración de Express
    index.ts           # arranque del servidor
    config/            # variables de entorno y conexión a PostgreSQL
    routes/            # endpoints agrupados por módulo
  sql/                 # scripts para crear tablas
frontend/
  src/                 # componentes React
  public/              # assets públicos
```

## Próximos pasos sugeridos

- Implementar autenticación para proteger los endpoints de administración.
- Extender la API con rutas de reparaciones y créditos.
- Conectar el frontend al backend usando fetch/axios en lugar de `localStorage`.
- Configurar despliegues automatizados para ambos paquetes.
