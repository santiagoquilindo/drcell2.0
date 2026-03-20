# Pre-Lanzamiento Dr. Cell

## 1. Verificacion previa de configuracion

Backend:

- `NODE_ENV=production`
- `DATABASE_URL` apunta a la base real
- `CORS_ORIGIN` contiene solo dominios reales de frontend
- `SESSION_COOKIE_DOMAIN` coincide con el dominio raiz si se comparte cookie
- `SESSION_COOKIE_SAME_SITE` y `SESSION_COOKIE_SECURE` estan alineados con el escenario real
- `TRUST_PROXY=true` si hay proxy inverso
- `UPLOADS_DIR` apunta a un directorio persistente
- `PUBLIC_APP_URL` apunta al dominio publico real

Frontend:

- `VITE_API_URL` apunta al backend real
- `VITE_WHATSAPP_NUMBER` corresponde al numero comercial real

## 2. Checklist de publicacion

### Backend

- `npm install`
- `npm run build`
- `npm run start:prod`
- `GET /api/health` responde `200`
- `GET /uploads/...` sirve imagenes correctamente

### Base de datos

- SQL vigentes ejecutados, incluyendo `sql/009_inventory_module.sql`
- admin inicial creado
- login admin probado con credenciales reales

### Frontend

- `npm install`
- `npm run build:prod`
- publicacion de `frontend/dist/`
- rutas accesibles:
  - `/`
  - `/seguimiento`
  - `/admin/login`
  - `/admin/products`
  - `/admin/inventory`
  - `/admin/repairs`

## 3. Prueba manual exacta end-to-end

### Auth admin

1. Ir a `/admin/login`
2. Iniciar sesion con el admin inicial
3. Confirmar redireccion a `/admin/products`
4. Cerrar sesion
5. Confirmar retorno a `/admin/login`

### Productos

1. Iniciar sesion en admin
2. Crear un producto con imagen
3. Confirmar mensaje de exito
4. Editar precio o stock
5. Confirmar actualizacion en listado
6. Verificar que la imagen cargue desde `/uploads/products/...`

### Catalogo publico

1. Abrir `/`
2. Verificar que el producto creado aparezca
3. Usar busqueda
4. Confirmar que el filtro devuelve resultados correctos

### Inventario

1. Ir a `/admin/inventory`
2. Crear una categoria
3. Crear un item con imagen
4. Verificar listado, detalle e imagen
5. Editar el item
6. Registrar entrada, salida y ajuste
7. Confirmar cambios de stock y trazabilidad

### Carrito y WhatsApp

1. Agregar un producto
2. Cambiar cantidad
3. Confirmar subtotal y total
4. Pulsar `Enviar por WhatsApp`
5. Confirmar que el enlace abra `wa.me` con mensaje codificado y total correcto

### Reparaciones admin

1. Ir a `/admin/repairs`
2. Crear una reparacion con datos de cliente y equipo
3. Confirmar ticket generado
4. Editar la reparacion
5. Cambiar estado
6. Confirmar que el historial registre el cambio

### Seguimiento publico

1. Generar el sticker PDF desde `/api/repairs/:id/sticker`
2. Abrir el enlace del QR o copiar su URL final
3. Confirmar que carga `/seguimiento?ticket=...&verifier=...`
4. Confirmar consulta automatica exitosa sin digitar manualmente
5. Probar `/seguimiento?ticket=...` sin `verifier`
6. Confirmar que el ticket se precarga y la pantalla pide solo la validacion faltante
7. Consultar un codigo inexistente
8. Confirmar respuesta clara de no encontrado

## 4. Checklist post-despliegue

- el backend sigue respondiendo despues de reinicio
- las cookies de sesion funcionan en dominio real
- no hay rechazo inesperado por CORS
- las imagenes siguen disponibles despues de reinicio del servicio
- el admin puede volver a iniciar sesion tras cerrar navegador
- el catalogo publico consume API real, no localhost
- el seguimiento publico consulta tickets reales
- el numero de WhatsApp es el correcto

## 5. Riesgos que deben revisarse antes de anunciar

- `UPLOADS_DIR` sin persistencia real
- dominio/cookie mal alineados entre frontend y backend
- `CORS_ORIGIN` demasiado abierto o mal configurado
- falta de HTTPS real si se usa `SESSION_COOKIE_SECURE=true`
- ausencia de backups basicos de PostgreSQL
