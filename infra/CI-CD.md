# CI/CD de Jaguar con Portainer Community Edition

## Flujo

1. Un push a `dev` o `main`, una PR con cambios relevantes, o Run workflow inicia `Jaguar Docker`. En `dev` y PR solo se construye y comprueba; no hay login en GHCR, publicación de imágenes ni despliegue.
2. Se validan el publicador, Compose, API, permisos, catálogo y frontal con PostgreSQL temporal.
3. Solo en `main` se publican las imágenes API y web en GHCR con el SHA del código. Solo si ambas publicaciones terminan bien continúa el despliegue.
4. El job `deploy` genera `infra/compose.portainer.yaml` en la rama **`deploy/production`**, con referencias literales `ghcr.io/...:sha-COMMIT@sha256:DIGEST`. El resto del Compose conserva las variables privadas, puertos, redes y volumen. `release.json` identifica la versión y las imágenes publicadas.
5. Cuando se activa `PORTAINER_DEPLOY_ENABLED=true`, Actions invoca el webhook privado y comprueba `/api/version`, `/version.json` y `/api/ready`. Solo confirma despliegue si ambas versiones coinciden con el commit y la base responde.

El código fuente y la plantilla se desarrollan en `dev` y se incorporan a `main` mediante una PR para publicar producción; no editar a mano la rama generada. Las ejecuciones se serializan y una ejecución cuyo commit ya no es el último de main no puede publicar. Se comprueban todos los pushes a main para que un cambio solo de documentación no deje sin reemplazo una ejecución descartada. No hay force-push ni cambios automáticos en main. Las PR no publican despliegues. Las migraciones y las cargas de datos siguen siendo tareas explícitas.

## Primera activación (una vez)

1. En GitHub → Settings → Secrets and variables → Actions → Secrets crear `PORTAINER_STACK_WEBHOOK` con la URL HTTPS completa del webhook del stack Jaguar. Guardarla solo como secreto. No incluirla en archivos ni mensajes. El usuario confirmó este paso el 17 de octubre de 2026.
2. Subir estos cambios a main y esperar a que `Jaguar Docker` termine. Inicialmente no definir `PORTAINER_DEPLOY_ENABLED`: el workflow crea la rama sin notificar ni verificar Portainer y lo indica en el resumen. Así se puede configurar la referencia después de que exista.
3. Comprobar que aparecen la rama `deploy/production` y su `release.json`.
4. Asegurar que Portainer puede descargar ambas imágenes de GHCR. Si los paquetes son privados, registrar `ghcr.io` en Portainer con el usuario GitHub y un token con lectura de paquetes, autorizando el registro al entorno si corresponde. No hacer públicos los paquetes ni compartir ese token. La autenticación Git del stack es independiente de la autenticación del registro.
5. En el stack existente `jaguar-industries`, cambiar **Repository reference** a `refs/heads/deploy/production`. Mantener **Compose path** `infra/compose.portainer.yaml`, el mismo repositorio y el mecanismo Webhook. Conservar todas las variables, redes y volumen. Guardar y hacer el primer Pull and redeploy. No crear otro stack ni eliminar el existente. Las imágenes fijadas por digest son nuevas referencias; no requieren forzar la descarga de una etiqueta existente.
6. Confirmar que API y web están saludables y que `/api/version` y `/version.json` muestran el `sourceCommit` de `release.json`.
7. En GitHub → Actions → Variables crear `PORTAINER_DEPLOY_ENABLED` con valor **`true`**. Es una variable normal, no un secreto. Opcionalmente `DEPLOY_VERIFY_URL` permite cambiar el origen de comprobación; por defecto es `https://paneljaguar.sgaldos.com`.
8. Desactivar el webhook antiguo de GitHub → Settings → Webhooks que avisaba con cada push. La llamada ahora la hace Actions al terminar la publicación.
9. Ejecutar Run workflow sobre main para verificar el recorrido automático completo. También se ejecutará con los siguientes pushes.

Las antiguas variables `API_IMAGE` y `WEB_IMAGE` pueden conservarse, pero la rama generada fija las imágenes directamente y deja de utilizarlas. Las contraseñas y variables de puertos continúan llegando de Portainer. No cambian el túnel, el dominio ni la URL móvil.

## Diagnóstico

- **`image` falla:** no se modifica la rama de producción ni se llama al webhook; revisar el paso concreto de construcción, pruebas o publicación.
- **`Publish production Compose` falla:** comprobar escritura de `GITHUB_TOKEN` y reglas que afecten a `deploy/production`; no desactivar protecciones de main. Una rama existente que no identifique a este generador se rechaza.
- **Aviso de primera activación:** rama preparada, pero falta `PORTAINER_DEPLOY_ENABLED=true`; no se afirma que esté desplegado.
- **Webhook distinto de 204:** revisar el secreto y el proxy HTTPS; el script no sigue redirecciones a login ni imprime la URL privada.
- **Webhook 204 pero verificación falla:** revisar referencia del stack, permisos GHCR, tareas/errores de Portainer, salud de los contenedores y reglas Cloudflare. Un 401/403 o una versión antigua hace fallar la comprobación; no se ignora ni se considera éxito.
- **Cambio solo en PostgreSQL/esquema:** esta automatización no aplica migraciones. Prepararlas con copia previa antes de desplegar código que dependa de ellas.

No se comprueba el despliegue de una ejecución antigua descartada. Una publicación repetida del mismo Compose puede volver a notificar para recuperar un webhook fallido. El último despliegue correcto queda identificado en el historial de `deploy/production` y `release.json`; un rollback requiere elegir explícitamente una versión previa, sin tocar el volumen.

## Pruebas locales

```sh
python3 -m unittest discover -s scripts -p 'test_release.py' -v
```

Las pruebas usan repositorios Git temporales: publicación inicial, repetición, main intacta, descarte de ejecuciones antiguas, referencias por digest, conservación de variables y volumen, y rechazo de falsos éxitos de webhook o versiones. La integración Docker verifica también las dos versiones a través del proxy.

Fuentes oficiales: [GitOps de Portainer](https://docs.portainer.io/faqs/troubleshooting/stacks-deployments-and-updates/how-do-automatic-updates-for-stacks-applications-work), [permisos de Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [eventos producidos por GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow).
