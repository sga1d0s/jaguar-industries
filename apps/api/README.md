# Autenticación inicial

Servidor Node con PostgreSQL. Endpoints: `GET /api/health` (proceso HTTP), `GET /api/ready` (acceso al esquema), `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`. La sesión dura 7 días; logout revoca el token. La base guarda hash del token y contraseñas con scrypt y sal. Diez intentos por email cada 15 minutos y máximo ocho logins concurrentes por proceso. No hay registro público, recuperación de contraseña ni permisos sobre equipos todavía.

## Preparación del despliegue

1. Elegir y guardar `APP_DATABASE_PASSWORD` (al menos 20 caracteres), independiente de `POSTGRES_PASSWORD`, como variable del stack en Portainer.
2. Construir/publicar la nueva imagen. Antes de cambiar el servicio, ejecutar una tarea temporal con esa imagen en la red `jaguar-industries_backend`: `node scripts/migrate.mjs`. Pasar `PGHOST=db`, `PGDATABASE=jaguar`, `PGUSER=jaguar_owner`, `PGPASSWORD` con la contraseña existente del propietario y `APP_DATABASE_PASSWORD` con la nueva del rol limitado. No publicar puertos. La tarea crea tablas y configura `jaguar_app`; es repetible. El administrador ejecuta este paso explícitamente, fuera del arranque de la API.
3. Crear la cuenta inicial con una tarea temporal en la misma red: `node scripts/create-user.mjs email nombre`. Requiere las mismas variables PG del propietario y recibir la contraseña por stdin (mínimo 12 caracteres). No pasar la contraseña como argumento ni guardarla en Git/logs. No ejecutar el comando directamente sin stdin porque esperará la entrada.
4. Actualizar la imagen y el Compose del servicio API. El Compose entrega únicamente las credenciales de `jaguar_app`, que puede leer usuarios y gestionar sesiones e intentos, pero no crear usuarios ni modificar el esquema.
5. Verificar `/api/ready`, login, restauración y logout desde la app. `health` por sí solo no valida autenticación ni PostgreSQL.

No cambiar el nombre del stack ni eliminar el volumen de PostgreSQL. No aplicar estas instrucciones con credenciales de ejemplo.

## Pruebas

`pnpm test` para primitivas de autenticación. Tras construir `jaguar-api:login-check`, `python3 scripts/check-auth-docker.py` crea PostgreSQL temporal, migra dos veces, crea un usuario ficticio y prueba HTTP, revocación, límite de intentos y permisos del rol. El script usa el contexto Docker activo, no publica puertos, no utiliza el volumen real y elimina sus contenedores/red. El workflow ejecuta ambas pruebas antes de publicar la imagen.
