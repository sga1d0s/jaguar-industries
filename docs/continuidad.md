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

### Diagnóstico definitivo del puerto pgAdmin

El commit `0bf0936` estaba en GitHub y el contenedor ya tenía `HostConfig.PortBindings` para `192.168.1.96:15433`, pero `NetworkSettings.Ports` seguía vacío. No era un fallo de comentarios YAML ni de actualización del repositorio: Docker 27 del QNAP no activaba la publicación porque db solo pertenecía a `backend` con `internal: true`. El diagnóstico anterior de que el cambio no se había aplicado fue incompleto.

Corrección: conectar db además a una red bridge `db_admin` normal, exclusiva de PostgreSQL; mantener `backend` interna y el puerto vinculado a la IP LAN. Validación: Compose correcto y prueba con PostgreSQL temporal, dos redes equivalentes y puerto LAN 15434; PostgreSQL respondió al protocolo desde el Mac. Contenedor y redes temporales eliminados. Pendiente aplicar este Compose al stack real y comprobar 15433.

## Login confirmado en Android — 17 de octubre de 2026

El usuario confirma que ha instalado el APK generado por Expo y tiene la sesión iniciada en su Android. Queda confirmado desde el dispositivo el recorrido app → HTTPS/Cloudflare → API del NAS → autenticación en PostgreSQL. La restauración tras cerrar/reabrir y el logout todavía no han sido confirmados por el usuario. Para futuras instalaciones prefiere compilar en el Mac e instalar por USB; el APK local fue generado y verificado, pero no consta instalado.

El usuario decidió dejar para más adelante el acceso de pgAdmin. La corrección con red `db_admin` está preparada localmente, junto con su documentación. El intento de commit/push fue rechazado por revisión automática por falta de autorización explícita para push a main; no se reintentó ni se obtuvo autorización. No subir ni desplegar esa corrección hasta retomar ese trabajo con autorización. No impide el login de la app.

El usuario confirma también que sigue conectado tras cerrar completamente y reabrir la app, y que ha probado cerrar sesión y volver a entrar. Quedan verificadas en su Android la entrada con credenciales reales, la restauración de sesión y el cierre de sesión con posterior acceso. Esta confirmación completa las comprobaciones de acceso pendientes descritas anteriormente.

## Mis equipos y ficha — 17 de octubre de 2026

El usuario autorizó implementar el primer recorrido de consulta. Se añaden organizaciones/membresías, modelos, variantes, unidades y asignaciones por venta/alquiler con fechas. Las rutas protegidas `/api/equipment`, `/api/equipment/:id` y `/api/equipment/:id/documents/:documentId` calculan el acceso desde el usuario de sesión y su membresía/asignación actual, sin confiar en organization_id enviado por el móvil. La lista tiene cursor y páginas de 50. Los PDF se transmiten después de comprobar permisos, con no-store y sin carpeta pública.

La app usa AuthProvider compartido y Expo Router para Mis equipos y ficha: fotos oficiales de los modelos, referencia/serie, venta/alquiler, características y documentos. Las fotos públicas se incluyen en la app y sus fuentes están registradas. Se añadió expo-file-system para descargar PDF con cabecera Bearer y abrirlos en el visor nativo; caché temporal separada por cuenta y limpieza al cerrar/invalidar sesión. No hay todavía biblioteca offline, NFC operativo, inspecciones ni panel administrativo.

Referencias reales: AFK3000 (serie 630, 1.000 kg) y AGU101 (BT-10, 1.000 kg). Características y documentos proceden del catálogo Jaguar. Las unidades, series y asignaciones son DEMO y aparecen identificadas como ficticias. No se inventaron UID NFC, certificados individuales ni revisión documental. Scripts nuevos: migrate-equipment.mjs, seed-equipment.mjs (repetibles) y setup-equipment-nas.py (backup privado previo, migración y carga).

Validación completada con PostgreSQL temporal y dos clientes: migraciones/cargas repetibles, dos unidades por cliente, fichas y PDF ajenos rechazados, PDF originales accesibles solo autenticado, membresía revocada sin acceso, regresiones de login/logout y rol limitado. Recursos de pruebas eliminados. Lint/TypeScript pasan; bundle iOS exportado (sin compilación nativa iOS). APK Android local definitivo compilado con firma verificada; segunda compilación 11s tras primera de 2m18s. Imagen NAS disponible `jaguar-api:equipment-check`. Dockerfile ahora se construye desde raíz con `-f apps/api/Dockerfile`; contexto limitado a API y PDF (~14,5 MB); workflow actualizado.

En el NAS se ejecutó setup-equipment-nas.py para la cuenta de Sergio: backup en backups/ ignorado con modo 600, esquema aditivo aplicado y dos unidades DEMO asignadas. No se cambiaron cuentas ni sesiones ni el servicio API. Se pidió al usuario cambiar API_IMAGE a jaguar-api:equipment-check en Portainer, conservando las demás variables/volúmenes. Pendiente confirmar despliegue y comprobar API pública.

El móvil está autorizado por USB. El intento de actualización con adb install -r falló con INSTALL_FAILED_UPDATE_INCOMPATIBLE: la app instalada de Expo tiene una firma distinta. No se desinstaló nada. Se solicitó autorización explícita para desinstalar esa app e instalar el APK local, indicando que se perderá la sesión local y se conservarán cuenta y datos del NAS. Pendiente respuesta; no desinstalar sin ella. No se ha hecho commit ni push de esta implementación.

El usuario confirmó el cambio de API_IMAGE y autorizó reemplazar la app Expo. La lectura limitada del archivo `/data/compose/96/stack.env` confirmó `API_IMAGE=jaguar-api:equipment-check`, pero el contenedor seguía ejecutando `login-check`: falta Pull and redeploy. Se indicaron el botón y la opción de no volver a descargar imágenes. No se leyeron otras variables sensibles del stack. Safari no autorizó Computer Use; no se usó su sesión ni se modificó desde el navegador.

La app anterior dejó de aparecer instalada. Dos intentos de instalar el APK por adb devolvieron INSTALL_FAILED_USER_RESTRICTED (Install canceled by user), incluso tras avisar y obtener confirmación para reintentar. No se debilitó ninguna protección de Android. Se transfirió el APK por USB a `/sdcard/Download/Jaguar-equipos-20261017.apk` (31.157.667 bytes), para que el usuario lo abra desde Descargas y confirme la instalación. Pendiente instalar, redeplegar API y comprobar el recorrido real de Mis equipos y apertura de PDF. La prueba de regresión de login, restauración y logout del APK anterior ya estaba confirmada.

La comprobación posterior confirma que el stack ya ejecuta `jaguar-api:equipment-check` y está saludable. Queda resuelto el cambio de imagen pendiente; no era necesario subir el código para probar esta imagen local del NAS. La instalación manual del APK y la comprobación visual de las nuevas pantallas siguen pendientes de confirmación.

El usuario confirma que ya ha instalado el APK nuevo copiado a Descargas. No se ha confirmado todavía de forma explícita que visualice las dos unidades DEMO, entre en sus fichas y abra los PDF desde el visor del teléfono. No confundir la instalación confirmada con esas comprobaciones funcionales pendientes. La API pública actualizada devuelve 200 en /api/ready y 401 sin sesión tanto en equipos como en descarga de documentos.

El usuario confirma finalmente, en respuesta a la instalación del APK y al redespliegue de Portainer, que ambos pasos están completados y la nueva versión está funcionando. Queda confirmada por el usuario la puesta en marcha de esta entrega en su Android. No se ha recibido una confirmación específica de apertura de cada PDF; las descargas autorizadas y el aislamiento entre clientes sí se verificaron en las pruebas de integración.

## Diseño de Home y NFC sin etiquetas — 17 de octubre de 2026

El usuario aún no tiene etiquetas NFC y pidió diseñar la pantalla y una Home inspirada en la referencia aportada. Se implementó `/inicio` como destino tras login/restauración: perfil real, resumen de equipos/en propiedad/en alquiler, nueve accesos con iconos Feather y colores Jaguar. Mis equipos y Documentación abren el recorrido existente; Avisos, Alquileres, Inspecciones, Certificados individuales y Sin conexión están marcados Próximamente y explican su propósito. Ayuda muestra una guía. Se añadió un botón para volver a Inicio desde la lista y un modo Documentación para seleccionar unidad.

`/escanear` muestra una vista previa con guía visual de acercamiento, pasos del recorrido, indicación explícita de que no lee etiquetas y acceso a una ficha de unidad DEMO autorizada. No hay lector NFC, permisos nuevos, UID simulado ni vinculaciones físicas.

Se añadió GET /api/equipment/summary con el mismo alcance por usuario/membresía y un fallback en la Home a la lista anterior solo si cabe en una página completa. Así se puede revisar con `equipment-check` actual sin cambiar el backend; no se muestran totales parciales ni estados/alertas inventados. No hay cambios de esquema ni de datos reales. Imagen construida para pruebas `jaguar-api:home-check`, no desplegada automáticamente.

Lint y TypeScript pasan; APK Android compilado localmente en 49s y firma verificada; bundle iOS exportado sin compilación nativa iOS. El APK (31.240.819 bytes) se copió por USB a `/sdcard/Download/Jaguar-home-nfc-20261017.apk`. No se ha instalado automáticamente ni se ha desinstalado nada. Pendiente instalarlo y revisar visualmente el diseño en el teléfono. No se ha hecho commit ni push. Se conserva el criterio de comentarios en español.

Las pruebas de integración de `home-check` finalizaron correctamente: resumen 2 equipos/1 venta/1 alquiler/2 DEMO por cliente, resumen vacío tras revocar membresía y regresiones de autenticación, fichas y PDF aislados. Contenedor y red temporales eliminados. La API real continúa con su versión previa; no hace falta cambiar Portainer para revisar la Home con los dos equipos actuales.

## Panel interno Jaguar — 17 de octubre de 2026

El usuario confirma que quiere avanzar con `paneljaguar.sgaldos.com` y elige expresamente **panel interno de Jaguar**, para gestionar clientes, catálogo, unidades y asignaciones. Se implementa `apps/web` con HTML/CSS/JavaScript de módulos, sin dependencias de ejecución, diseño adaptable con colores Jaguar, login con la misma cuenta y permiso interno independiente. Se mantiene el criterio de comentarios en español. Se reutilizan las fotos oficiales y su registro de fuentes.

Pantallas: Vista general con indicadores de actividad real (excluyen DEMO), Clientes con alta y búsqueda, Catálogo con alta de modelo/referencia/características y descarga de los PDF comunes existentes, Unidades con registro de serie, venta, alquiler y devolución. Las unidades DEMO son de consulta. No hay todavía edición/borrado, alta de cuentas/membresías desde el panel, carga de nuevos PDF ni vinculación NFC. Crear un cliente no crea un usuario ni le concede acceso.

La API añade `/api/panel/*` y comprueba sesión activa + fila en `panel_operators` en cada petición. `jaguar_app` solo puede leer ese permiso; no puede concederlo. Las altas, asignaciones y devoluciones registran auditoría en la misma transacción. Se bloquea la unidad al asignar/devolver para impedir carreras. Una venta transfiere la propiedad al cliente y no se puede anular desde esta primera versión; un alquiler conserva la propiedad Jaguar y su finalización conserva el histórico. El esquema se aplica explícitamente con `scripts/migrate-panel.mjs`. `scripts/setup-panel-nas.py --email galdos.sergio@gmail.com` realiza primero copia privada de PostgreSQL y concede acceso interno a esa cuenta existente.

Infraestructura preparada: servicio `web` sin privilegios, raíz de solo lectura y `/tmp` temporal, puerto interno 8080 y LAN 3082 (comprobado libre). Nginx reenvía `/api/` a Node, por lo que el móvil conserva su URL. Nueva variable obligatoria `WEB_IMAGE`; conservar las demás y el volumen. Tras desplegar y comprobar el frontal, cambiar el Service URL de la ruta Cloudflare de `http://api:3000` a `http://web:8080`, manteniendo dominio y red del túnel. El workflow ahora se llama Jaguar Docker, comprueba y publica ambas imágenes con etiquetas por commit. Guía completa en `apps/web/README.md`.

Imágenes construidas en el NAS: `jaguar-api:panel-check` y `jaguar-web:panel-check`. Pruebas unitarias de autenticación y dos ejecuciones completas de integración con base temporal correctas: migraciones repetibles, cuentas de cliente rechazadas del panel, altas/validación, auditoría, asignación concurrente con un solo ganador, devolución concurrente con un solo ganador, propiedad tras venta, permisos de documentos, proxy de solo lectura, CSP y regresiones de móvil/login/logout/aislamiento/revocación. Los recursos temporales se eliminaron. La última reconstrucción web añade solo comentarios explicativos. Comprobaciones de sintaxis, Compose y diff correctas. No hay navegador habilitado en CUA (inventario vacío); no se ha realizado revisión visual en navegador.

Estado al dejar esta entrega preparada: **no se ha aplicado la migración a la base real, concedido permiso interno a Sergio, actualizado el stack, cambiado Cloudflare ni hecho commit/push**. La API real conserva su imagen anterior. Hace falta ejecutar setup-panel-nas.py, subir los cambios para que el stack Git reciba el nuevo Compose, añadir WEB_IMAGE y cambiar API_IMAGE, actualizar sin re-pull para las imágenes locales y finalmente cambiar el origen del túnel. No afirmar que el panel público ya está desplegado. La negativa anterior de revisión automática al push a main sigue sin autorización posterior específica; no se ha reintentado.

## Ampliación del catálogo oficial — 17 de octubre de 2026

El usuario pide descargar más información y documentación de productos de la web oficial e incorporarla para ver más productos en el panel. Se descargan seis familias reales: series 650 (10 referencias), 500 (22 referencias), 900 (7 referencias), BC (5 referencias), EM (6 referencias) y GC (5 referencias): 55 referencias adicionales. Con las dos familias iniciales, la carga deja ocho modelos y 57 referencias si no hay otras altas del usuario. No se crean unidades físicas, series, NFC, cuentas o asignaciones.

Archivos originales y fuentes: 18 vínculos documentales nuevos (ficha/manual/CE por familia) y seis fotos oficiales. El manual 650 es idéntico al 630; se reutiliza su archivo y su registro. Total conservado: 23 PDF distintos y 24 vínculos modelo/documento. El manifiesto registra URL, fecha 2026-10-17, tamaño y SHA-256. Se verifican integridad, apertura de todos los PDF, presencia de las 55 referencias en las fichas y las tablas mediante imágenes renderizadas. El manual EM está escaneado; portada revisada visualmente. Las condiciones EM distinguen carga/espesor para plano y redondo. No se inventan revisiones, planos independientes ni certificados por unidad.

`docs/referencias/productos/catalogo-ampliacion.json` contiene los datos normalizados y las páginas oficiales de origen. `apps/api/scripts/seed-catalog.mjs` importa en transacción con bloqueo de importación, verifica los PDF antes de escribir, conserva ediciones existentes, evita duplicados y comparte manuales por hash. Una referencia de otro modelo cancela la carga. `apps/web/public/product-images.js` conecta las ocho familias con sus fotos; el panel ya no limita las imágenes a 630/BT. No se modifica la app móvil ni se crean más unidades DEMO.

`setup-catalog-nas.py` comprueba que la API activa contiene el catálogo actualizado, hace backup privado y ejecuta la carga con el propietario, sin mostrar credenciales. Las imágenes `jaguar-api:catalog-check` y `jaguar-web:catalog-check` están construidas en el NAS. Para incorporarlo: actualizar ambas variables en Portainer y redeplegar sin re-pull; después ejecutar el script de carga. No cambia Compose ni Cloudflare. Ver `docs/referencias/productos/README.md`.

Se comprobó que el usuario ya desplegó la entrega anterior: API y web `panel-check` saludables. Esta ampliación aún no se ha aplicado a la base real ni desplegado al escribir esta nota. No se ha hecho commit/push. Las comprobaciones de sintaxis y diff pasan; la prueba de integración ampliada está en curso con base temporal. Completar esta nota con su resultado y con el estado real al cerrar el turno.

La prueba completa del catálogo finalizó correctamente: carga repetible con 55 referencias, PDF autenticados y manual compartido, edición de modelo conservada entre cargas y ninguna unidad añadida; pasan también las regresiones de permisos y proxy web/móvil. Base y contenedores temporales eliminados. Se pidió al usuario actualizar API_IMAGE y WEB_IMAGE a las versiones catalog-check sin re-pull; pendiente su respuesta antes de ejecutar la carga real.

El usuario confirma la actualización de las dos imágenes. Se verifican API y web `catalog-check` saludables y se ejecuta `setup-catalog-nas.py` en el NAS: copia previa privada no vacía, modo 600, e importación completada. Antes: 2 modelos, 2 referencias, 2 unidades, 2 asignaciones y 6 documentos. Después: **8 modelos, 57 referencias, las mismas 2 unidades y 2 asignaciones, y 23 documentos**. Cada modelo tiene sus tres documentos aplicables; el manual compartido tiene un único registro.

Verificación real posterior: los 23 PDF registrados existen en la API activa y coinciden en tamaño/SHA-256, comprobado con jaguar_app. En LAN, /api/ready devuelve 200, /api/panel/models sin sesión devuelve 401, y el módulo de imágenes y las seis fotos sirven 200 y coinciden con los archivos locales. El intento automatizado por HTTPS público devolvió 403; no se modificó Cloudflare ni se intentó eludir ese rechazo. No se ha verificado el recorrido autenticado visual en el navegador; el usuario debe recargar Catálogo. No hace falta cambiar la app móvil, el túnel ni las credenciales. Los archivos de la ampliación ya estaban comprometidos por el usuario al empezar este turno (Git limpio); solo se añade esta nota de continuidad, sin commit/push automático.

## CI/CD con Portainer CE — 17 de octubre de 2026

El usuario muestra deliveries 204 pero sin cambios de contenedores y autoriza corregir el flujo. Diagnóstico confirmado: stack usa imágenes locales catalog-check, Compose toma API_IMAGE/WEB_IMAGE de Portainer y workflow solo publica GHCR; el webhook GitHub push llega antes de que termine la construcción y no actualiza las referencias. La ruta infra/compose.portainer.yaml es correcta. No se considera un 204 prueba de despliegue efectivo.

Se implementa publicación en rama dedicada **deploy/production**, manteniendo la misma ruta Compose y el nombre/redes/volumen del stack. El job image publica API y web; el job deploy (solo main, después de ambas) genera Compose con referencias literales por SHA y digest, conserva variables privadas y publica release.json con la versión. Solo deploy tiene contents:write. scripts/publish-release.py usa worktree temporal y push normal a la rama dedicada, nunca a main ni force-push. Rechaza una rama existente sin marcador propio y descarta ejecuciones obsoletas. Todo push a main activa CI, incluso documentación, para no dejar sin reemplazo una ejecución descartada. Concurrencia serializada.

El usuario confirmó haber guardado el secreto de Actions **PORTAINER_STACK_WEBHOOK**. No se leyó ni almacenó su valor en archivos. scripts/notify-portainer.py solo acepta HTTPS y respuesta 204, no sigue redirecciones ni muestra URL/respuesta privada; tiene reintentos acotados. scripts/verify-deployment.py comprueba por HTTPS /api/version, /version.json y /api/ready; falla si sigue otra versión, falta la base o recibe rechazo HTTP. Las imágenes reciben BUILD_REVISION y etiquetas OCI; el frontal incorpora version.json. Las imágenes de prueba NAS cicd-check llevan SHA ficticio a*40 y NO deben desplegarse como versión real de GitHub.

Primera activación pendiente: subir cambios a main para que Actions cree la rama; asegurar acceso de Portainer a ambas imágenes GHCR (credenciales si privadas); cambiar Repository reference del stack existente a refs/heads/deploy/production, manteniendo Compose path, variables y volumen; primer Pull and redeploy. Después crear la variable normal de Actions **PORTAINER_DEPLOY_ENABLED=true**, desactivar el webhook antiguo de push y ejecutar Run workflow para comprobar el recorrido completo. Mientras esa variable no sea true, Actions prepara la rama e informa de activación pendiente sin notificar ni afirmar despliegue. DEPLOY_VERIFY_URL opcional, por defecto https://paneljaguar.sgaldos.com. Las viejas variables API_IMAGE/WEB_IMAGE se conservan pero no controlan las referencias literales de la rama generada. Migraciones/cargas de datos siguen explícitas. Guía completa en infra/CI-CD.md.

Validación local completada: 5 pruebas de render/publicación Git temporal, repetición, main intacta, descarte de ejecuciones antiguas y detección de falsos éxitos; actionlint+shellcheck sin errores; Compose generado válido sin API_IMAGE/WEB_IMAGE; imágenes API/web cicd-check construidas en NAS; integración completa PostgreSQL temporal correcta, incluida coincidencia de revisiones a través del proxy y regresiones de autenticación, catálogo, permisos, asignaciones/documentos. Recursos temporales eliminados. No se cambió el stack real, no se disparó el webhook, no se publicaron imágenes en GHCR ni se hizo commit/push desde el agente. Falta ejecutar el flujo real en GitHub y la configuración inicial de Portainer para afirmar CI/CD activo.

### Cambio de ramas solicitado por el usuario

Antes de subir el CI/CD, el usuario decide usar **dev para desarrollo y main para producción**. Se ajustan los dos workflows (Docker y móvil) para ejecutar comprobaciones con push a dev y main. En Docker, login GHCR y ambas publicaciones exigen explícitamente main y ausencia de evento PR; el job deploy ya tenía esa condición. Ejecutar manualmente sobre dev tampoco publica ni despliega. El flujo de trabajo documentado pasa a desarrollo en dev → PR a main → producción. deploy/production sigue siendo únicamente la rama técnica generada que consume Portainer; no es otra rama de desarrollo ni un entorno adicional. No se han creado ramas remotas, hecho commit/push o cambiado el stack. La petición anterior de subir directamente a main queda sustituida por este flujo dev → PR main.

### Primera publicación real preparada; activación pendiente

El usuario subió los cambios y pregunta por qué no despliega. Se revisó la ejecución real Jaguar Docker 38990382868 del commit 7e4ec103d552fcb6b9d4cc73ea21959c7110b3ea: image y deploy terminaron success; Publish production Compose pasó, pero Notify Portainer y Verify deployed commit quedaron skipped, y Explain first activation pasó. Por tanto PORTAINER_DEPLOY_ENABLED no está activada con el valor exacto true. La rama deploy/production y release.json ya existen con ambas imágenes GHCR fijadas por digest para ese commit. En el NAS siguen API/web jaguar-*:catalog-check saludables, sin actualizar.

Siguiente paso operativo: en el stack existente comprobar/cambiar Repository reference a refs/heads/deploy/production, mantener infra/compose.portainer.yaml y todas las variables/volumen, y hacer el primer Pull and redeploy. Después definir la variable normal de Actions PORTAINER_DEPLOY_ENABLED=true (no secreto), y ejecutar Run workflow en main para comprobar notificación + versión. El secreto PORTAINER_STACK_WEBHOOK ya está guardado. Falta confirmar la referencia de Portainer, su acceso a GHCR y la activación; no afirmar aún que el CI/CD despliega automáticamente.

### Notificación aceptada, verificación 403 y Compose antiguo — 17 de octubre de 2026

El usuario desactivó temporalmente la restricción IP del proxy QNAP y confirmó que Notify Portainer pasó (204), pero Verify deployed commit falló tras 3 minutos con HTTP403. Se comprobaron dos fallos independientes: (1) HTTPS público devuelve Server cloudflare, error code 1010 con el User-Agent de Python; una consulta honesta identificada como Jaguar-Deployment-Check/1.0 y Accept application/json devuelve 200 en /api/ready, sin modificar ni desactivar Cloudflare. Se corrige verify-deployment.py para identificar el comprobador, imprimir progreso y fallar inmediatamente ante401/403. Se añade prueba; seis pruebas pasan. No simula un navegador ni elimina controles.

(2) NAS todavía ejecuta API/web catalog-check; /api/version LAN da404 y /version.json entrega HTML de la SPA antigua. Los logs de Portainer para stack96 muestran repetidamente pull access denied for jaguar-web y fallo al redeplegar. Mediante docker cp en memoria se leyeron únicamente las líneas image del Compose en portainer:/data/compose/96/infra/compose.portainer.yaml: siguen postgres:17-bookworm y las variables API_IMAGE/WEB_IMAGE. Por tanto el Compose descargado no es aún el generado con referencias literales GHCR. Se preguntó al usuario qué Repository reference aparece guardada (main o deploy/production); pendiente respuesta. Revisar cambio/guardado/Pull and redeploy de esa referencia antes de concluir que falla la autenticación GHCR. No se modificó el stack ni la configuración de seguridad. La corrección del comprobador aún está local, pendiente dev → main y ejecución real.

El usuario confirma Repository reference refs/heads/deploy/production. La revisión posterior encuentra un redespliegue real recién completado (logs 01:51–01:52 UTC): API y web ahora ejecutan imágenes GHCR sha-7e4ec103d552fcb6b9d4cc73ea21959c7110b3ea y están saludables. /api/version y /version.json devuelven ese SHA tanto en LAN como por HTTPS, y /api/ready devuelve200/statusok con User-Agent Jaguar-Deployment-Check/1.0. Queda resuelto el Compose antiguo; el diagnóstico anterior describía el estado previo a este redespliegue, no que la referencia declarada por el usuario fuera incorrecta. El bloqueo pendiente del workflow es subir el ajuste local del comprobador (UA/progreso/rechazo401403) a dev e integrarlo a main. Un rerun del commit antiguo seguirá usando el script anterior; ejecutar el flujo del commit que incluya la corrección. El usuario retiró temporalmente su restricción IP QNAP: la conectividad directa desde runners hospedados sigue dependiendo de esa configuración; no afirmar resuelto el diseño de acceso restringido ni activar/cambiar seguridad sin autorización.

## Selección de cliente DEMO al asignar una unidad — 17 de octubre de 2026

El usuario confirma pgAdmin resuelto (usuario jaguar_owner con guion bajo) y detecta que el selector Asignar unidad no permite elegir el cliente DEMO. Se elimina el filtro de clientes DEMO tanto del selector web como de la validación API, manteniendo el permiso interno obligatorio y las comprobaciones de propiedad/asignación. El selector y la columna de cliente identifican esos clientes con DEMO. Los alquileres a organizaciones DEMO se excluyen del indicador de alquileres reales del panel.

La serie DEMO-... de la captura pertenece a una unidad creada desde el panel: el texto de la serie no determina por sí solo is_demo. Esta corrección permite elegir un cliente DEMO para una unidad gestionable; no cambia la condición de consulta de las unidades inicialmente cargadas con is_demo=true, ni convierte automáticamente unidades reales a DEMO. No se modifican datos ni asignaciones reales.

Cambios locales en dev, que ya estaba un commit por delante de origin/dev al empezar: panel.mjs, app.js, README web y prueba de integración. Se conserva ese commit previo del usuario; no se hace commit/push. Imagen de prueba jaguar-api:demo-client-check construida en NAS sin desplegar. Sintaxis/diff correctos. Prueba ampliada en curso: asignación a cliente DEMO, acceso por membresía, exclusión de actividad real y retirada de acceso al devolver; finalizar esta nota con su resultado. Para guardar desde el panel local hará falta que el nuevo backend llegue al NAS mediante dev → main; recargar solo el frontal muestra la opción, pero la API anterior sigue rechazándola.

Prueba completa finalizada correctamente: asignación a cliente DEMO aceptada, consulta de la unidad por su miembro mientras dura el alquiler, retirada de acceso al finalizarlo, indicador de alquileres reales sin incremento y regresiones de concurrencia, auditoría, catálogo, permisos y login correctas. Recursos temporales eliminados. Producción no modificada; pendiente commit/push e integración dev → main para desplegarlo con CI/CD.

## Fotos del catálogo ampliado en la app — 17 de octubre de 2026

El usuario confirma que asignó al cliente DEMO un carro Serie 500 tipo B/empuje de 10.000 kg (ABR5920), serie DEMO-57ebb8ba-513f-44b1-9675-e14bea207524-5, y que la unidad aparece en la app, pero ve el marcador 500 en lugar de una foto. La causa está en productPhoto: el APK previo solo incluía 630 y BT; las seis fotos añadidas al panel web no estaban empaquetadas en móvil.

Se copian las seis fotografías oficiales y el manifiesto de fuentes a assets/products móvil; productPhoto añade rutas literales para códigos 650, 500, 900, BC, EM y GC. La lista y ficha usan el componente compartido, por lo que ambas muestran la foto del modelo. Ocho hashes comprobados. No cambia la API, DB, credenciales ni asignaciones. Los modelos desconocidos conservan marcador. Se leyeron AGENTS móvil y docs Expo58/recursos antes del cambio; comentarios explicativos en español.

Lint y TypeScript pasan; bundle iOS exportado a /tmp/jaguar-mobile-catalog-ios con las ocho imágenes, sin compilación nativa iOS. APK local Android compilado correctamente en50s, firma verificada y bundle incluido. aapt2 confirma explícitamente las ocho imágenes empaquetadas como drawable/assets_products_*. APK de36.307.431 bytes copiado por USB al dispositivo autorizado deday5kbnb6tifce en /sdcard/Download/Jaguar-catalogo-20261017.apk. Se utiliza la misma configuración de firma local; no se desinstala nada ni se intenta adb install (restricción anterior conocida). El usuario pidió seguir mientras compilaba. Pendiente abrirlo desde Descargas e instalar la actualización y confirmar visualmente la foto500 en lista/ficha. No se ha hecho commit/push. Cambios locales sobre main, que estaba limpio al empezar.

## Primera instalación iOS por USB — 17 de octubre de 2026

El usuario solicita compilar localmente e instalar en su iPhone, sin cuenta Apple Developer de pago. Xcode 27.1 disponible. Se genera ios/ mediante Expo prebuild (ignorado por Git), se ejecuta pod install correctamente y pasan lint y TypeScript. El usuario activa modo desarrollador y selecciona su Personal Team en Signing & Capabilities; Xcode crea el certificado y perfil. No se manejan contraseñas ni se aceptan acuerdos por él.

Compilación Release sin firma completada, seguida de compilación firmada para el iPhone 13 mini conectado. Ambas BUILD SUCCEEDED; derivedData en /tmp/jaguar-ios-device-build. codesign --verify --deep --strict pasa. devicectl instala correctamente com.industriasjaguar.mobile por USB. Incluye JS y recursos para funcionar sin Metro. No se modifican backend, DB ni producción, ni se hace commit/push.

El primer launch devuelve error de seguridad que incluye perfil aún no confiado por el usuario. Se solicita al propietario confiar en su cuenta en Ajustes → General → VPN y gestión de dispositivos → App del desarrollador y abrir Jaguar. Pendiente respuesta/confirmación visual del login; no afirmar todavía arranque verificado. Para continuar, comprobar launch tras esa autorización; no desinstalar ni borrar datos. README móvil actualizado con preparación local y estado real.

El usuario confirma que, tras confiar en su firma, ya ve el login en el iPhone. Instalación y primer arranque iOS verificados. Queda por probar el inicio de sesión con su cuenta, equipos, fotografías y documentos; no dar esas comprobaciones por realizadas todavía.

## Alta de cliente con acceso opcional a la app — 17 de octubre de 2026

El usuario acepta incorporar empresa y primer usuario opcional desde el panel, sin permiso interno. Se añade checkbox Crear acceso a la app con nombre de persona, email y contraseña inicial (mínimo 12 caracteres). La API valida, normaliza correo, calcula scrypt y guarda organización, usuario, membresía y auditoría en una transacción. Duplicados devuelven409 y revierten todo; nunca reutiliza ni modifica una cuenta existente. No escribe panel_operators. El listado muestra número de usuarios activos por empresa. No cambia código móvil ni requiere recompilar APK/iOS.

Migración aditiva migrate-client-access.mjs concede a jaguar_app INSERT(name,email,password_hash) sobre users e INSERT(user_id,organization_id) sobre memberships; no concede UPDATE de usuarios ni escritura en panel_operators. migratePanel también incorpora esos permisos para instalaciones nuevas. Script setup-client-access-nas.py hace pg_dump privado antes de aplicarlos. Documentación API/web actualizada.

Imagen jaguar-api:client-access-check construida sin desplegar. Tests unitarios auth y prueba Docker completa con PostgreSQL temporal pasan: login de nueva cuenta, empresa con/sin acceso, aislamiento de equipos, permiso panel denegado, duplicados e inválidos sin organizaciones parciales, auditoría, concurrencia, catálogo y revocación. Recursos temporales retirados por la prueba. Sintaxis y git diff --check correctos. Se añade además ejecución repetida de la migración específica a la prueba para CI; la ejecución local ya realizada comprobó los mismos grants mediante migratePanel.

La revisión automática RECHAZÓ ejecutar setup-client-access-nas.py en producción porque añadir la funcionalidad no constituye autorización explícita para ampliar privilegios persistentes del rol de producción. No se reintenta ni se aplica mediante otra vía. Pendiente autorización del usuario para esos INSERT; después ejecutar el script con copia previa. API/web aún no desplegadas; cambios locales sin commit/push, seguir flujo dev → main. No afirmar funcionalidad activa en NAS todavía.

El usuario autoriza explícitamente la migración con copia previa. Ejecutado setup-client-access-nas.py --image jaguar-api:client-access-check correctamente. Copia privada backups/before-client-access-20261017-061813.sql, 52.287 bytes, modo0600 (no versionar). Verificados los cinco INSERT de columnas necesarios; UPDATE de users e INSERT de panel_operators siguen denegados. API pública /api/ready devuelve status ok tras la migración. No se crean cuentas ni se modifica el despliegue. Queda publicar API/web mediante commit e integración dev → main; no es necesario repetir la migración ni recompilar móvil.

## Refresco automático de equipos e inicio — 17 de octubre de 2026

El usuario detecta que las asignaciones nuevas solo aparecen al actualizar manualmente. Inicio y lista usaban useEffect de primera carga. Se añade hooks/use-live-query.ts con useFocusEffect, AppState y consultas cada15s solo en pantalla enfocada/app activa. Refresca al volver a pantalla o primer plano, comparte bloqueo entre consultas automáticas/manuales/paginación, descarta respuestas de visitas anteriores y limpia timer/suscripción al salir. La lista vuelve a consultar tantas páginas como unidades mostradas, sustituyendo resultados para retirar asignaciones finalizadas. Sin dependencias nuevas ni cambios API/DB. Comentarios en español. Se consultaron docs Expo58, Router y RN AppState.

Lint y TypeScript pasan. APK Release Android y Release iOS firmada compilan correctamente; codesign verifica. APK de36.308.355 bytes copiado al Android de pruebas en Descargas/Jaguar-actualizacion-automatica-20261017.apk, pendiente instalación manual habitual. Actualización iOS instalada correctamente sobre la app existente; intento de launch denegado porque el iPhone está bloqueado. No se desinstala ni borra sesión. Pendiente comprobar visualmente el refresco al asignar/devolver desde el panel con el teléfono desbloqueado. README actualizado. Cambios locales sin commit/push; el repositorio estaba limpio al empezar.
