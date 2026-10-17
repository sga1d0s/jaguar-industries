# Despliegue: QNAP y Cloudflare

## Entorno confirmado

- NAS QNAP TS-251D, linux/amd64, Docker 27.1.2-qnap8 y unos 9,6 GiB visibles.
- Portainer Community Edition 2.33.1 LTS, Docker Standalone.
- Stack `jaguar-industries`: PostgreSQL y API, volumen `jaguar-industries_postgres_data`.
- Stack separado `jaguar-tunnel`: cloudflared conectado a `jaguar-industries_edge`.
- Dominio `paneljaguar.sgaldos.com`, túnel conectado; origen actual `http://api:3000`.

## Entrega del panel interno

El servicio `web` sirve los archivos del panel y actúa como proxy para `/api/`. Tras desplegar y comprobar su estado saludable, cambiar el origen de la ruta publicada a **`http://web:8080`**. El móvil conserva `https://paneljaguar.sgaldos.com/api`; su autorización por cliente continúa en la API.

Recorrido: Internet → Cloudflare HTTPS → cloudflared → web:8080 → api:3000 → db:5432.

Seguir [la guía completa](../apps/web/README.md) para construir imágenes, aplicar la migración aditiva con copia previa, conceder acceso a la cuenta interna y actualizar Portainer. Variables nuevas: `WEB_IMAGE` y, opcionalmente, `JAGUAR_WEB_PORT` (3082). Conservar las demás variables y el volumen. Si el stack procede de Git, requiere los archivos actualizados en el remoto.

El frontal no accede directamente a PostgreSQL. Las cuentas de cliente no tienen permiso de panel; se comprueba una autorización independiente en `panel_operators` en cada petición. El navegador mantiene el token solo en el almacenamiento de sesión de su pestaña. Las descargas se autentican y las respuestas privadas llevan `no-store`.

## Acceso local y operación

- API LAN: `http://192.168.1.96:3080/api/ready`.
- Panel LAN tras despliegue: `http://192.168.1.96:3082`.
- pgAdmin LAN: `192.168.1.96:15433`; PostgreSQL permanece en `db:5432` para la API.

La red `backend` es interna. PostgreSQL tiene además `db_admin`, necesaria para activar la publicación LAN en este Docker; el frontal solo pertenece a `edge`. No se publica PostgreSQL, QTS ni Portainer mediante el túnel.

El workflow `Jaguar Docker` valida y publica ambas imágenes y prepara la rama `deploy/production` con el Compose fijado por commit y digest. Tras la primera configuración de Portainer y la variable `PORTAINER_DEPLOY_ENABLED=true`, llama al webhook al terminar y verifica las versiones servidas de API y web. Seguir [la activación de CI/CD](../infra/CI-CD.md). Las imágenes locales anteriores fueron el procedimiento de prueba manual.

Las migraciones se ejecutan explícitamente con el propietario; el servidor usa `jaguar_app`. Cambiar `POSTGRES_PASSWORD` en Portainer no rota la contraseña de una base inicializada. Conservar copias fuera del NAS y verificar restauraciones antes de dar el servicio por listo para producción.

## Fuentes

- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/)
- [Stacks de Portainer](https://docs.portainer.io/user/docker/stacks/add)
- [NGINX sin privilegios](https://github.com/nginx/docker-nginx-unprivileged)
