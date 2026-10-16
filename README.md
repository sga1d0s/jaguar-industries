# Jaguar Industries

Monorepo de Jaguar Industries. Primera base de autenticación con API Node/PostgreSQL y app Expo para Android e iOS; el producto de gestión de equipos sigue pendiente.

## Producto

Una app React Native + Expo para iOS y Android, con usuarios internos y clientes. Identificación NFC ISO 15693 (SupraNail 13248), inspecciones y consulta sin conexión. Panel web y API propios alojados en un NAS con Docker y Portainer.

## Estructura prevista

- `apps/mobile`: app Expo, SQLite y sincronización.
- `apps/web`: panel de administración.
- `apps/api`: API modular NestJS y trabajos programados.
- `packages/contracts`: contratos y validación compartidos.
- `packages/domain`: reglas independientes de interfaz y persistencia.
- `infra`: Docker Compose.
- `docs`: arquitectura y decisiones.

## Estado

Incluye arquitectura, PostgreSQL, un servidor Node de infraestructura (`/api/health`), Compose para Portainer y un workflow de construcción/publicación de imagen. No incluye todavía móvil, web, API de negocio, autenticación ni sincronización. Ver [primer despliegue Docker](infra/README.md). No desplegar como producto terminado.

## PostgreSQL en Portainer

El Compose usa Docker Standalone, no Swarm. Crear un stack con `infra/compose.yaml` y proporcionar `POSTGRES_PASSWORD` mediante las variables del stack. Usar una contraseña larga generada por un gestor; no guardarla en Git. Portainer y los administradores de Docker pueden acceder a esa configuración.

El servicio no publica el puerto 5432. La futura API deberá conectarse a `db:5432` dentro del mismo stack. El volumen conserva los datos al recrear el contenedor; no eliminarlo al retirar el stack.

Faltan por ajustar arquitectura del NAS, proxy HTTPS, dominio, almacenamiento y copia de seguridad externa antes de producción. Actualizar imágenes de forma deliberada, previa copia y prueba de restauración.

## Destino de despliegue

QNAP TS-251D (Intel x86-64), con QTS, Docker y Portainer. Dominio previsto: `paneljaguar.sgaldos.com`. Se propone Cloudflare Tunnel; confirmar si ya existe un conector compartido antes de crear otro. Ver `docs/deployment.md`. RAM instalada pendiente de confirmar.

## App y autenticación

Ver [app móvil](apps/mobile/README.md) y [API de autenticación](apps/api/README.md). El login requiere desplegar la nueva imagen, aplicar el esquema y crear una cuenta. La pantalla del móvil no usa credenciales de demostración.
