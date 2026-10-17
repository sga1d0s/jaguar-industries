# Autenticación inicial

Servidor Node con PostgreSQL. Endpoints: `GET /api/health` (proceso HTTP), `GET /api/ready` (acceso al esquema), `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`. La sesión dura 7 días; logout revoca el token. La base guarda hash del token y contraseñas con scrypt y sal. Diez intentos por email cada 15 minutos y máximo ocho logins concurrentes por proceso. No hay registro público ni recuperación de contraseña. Las rutas de equipos comprueban membresía y asignación vigentes por cliente.

## Preparación del despliegue

1. Elegir y guardar `APP_DATABASE_PASSWORD` (al menos 20 caracteres), independiente de `POSTGRES_PASSWORD`, como variable del stack en Portainer.
2. Construir/publicar la nueva imagen. Antes de cambiar el servicio, ejecutar una tarea temporal con esa imagen en la red `jaguar-industries_backend`: `node scripts/migrate.mjs`. Pasar `PGHOST=db`, `PGDATABASE=jaguar`, `PGUSER=jaguar_owner`, `PGPASSWORD` con la contraseña existente del propietario y `APP_DATABASE_PASSWORD` con la nueva del rol limitado. No publicar puertos. La tarea crea tablas y configura `jaguar_app`; es repetible. El administrador ejecuta este paso explícitamente, fuera del arranque de la API.
3. Crear la cuenta inicial con una tarea temporal en la misma red: `node scripts/create-user.mjs email nombre`. Requiere las mismas variables PG del propietario y recibir la contraseña por stdin (mínimo 12 caracteres). No pasar la contraseña como argumento ni guardarla en Git/logs. No ejecutar el comando directamente sin stdin porque esperará la entrada.
4. Actualizar la imagen y el Compose del servicio API. El Compose entrega únicamente las credenciales de `jaguar_app`, que puede leer usuarios y gestionar sesiones e intentos, pero no crear usuarios ni modificar el esquema.
5. Verificar `/api/ready`, login, restauración y logout desde la app. `health` por sí solo no valida autenticación ni PostgreSQL.

No cambiar el nombre del stack ni eliminar el volumen de PostgreSQL. No aplicar estas instrucciones con credenciales de ejemplo.

## Pruebas

`pnpm test` para primitivas de autenticación. Tras construir `jaguar-api:login-check`, `python3 scripts/check-auth-docker.py` crea PostgreSQL temporal, migra dos veces, crea un usuario ficticio y prueba HTTP, revocación, límite de intentos y permisos del rol. El script usa el contexto Docker activo, no publica puertos, no utiliza el volumen real y elimina sus contenedores/red. El workflow ejecuta ambas pruebas antes de publicar la imagen.

## Equipos y documentación

Migración aditiva `node scripts/migrate-equipment.mjs` con el rol propietario. Añade organizaciones, membresías, modelos, variantes, unidades, asignaciones con fechas y documentos compartidos por modelo. La API solo recibe SELECT sobre esas tablas. `node scripts/seed-equipment.mjs correo` añade dos unidades ficticias a un cliente de demostración de esa cuenta y se puede repetir sin duplicarlas. No cambia contraseñas ni crea cuentas. Las referencias AFK3000 y AGU101, las fotos y los PDF proceden del catálogo Jaguar; los números de serie y operaciones de venta/alquiler son DEMO.

Desde el Mac puede ejecutarse `python3 scripts/setup-equipment-nas.py --email correo --image jaguar-api:equipment-check`: conserva una copia privada antes de migrar y cargar datos en el NAS. No actualiza el servicio API. Después seleccionar esa imagen en Portainer (o publicar una versión mediante CI), conservando el resto del stack. La API debe actualizarse antes de probar la pantalla móvil.

Rutas GET protegidas:

- `/api/equipment`: lista paginada, hasta 50 unidades; `nextCursor` permite pedir la siguiente con `?cursor=...`.
- `/api/equipment/:id`: ficha y metadatos de los documentos aplicables.
- `/api/equipment/:id/documents/:documentId`: transmite el PDF después de comprobar la membresía y asignación actuales.

No se acepta un cliente enviado por el móvil para dar acceso: la consulta parte del usuario autenticado. Una unidad o documento ajeno devuelve 404, una sesión inválida 401. Las fotografías públicas de los dos modelos están empaquetadas en la app. Los PDF están incluidos en la imagen API y se sirven con no-store: no existe una carpeta HTTP pública de documentos. No se concede acceso por conocer el UID NFC ni un enlace.

El contexto de construcción cambia a la raíz del repo: `docker build -f apps/api/Dockerfile -t jaguar-api:equipment-check .`. La lista de exclusión evita enviar dependencias, artefactos móviles y credenciales. La variable `DOCUMENTS_ROOT` permite cambiar la ubicación del almacén en una evolución posterior. No se ha implementado subida de documentación, panel administrativo ni sincronización offline.

El script de pruebas también comprueba dos clientes aislados, repetición de migración/carga, lista vacía tras retirar una membresía y descarga de los PDF originales; puede elegirse imagen con `JAGUAR_TEST_IMAGE`.

`GET /api/equipment/summary` devuelve total, ventas, alquileres y unidades DEMO usando el mismo alcance de asignación/membresía. Permite alimentar los indicadores de Home sin descargar todas las páginas. No requiere otra migración. Imagen de comprobación: `jaguar-api:home-check`; la versión anterior sigue siendo compatible con esta primera Home para cuentas cuya lista cabe en una página.
