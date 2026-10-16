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

No se ha autorizado todavía una primera implementación concreta. Se propuso empezar por la base de la API NestJS y las migraciones de organizaciones, usuarios y equipos, pero el usuario pidió detenerse para aclarar el flujo entre cloud y VS Code. Acordar el primer objetivo antes de crear aplicaciones o desplegar servicios.

Para el despliegue futuro siguen pendientes, entre otros, la RAM del NAS, las versiones de Docker/Compose y la existencia de un conector Cloudflare compartido. Consultar `deployment.md`. No hacen falta esos datos para comenzar a desarrollar código localmente.

## Mensaje para retomar con Codex

> Lee `docs/continuidad.md`, `README.md`, `docs/architecture.md` y `docs/deployment.md`. Comprueba el estado actual de Git y los archivos antes de actuar. El proyecto todavía no tiene código de aplicación; PostgreSQL solo se validó en el entorno cloud, sin despliegue en el NAS. Quiero continuar desde VS Code y acordar el primer objetivo de implementación. Conserva mis cambios locales y actualiza el documento de continuidad cuando terminemos un avance.
