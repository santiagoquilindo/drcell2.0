# Pre-Lanzamiento Dr. Cell

## 1. Verificación previa de configuración

Backend:

- `NODE_ENV=production`
- `DATABASE_URL` apunta a la base real
- `CORS_ORIGIN` contiene solo dominios reales de frontend
- `SESSION_COOKIE_DOMAIN` coincide con el dominio raíz si se comparte cookie
- `SESSION_COOKIE_SAME_SITE` y `SESSION_COOKIE_SECURE` están alineados con el escenario real
- `TRUST_PROXY=true` si hay proxy inverso
- `UPLOADS_DIR` apunta a un directorio persistente
- `PUBLIC_APP_URL` apunta al dominio público real

Frontend:

- `VITE_API_URL` apunta al backend real
- `VITE_WHATSAPP_NUMBER` corresponde al número comercial real

## 2. Checklist de publicación

### Backend

- `npm install`
- `npm run build`
- `npm run start:prod`
- `GET /api/health` responde `200`
- `GET /uploads/...` sirve imágenes correctamente

### Base de datos

- migraciones SQL ejecutadas
- admin inicial creado
- login admin probado con credenciales reales

### Frontend

- `npm install`
- `npm run build:prod`
- publicación de `frontend/dist/`
- rutas accesibles:
  - `/`
  - `/tracking`
  - `/admin/login`
  - `/admin/products`
  - `/admin/repairs`

## 3. Prueba manual exacta end-to-end

### Auth admin

1. Ir a `/admin/login`
2. Iniciar sesión con el admin inicial
3. Confirmar redirección a `/admin/products`
4. Cerrar sesión
5. Confirmar retorno a `/admin/login`

### Productos

1. Iniciar sesión en admin
2. Crear un producto con imagen
3. Confirmar mensaje de éxito
4. Editar precio o stock
5. Confirmar actualización en listado
6. Verificar que la imagen cargue desde `/uploads/products/...`

### Catálogo público

1. Abrir `/`
2. Verificar que el producto creado aparezca
3. Usar búsqueda
4. Confirmar que el filtro devuelve resultados correctos

### Carrito y WhatsApp

1. Agregar un producto
2. Cambiar cantidad
3. Confirmar subtotal y total
4. Pulsar `Enviar por WhatsApp`
5. Confirmar que el enlace abra `wa.me` con mensaje codificado y total correcto

### Reparaciones admin

1. Ir a `/admin/repairs`
2. Crear una reparación con datos de cliente y equipo
3. Confirmar ticket generado
4. Editar la reparación
5. Cambiar estado
6. Confirmar que el historial registre el cambio

### Tracking público

1. Copiar el código del ticket
2. Ir a `/tracking`
3. Consultar por código válido
4. Confirmar estado actual e historial
5. Consultar un código inexistente
6. Confirmar respuesta clara de no encontrado

## 4. Checklist post-despliegue

- el backend sigue respondiendo después de reinicio
- las cookies de sesión funcionan en dominio real
- no hay rechazo inesperado por CORS
- las imágenes siguen disponibles después de reinicio del servicio
- el admin puede volver a iniciar sesión tras cerrar navegador
- el catálogo público consume API real, no localhost
- el tracking público consulta tickets reales
- el número de WhatsApp es el correcto

## 5. Riesgos que deben revisarse antes de anunciar

- `UPLOADS_DIR` sin persistencia real
- dominio/cookie mal alineados entre frontend y backend
- `CORS_ORIGIN` demasiado abierto o mal configurado
- falta de HTTPS real si se usa `SESSION_COOKIE_SECURE=true`
- ausencia de backups básicos de PostgreSQL
