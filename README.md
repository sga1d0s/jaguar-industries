# Jaguar Industries

Monorepo de Jaguar Industries: API Node/PostgreSQL, app Expo para Android e iOS y panel web interno alojado en el NAS.

## Producto

Una app React Native + Expo para iOS y Android, con usuarios internos y clientes. Identificación NFC ISO 15693 (SupraNail 13248), inspecciones y consulta sin conexión. Panel web y API propios alojados en un NAS con Docker y Portainer.

## Estructura prevista

- `apps/mobile`: app Expo, SQLite y sincronización.
- `apps/web`: panel de administración.
- `apps/api`: API Node con autenticación, consulta por cliente y gestión interna.
- `packages/contracts`: contratos y validación compartidos.
- `packages/domain`: reglas independientes de interfaz y persistencia.
- `infra`: Docker Compose.
- `docs`: arquitectura y decisiones.

## Estado

Incluye API con autenticación y consulta de equipos/documentos por cliente; app Expo con login, Home, Mis equipos y ficha; panel interno con clientes, catálogo, unidades y asignaciones; Compose para Portainer y workflows de comprobación/publicación. NFC es una vista previa sin lectura física; sincronización offline, inspecciones y carga de nuevos documentos siguen pendientes. Ver [panel interno y despliegue](apps/web/README.md).

## PostgreSQL en Portainer

El Compose usa Docker Standalone, no Swarm. Crear un stack con `infra/compose.yaml` y proporcionar `POSTGRES_PASSWORD` mediante las variables del stack. Usar una contraseña larga generada por un gestor; no guardarla en Git. Portainer y los administradores de Docker pueden acceder a esa configuración.

El stack actual usa `infra/compose.portainer.yaml`, con PostgreSQL en `db:5432` y acceso LAN para pgAdmin en `192.168.1.96:15433`. La API utiliza su propio rol limitado. El volumen conserva los datos al recrear el contenedor; no eliminarlo al retirar el stack.

Faltan por ajustar arquitectura del NAS, proxy HTTPS, dominio, almacenamiento y copia de seguridad externa antes de producción. Actualizar imágenes de forma deliberada, previa copia y prueba de restauración.

## Destino de despliegue

QNAP TS-251D (Intel x86-64), con QTS, Docker y Portainer. Cloudflare Tunnel conecta `paneljaguar.sgaldos.com` con Jaguar. La entrega web requiere cambiar su origen de `http://api:3000` a `http://web:8080` después de desplegar el frontal. Ver [despliegue](docs/deployment.md).

## App y autenticación

Ver [app móvil](apps/mobile/README.md) y [API de autenticación](apps/api/README.md). El login requiere desplegar la nueva imagen, aplicar el esquema y crear una cuenta. La pantalla del móvil no usa credenciales de demostración.
