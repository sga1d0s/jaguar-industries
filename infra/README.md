# Primer despliegue en Portainer

Estado: infraestructura inicial. El servidor Node solo responde a `GET /api/health`; no implementa el producto ni conecta con PostgreSQL. Su estado saludable verifica HTTP, no la base de datos. El Compose espera a que PostgreSQL esté saludable antes de arrancarlo. El rol limitado de la futura API y las migraciones siguen pendientes; no se entrega la contraseña del propietario al servidor.

## Archivos

- `compose.yaml`: PostgreSQL original para desarrollo, conservado.
- `compose.portainer.yaml`: stack inicial con PostgreSQL y Node.
- `compose.tunnel.yaml`: archivo adicional para activar Cloudflare más adelante.
- `.env.example`: nombres de variables; los valores reales se introducen en Portainer.

## Desplegar los dos primeros contenedores

Nombre elegido: **jaguar-industries**. El NAS comprobado tiene IP LAN `192.168.1.96`, Docker `27.1.2-qnap8`, x86-64 y unos 9,6 GiB de RAM visibles. No se encontraron contenedores Jaguar en la comprobación inicial.

1. Construir la imagen en GitHub con el workflow `API Docker` (requiere subir los archivos al repositorio). Publica `ghcr.io/sga1d0s/jaguar-industries-api:sha-<SHA completo del commit>` tras validar Compose y probar HTTP. También puede ejecutarse manualmente con `workflow_dispatch`.
2. Si el paquete GHCR es privado, registrar `ghcr.io` en Portainer con credenciales de lectura de paquetes. No incluirlas en Git. El acceso al repositorio Git privado se configura por separado.
3. En **Stacks → Add stack**, nombre `jaguar-industries`. Elegir repositorio Git `https://github.com/sga1d0s/jaguar-industries`, referencia `refs/heads/main`, Compose path `infra/compose.portainer.yaml`. Para una primera prueba también puede pegarse ese YAML en el editor web.
4. Introducir las variables:
   - `POSTGRES_PASSWORD`: contraseña nueva generada por un gestor.
   - `API_IMAGE`: imagen con etiqueta de commit publicada. Para la prueba local inicial ya se ha construido `jaguar-api:infra-check` en el NAS, una vez confirmada la compilación.
   - `JAGUAR_BIND_IP`: `192.168.1.96`.
   - `JAGUAR_HTTP_PORT`: `3080` (comprobar que está libre).
5. Desplegar. Deben aparecer `db` y `api` saludables. Abrir desde la LAN `http://192.168.1.96:3080/api/health`; debe devolver JSON con `status: ok`.

PostgreSQL publica el puerto interno 5432 en la IP LAN indicada por `JAGUAR_BIND_IP`, puerto externo `JAGUAR_DB_PORT` (15433 por defecto), para pgAdmin. No añadir una ruta Cloudflare ni reenvío en el router para PostgreSQL. El volumen esperado para este nombre de stack es `jaguar-industries_postgres_data`. Conservarlo al recrear el stack. Cambiar `POSTGRES_PASSWORD` no rota una contraseña de una base ya inicializada.

## Crear el túnel después

1. Crear un túnel administrado remotamente en Cloudflare para Jaguar y guardar su token en Portainer como `TUNNEL_TOKEN`, fuera de Git y del chat.
2. Definir `CLOUDFLARED_IMAGE` con una versión fija disponible de `cloudflare/cloudflared`.
3. Añadir `infra/compose.tunnel.yaml` como archivo Compose adicional en el mismo stack.
4. Crear la ruta pública `paneljaguar.sgaldos.com` al servicio `http://api:3000`. Es el origen temporal para comprobar infraestructura; cuando exista web/gateway cambiaremos el destino.
5. Verificar `https://paneljaguar.sgaldos.com/api/health`. Después puede retirarse `ports` del servicio `api` si ya no se necesita acceso LAN directo. No crear redirecciones de puertos en el router.

Guía oficial: https://developers.cloudflare.com/tunnel/get-started/

## CI y CD

El workflow preparado valida Compose, construye y prueba una imagen linux/amd64 y publica en GHCR al subir cambios relevantes a `main`. Una PR valida sin publicar. No hay despliegue automático todavía: inicialmente se cambia `API_IMAGE` en Portainer y se actualiza el stack después de cada publicación.

Para CD automático falta elegir y probar el mecanismo concreto en Portainer CE 2.33.1: actualización desde Git disponible en la instalación o un runner privado que invoque su API. No se expone Portainer a Internet. La automatización tendrá que cambiar la referencia de imagen solo tras publicar correctamente; un simple sondeo del código no garantiza ese orden. No usar una etiqueta mutable `latest` como sustituto de este paso.

Guía oficial: https://docs.portainer.io/user/docker/stacks/add

## pgAdmin instalado en el Mac

QNAP tiene `AllowTcpForwarding no`, por lo que el túnel SSH de pgAdmin no funciona con la configuración actual. Se ha preparado acceso directo por la IP LAN del NAS. El puerto 15432 pertenece a la base de Ibex; Jaguar usa 15433. Actualizar el stack existente desde `compose.portainer.yaml` conservando sus variables y volumen. Puede definirse `JAGUAR_DB_PORT=15433` explícitamente en Portainer.

En pgAdmin registrar `Jaguar NAS`: host `192.168.1.96`, puerto `15433`, base de mantenimiento `jaguar`, usuario `jaguar_owner` y su `POSTGRES_PASSWORD` existente. Desactivar SSH Tunnel. Este usuario permite administración completa: su contraseña no es la del login móvil ni `APP_DATABASE_PASSWORD`. La API continúa usando el rol limitado y `db:5432`.

La vinculación usa la IP LAN del NAS; no equivale a una regla de firewall por IP de cliente. No publicar ese puerto en el router ni en Cloudflare.
