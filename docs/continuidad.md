# Continuidad del proyecto

Última actualización: 16 de octubre de 2026.

Este documento permite retomar el trabajo con Codex en otro equipo o en una conversación nueva. Describe lo realizado y lo pendiente; las propuestas no equivalen a funcionalidades implementadas. Actualizarlo cuando cambie el estado del proyecto, sin incluir contraseñas ni tokens.

## Estado real

- Repositorio: `sga1d0s/jaguar-industries`, rama `main`.
- Base revisada: commit `add2756293ad7d5360e1a39875e2b52820e9341e` (`first commit`), anterior a este documento.
- Solo existen documentación, `.gitignore`, `pnpm-workspace.yaml` e `infra/compose.yaml`.
- No existen todavía las aplicaciones móvil, web ni API, los paquetes compartidos, autenticación, migraciones o sincronización.
- No hay `package.json`, lockfile ni pruebas de aplicación. No corresponde ejecutar `pnpm install` todavía.
- La estructura `apps/*` y `packages/*` es una previsión, no código existente.

## Objetivo y decisiones documentadas

Producto previsto: aplicación React Native + Expo para iOS y Android, panel web y API NestJS, con identificación NFC, inspecciones y consulta sin conexión.

Consultar las fuentes antes de implementar:

- [README](../README.md): alcance y estructura prevista.
- [Arquitectura](architecture.md): permisos entre organizaciones, funcionamiento offline, sincronización, NFC y recorrido funcional.
- [Despliegue](deployment.md): QNAP TS-251D, Docker/Portainer y propuesta de Cloudflare Tunnel.

El recorrido funcional objetivo es: alta de equipo → vinculación NFC → asignación a cliente → descarga autorizada → consulta e inspección offline → sincronización idempotente → consulta desde el panel del cliente.

## Qué se hizo en el entorno cloud

Se descargó el repositorio en `/workspace/jaguar-industries` y se comprobó el Compose existente, sin modificar sus archivos. Docker y Docker Compose estaban disponibles.

Se arrancó PostgreSQL 17 en Docker **dentro del entorno cloud de Codex**, con el proyecto Compose `jaguar-cloud-dev`. Se verificaron el estado saludable, la conexión TCP con contraseña, la creación de una tabla temporal y la inserción y lectura de datos, terminando con rollback. También se verificó que repetir el arranque funciona.

La contraseña de desarrollo se generó fuera del repositorio, en `/workspace/.jaguar-cloud-local/postgres.env`. No copiarla a este documento ni a Git. El Compose no publica el puerto de PostgreSQL al host. Se guardaron instrucciones de arranque en el campo `start_skill` del borrador del entorno cloud; no se ha confirmado su publicación.

Estas comprobaciones validan únicamente PostgreSQL y el Compose en aquel entorno. No demuestran funcionamiento de una aplicación. Los procesos pueden detenerse y no se deben suponer activos al retomar otra sesión.

**No se desplegó nada en el NAS ni se instaló PostgreSQL en el Mac durante esta conversación.** La base cloud es independiente de cualquier base del NAS o del Mac. No se configuraron DNS, Cloudflare ni acceso al NAS.

## Trabajar desde el Mac y desde cloud

- Carpeta local indicada por el usuario: `/Users/sgaldos/PROJECTS/jaguar-industries`.
- Carpeta cloud: `/workspace/jaguar-industries`.
- Son copias independientes. No hay sincronización automática de archivos ni de bases de datos.
- GitHub permite compartir cambios mediante commit, push y pull.
- El usuario quiere poder editar el código en VS Code y retomar allí el trabajo con Codex. Esta conversación cloud no ofrece ese editor local.
- Git no transporta conversaciones, dependencias instaladas, contenedores, volúmenes ni archivos ignorados. Una conversación nueva debe leer este documento.

Antes de cambiar de equipo, revisar `git status`, guardar los cambios pertinentes en un commit y hacer push. En el otro equipo, revisar primero que no haya cambios locales pendientes y después actualizar la rama. No sobrescribir trabajo local ni forzar la sincronización.

Para retomar en el Mac, si la copia está limpia y en `main`:

```bash
cd /Users/sgaldos/PROJECTS/jaguar-industries
git status
git pull --ff-only origin main
code .
```

Si `code` no está disponible, abrir esa carpeta desde VS Code. Si Git encuentra cambios incompatibles o ramas divergentes, revisarlos antes de continuar. Las herramientas y servicios del Mac deben comprobarse allí; el éxito en cloud no implica que estén instalados localmente.

## Próximo trabajo pendiente

El usuario prefiere concretar el flujo y las pantallas antes de implementar la API. Jaguar vende o alquila equipos a clientes; los clientes los usan y consultarán características, planos, montaje y uso en la app. Cada unidad física llevará su propia etiqueta NFC y unidades iguales compartirán documentación. No se ha acordado retirar las inspecciones del alcance; su prioridad queda pendiente.

Se descargaron seis PDF públicos (ficha, manual y declaración CE de la serie 630 y del modelo BT) en `docs/referencias/productos/`, con fuentes y hashes. Consultar su README para las implicaciones propuestas en el modelo de datos. No hay implementación de pantallas ni importación de catálogo.

El usuario quiere montar CI/CD con Portainer Community Edition 2.33.1 LTS y confirma que no tiene túnel de Cloudflare. Se ha propuesto GitHub Actions para construir imágenes, GHCR para almacenarlas y Portainer para desplegarlas; la compatibilidad y configuración exactas siguen pendientes. No se ha configurado ni desplegado nada. Acordar el primer objetivo antes de crear aplicaciones o desplegar servicios.

Para el despliegue futuro siguen pendientes, entre otros, la RAM del NAS, las versiones de Docker/Compose y la configuración de un nuevo túnel Cloudflare. Consultar `deployment.md`. No hacen falta esos datos para comenzar a desarrollar código localmente.

## Mensaje para retomar con Codex

> Lee `docs/continuidad.md`, `README.md`, `docs/architecture.md` y `docs/deployment.md`. Comprueba el estado actual de Git y los archivos antes de actuar. El proyecto todavía no tiene código de aplicación; PostgreSQL solo se validó en el entorno cloud, sin despliegue en el NAS. Quiero continuar desde VS Code y acordar el primer objetivo de implementación. Conserva mis cambios locales y actualiza el documento de continuidad cuando terminemos un avance.

## Avance local: infraestructura Docker

El usuario autorizó empezar por Docker y eligió el nombre de stack `jaguar-industries`; confirma que aún no existe. Se conserva `infra/compose.yaml` y se añade `infra/compose.portainer.yaml` (PostgreSQL + servidor Node mínimo), `infra/compose.tunnel.yaml` opcional, variables de ejemplo e instrucciones en `infra/README.md`. `apps/api/server.mjs` solo sirve `/api/health`: no es NestJS ni API de negocio, no conecta a la DB. No se ha configurado autenticación ni migraciones.

El workflow `.github/workflows/docker.yml` prepara validación, prueba HTTP y publicación de imagen linux/amd64 en GHCR. No se ha subido ni ejecutado en GitHub; CD automático sigue pendiente. No hacer push sin revisar los cambios del usuario y el alcance.

El contexto Docker del Mac apunta al QNAP `192.168.1.96:2376`. Se consultó sin modificar servicios existentes: Docker `27.1.2-qnap8`, x86-64, unos 9,6 GiB de RAM visibles. El Mac tiene `docker-compose` independiente, pero no `docker compose`. No confundir el motor remoto con un Docker local. No se ha desplegado el stack ni creado el túnel. Los apartados de estado inicial anteriores describen la situación previa a este avance.

Verificación realizada: ambos Compose pasan `docker-compose config --quiet`; la imagen `jaguar-api:infra-check` se construyó correctamente en el NAS. Un contenedor temporal, sin puertos ni volúmenes, respondió correctamente a `/api/health` y devolvió 404 para una ruta desconocida; se detuvo con código 0 y se eliminó. No se esperó al ciclo del healthcheck Docker ni se verificó todavía el stack completo con PostgreSQL. La imagen queda disponible para el primer despliegue desde el editor de Portainer.

El usuario creó el stack `jaguar-industries` en Portainer. Verificado después mediante Docker remoto y HTTP: `jaguar-industries-db-1` (PostgreSQL 17) y `jaguar-industries-api-1` (`jaguar-api:infra-check`) están saludables. `http://192.168.1.96:3080/api/health` devuelve `status: ok`. PostgreSQL no publica puertos. Esto confirma el primer despliegue en el NAS, sustituyendo las afirmaciones anteriores de que aún no se había desplegado. El servidor sigue sin conectar a PostgreSQL. Cloudflare y CI/CD continúan pendientes.

## Cloudflare operativo — 17 de octubre de 2026

El usuario confirma que ha resuelto el CI/CD; su funcionamiento no se ha auditado en esta conversación. Se creó el túnel `jaguar-industries` en Cloudflare y el usuario desplegó el conector en un stack independiente siguiendo las instrucciones para `jaguar-tunnel`, conectado a la red externa `jaguar-industries_edge`. No se han leído ni guardado tokens en el repositorio. La captura de Cloudflare confirma una ruta Published application de `paneljaguar.sgaldos.com` a `http://api:3000`. Se comprobó desde Internet con curl: `https://paneljaguar.sgaldos.com/api/health` devuelve `{"status":"ok","service":"jaguar-api","stage":"infrastructure"}`. Quedan así verificados DNS, HTTPS, túnel y respuesta HTTP de Node; no verifica conexión a PostgreSQL ni funciones de negocio. El Compose del túnel independiente aún debe reflejarse en los archivos del repositorio; el archivo opcional original describe el despliegue dentro del mismo stack.

## Primera app y autenticación — 17 de octubre de 2026

El usuario pidió conectar todo y tener la app instalada con login. Objetivo Android e iOS; tiene cuenta Expo y un Android para probar, pero no Apple Developer. Se creó `apps/mobile` con Expo SDK 58, React Native, Expo Router, login, recuperación de sesión con validación remota, SecureStore y logout. URL pública: `https://paneljaguar.sgaldos.com/api`. Lint y TypeScript pasan; los bundles Android e iOS se han exportado correctamente (no equivale a una compilación nativa iOS).

La API Node incorpora `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` y `/api/ready`, sesiones opacas con caducidad y hash almacenado, contraseñas scrypt con sal, límites de intentos y rol PostgreSQL limitado `jaguar_app`. Migración y alta de usuario son tareas explícitas; no hay registro público ni recuperación de contraseña. No se ha migrado a NestJS ni implementado autorización sobre organizaciones/equipos.

Pruebas de primitivas y recorrido HTTP con PostgreSQL temporal en el NAS completadas: migración repetible, login incorrecto/correcto, sesión, logout/revocación, límite de intentos y rechazo de UPDATE/DROP con el rol limitado. Recursos temporales eliminados; imagen de prueba disponible `jaguar-api:login-check`. Se actualiza Docker y el workflow para dependencias y comprobaciones; se añade CI móvil.

Expo EAS se vinculó con `@sgaldos/jaguar-industries` (projectId `0ce754ea-1352-4b24-9087-7aaf83e4acee`). El usuario inició sesión en su terminal. EAS creó la clave Android y recibió el primer build preview APK: https://expo.dev/accounts/sgaldos/projects/jaguar-industries/builds/4af82380-e16a-43df-b22b-0c5ed3570acc . Último estado consultado: IN_PROGRESS. No se ha publicado en tiendas ni instalado todavía en el teléfono. La compilación enviada precede a un ajuste menor de la restauración asíncrona para satisfacer lint y a la deduplicación del plugin de Router; verificar/recompilar la revisión final antes de distribuir una versión definitiva.

Cuenta solicitada: Sergio, `galdos.sergio@gmail.com`. Se pidió al usuario ejecutar `scripts/setup-auth-nas.py --image jaguar-api:login-check --email galdos.sergio@gmail.com --name Sergio` para introducir la contraseña en privado, hacer copia antes de migrar, crear esquema/cuenta y guardar la contraseña independiente del rol API en `infra/.env.login.local` (ignorada, modo 600). Copias en `backups/` ignoradas. Debe añadir `APP_DATABASE_PASSWORD` a Portainer y desplegar el Compose actualizado. Pendiente de confirmar estas acciones y verificar `/api/ready` y login público. No asumir que `/api/health` valida login.

El usuario confirmó ejecutar el script de preparación y añadir `APP_DATABASE_PASSWORD` en Portainer. Se verificó directamente en PostgreSQL que la cuenta solicitada existe y está activa (sin consultar hashes ni contraseñas). La API seguía con `jaguar-api:infra-check` y sin variables PG; `/api/ready` devolvía 404. Se pidió actualizar el stack con `infra/compose.portainer.yaml` y `API_IMAGE=jaguar-api:login-check` para el primer ensayo completo antes de integrar la publicación de esta revisión con CI/CD.

Actualización del stack confirmada mediante comprobación real: `jaguar-industries-api-1` ejecuta `jaguar-api:login-check` y está saludable, al igual que PostgreSQL. La URL pública `/api/ready` devuelve HTTP 200 con `status: ok`; `/api/auth/login` con credenciales ficticias incorrectas devuelve HTTP 401 y el mensaje esperado. Queda validada la conexión API–PostgreSQL y el endpoint de autenticación a través de Cloudflare. Falta probar login correcto/restauración/logout desde el teléfono con la contraseña del usuario. No se han consultado ni compartido sus credenciales.

## Compilación local como flujo habitual — 17 de octubre de 2026

El usuario prefiere compilar en el Mac y pasar el APK al móvil, como hacía antes; EAS cloud queda como alternativa. Esta preferencia explícita sustituye la recomendación de usar EAS que trae el AGENTS.md generado por la plantilla móvil. Se añade `pnpm android:apk` (script `scripts/build-android-local.sh`) para generar el proyecto Android si falta y ejecutar Gradle assembleRelease para ARM64. Conserva el proyecto generado entre builds para reutilizar trabajo; tras cambios nativos/configuración se regenera con Expo prebuild. `pnpm android` sirve para desarrollo debug con instalación y Metro.

Se comprobó JDK 17 y Android SDK existentes en el Mac. Gradle descargó la versión 9.4.1 y añadió Build Tools 37 y Platform 37 usando las licencias ya aceptadas. Primera compilación nativa local completada: BUILD SUCCESSFUL en 4m14s. APK en `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`, 28,1 MiB, ARM64, firma verificada con apksigner y bundle JavaScript embebido confirmado. Se usa la firma de depuración de la plantilla para pruebas locales; no es una firma de publicación y puede diferir de EAS. No hay teléfono conectado por adb, por lo que aún no se ha instalado ni probado login en dispositivo. Lint y TypeScript pasan. Instrucciones actualizadas en `apps/mobile/README.md`.

Segunda ejecución del comando local verificada: BUILD SUCCESSFUL en 12s, con 542 de 563 tareas ya actualizadas. No se recompiló desde cero.

## Preferencia de lectura del código

El usuario pide comentarios en español que expliquen qué hace cada bloque. Se comentaron los bloques principales de la app, API, autenticación, conexión a PostgreSQL, migraciones y scripts de preparación, pruebas y compilación local. Mantener este criterio en las próximas implementaciones, explicando intención y decisiones sin comentar cada línea obvia. No cambia el comportamiento.

## Acceso pgAdmin desde el Mac — 17 de octubre de 2026

El usuario autorizó publicar PostgreSQL en la IP LAN del NAS para conectar su pgAdmin instalado. Se comprobó por SSH que QNAP tiene `AllowTcpForwarding no`, causa del fallo del túnel. El puerto propuesto 15432 ya lo usa `ibex-postgres-1`; se elige 15433, libre en la comprobación. Se añade al servicio db de `infra/compose.portainer.yaml` el mapeo `${JAGUAR_BIND_IP}:${JAGUAR_DB_PORT:-15433}:5432`, con comentarios y variable de ejemplo. No se cambia el volumen ni el puerto interno utilizado por la API. No se ha actualizado todavía el stack: pendiente de aplicar desde Portainer y verificar la conexión LAN. Los apartados anteriores que indican que PostgreSQL no publica puertos describen el estado previo a este cambio.
