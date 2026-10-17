# Panel interno Jaguar

Frontal sin dependencias de ejecución: HTML, CSS y JavaScript de módulos. Nginx sirve los archivos y reenvía `/api/` al servidor Node. El panel usa PostgreSQL a través de la API; nunca conecta directamente con la base de datos.

Incluye login con cuenta existente y permiso interno independiente, resumen, alta de clientes, modelos y referencias con características, descarga autenticada de los documentos comunes existentes, registro de unidades, venta, alquiler y finalización de alquiler. Las operaciones guardan un registro de auditoría. Las unidades DEMO aparecen identificadas y son de consulta; no cuentan como actividad real.

El alta de cliente crea una organización, no una cuenta ni una membresía. La carga de nuevos documentos, edición/borrado, usuarios, vinculación NFC y gestión de incidencias quedan fuera de esta primera entrega. Una venta transfiere la propiedad y no se anula desde este panel; el alquiler permite devolver la unidad conservando su histórico.

## Desarrollo

Desde la raíz: `pnpm --filter @jaguar/web start`. Abre `http://127.0.0.1:4173`. El proxy de desarrollo usa la API pública por defecto; puedes indicar `JAGUAR_PREVIEW_API=http://192.168.1.96:3080` para la LAN. Es una conexión real: guardar formularios modifica la base seleccionada. Para comprobar sintaxis: `pnpm --filter @jaguar/web check`.

## Preparar el NAS

Construir imágenes no cambia el servicio actual:

```sh
docker build -t jaguar-api:panel-check -f apps/api/Dockerfile .
docker build -t jaguar-web:panel-check apps/web
```

Preparar esquema y autorizar explícitamente una cuenta existente (hace primero una copia privada en `backups/`):

```sh
python3 scripts/setup-panel-nas.py --email galdos.sergio@gmail.com
```

La migración es aditiva y repetible. La API puede leer `panel_operators`, pero no conceder ese permiso. Para revocarlo se elimina su fila desde una conexión del propietario de PostgreSQL; se comprueba de nuevo en cada petición, sin esperar a que expire la sesión.

## Desplegar en Portainer y Cloudflare

1. Aplicar `infra/compose.portainer.yaml` actualizado, conservando todas las variables y el volumen PostgreSQL.
2. Establecer `API_IMAGE=jaguar-api:panel-check` y añadir `WEB_IMAGE=jaguar-web:panel-check`. `JAGUAR_WEB_PORT=3082` es opcional y es su valor por defecto. Actualizar sin volver a descargar estas imágenes locales.
3. Comprobar `http://192.168.1.96:3082/healthz`, el login y `http://192.168.1.96:3082/api/ready`.
4. En la ruta publicada de `paneljaguar.sgaldos.com`, cambiar solo Service URL de `http://api:3000` a `http://web:8080`. El túnel debe seguir conectado a `jaguar-industries_edge`.
5. Comprobar el acceso HTTPS del panel y `/api/ready`. La app móvil mantiene la misma URL `/api` y sus permisos por cliente.

Si el stack usa Git, los cambios deben estar primero en el repositorio remoto para que Portainer los reciba. El workflow de Docker comprueba ambas imágenes y publica etiquetas inmutables `ghcr.io/sga1d0s/jaguar-industries-{api,web}:sha-COMMIT`; usar las dos del mismo commit en despliegues posteriores.

La imagen oficial [NGINX sin privilegios](https://github.com/nginx/docker-nginx-unprivileged) escucha en 8080 y usa `/tmp` para archivos temporales. Compose conserva la raíz de solo lectura y monta solo ese directorio como temporal.

## Comprobaciones aisladas

```sh
JAGUAR_TEST_IMAGE=jaguar-api:panel-check JAGUAR_TEST_WEB_IMAGE=jaguar-web:panel-check python3 scripts/check-auth-docker.py
```

La prueba crea y elimina su PostgreSQL y red temporales. Comprueba autorización interna, aislamiento de clientes, validación, asignaciones concurrentes, propiedad tras venta, devolución, auditoría, proxy y regresiones de la API móvil. No utiliza cuentas ni contraseñas reales.

## Ampliación del catálogo oficial

Se han preparado seis familias adicionales con 55 referencias, fotografías, ficha, manual y declaración CE. Para desplegar esta ampliación, usar `API_IMAGE=jaguar-api:catalog-check` y `WEB_IMAGE=jaguar-web:catalog-check` (imágenes construidas en el NAS), actualizar sin re-pull y ejecutar `python3 scripts/setup-catalog-nas.py`. Después recargar Catálogo. No hay cambios en Compose, Cloudflare, permisos o APK. Ver [fuentes y proceso de carga](../../docs/referencias/productos/README.md).

Los clientes DEMO también pueden seleccionarse al asignar una unidad gestionable, identificados como DEMO tanto en el selector como en el inventario. Los alquileres a esos clientes no se cuentan en el indicador interno de alquileres reales. El acceso en la app continúa dependiendo de la membresía y la asignación vigente. El nombre o prefijo de serie `DEMO-` por sí solo no cambia el campo de demostración de la unidad; las unidades inicialmente cargadas con `is_demo=true` conservan su condición de consulta.
