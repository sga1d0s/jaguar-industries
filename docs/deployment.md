# Despliegue previsto: QNAP y Cloudflare

## Entorno confirmado

- Proyecto: jaguar-industries.
- NAS: QNAP TS-251D, arquitectura Intel x86-64 / linux/amd64.
- Gestión de contenedores: Portainer sobre Docker Standalone.
- Dominio propuesto por el propietario: paneljaguar.sgaldos.com.
- Publicación mediante Cloudflare. Se propone Tunnel; no se ha configurado ninguna ruta ni DNS.
- Pendiente: RAM instalada, versión de Container Station/Docker/Compose y conector Cloudflare existente.

## Recorrido previsto

Internet → Cloudflare HTTPS → cloudflared → gateway HTTP interno.

El gateway enviará `/api` a la API y el resto al panel web. El móvil usará `https://paneljaguar.sgaldos.com/api`. La API accederá a PostgreSQL y archivos privados. Publicar solo el gateway, sin acceso público a PostgreSQL, QTS ni Portainer.

Si cloudflared ya existe, conectar gateway y conector mediante una red Docker compartida explícita. Si es remoto al NAS, definir primero el transporte y la ruta al origen. Si se crea conector propio, usar una red compartida con el gateway y proporcionar el token desde Portainer, fuera de Git.

En Cloudflare, el hostname apuntará a `http://gateway:80` solo cuando ese servicio y su red existan. Esta dirección es una propuesta, no un servicio disponible hoy. Evitar almacenar en caché respuestas de API, autenticación y documentos privados. La autenticación propia y los permisos de la API seguirán siendo obligatorios. Cualquier política Cloudflare Access debe probarse con los clientes móviles, sin incrustar credenciales de servicio en la app.

## Recursos y operación

Construir imágenes linux/amd64 fuera del NAS y desplegar versiones identificadas por commit. El NAS ejecutará las imágenes; no compilará iOS. Empezar con gateway, web, API y PostgreSQL, sin Redis ni almacenamiento S3 adicional hasta necesitarlo. Ajustar límites según RAM disponible y servicios existentes.

El Compose actual solo contiene PostgreSQL. En Portainer configurar POSTGRES_PASSWORD y desplegar sin publicar puertos. No es todavía un despliegue funcional del producto. La API futura tendrá su rol limitado y las migraciones serán un paso explícito del despliegue.

Conservar volumen de PostgreSQL y volumen futuro de documentos. Copias fuera del NAS y restauración probada. Cambiar POSTGRES_PASSWORD en Portainer no cambia automáticamente una contraseña de una base ya inicializada: requiere una operación de rotación en PostgreSQL.

## Fuentes

- QNAP: https://www.qnap.com/en/product/ts-251d/specs/hardware
- Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/get-started/
