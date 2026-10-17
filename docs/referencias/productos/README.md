# Catálogo y documentación oficial de Jaguar

Fuentes: páginas de producto de [Industrias Jaguar](https://www.industriasjaguar.com/). Los PDF y las imágenes se conservan originales. `fuentes.json` registra la URL, fecha de descarga, tamaño y SHA-256 de cada documento; las fotos y sus fuentes están en `apps/web/public/assets/`.

La ampliación del 17 de octubre de 2026 añade seis familias y 55 referencias verificadas en las tablas del catálogo oficial edición 2025:

| Código | Familia | Referencias añadidas |
| --- | --- | ---: |
| 650 | Poleas manuales con limitador de carga | 10 |
| 500 | Carros portapoleas, por cadena y por empuje | 22 |
| BC | Pinzas de anclaje | 5 |
| 900 | Polipastos de palanca Palfer | 7 |
| EM | Elevadores magnéticos manuales | 6 |
| GC | Gatos de cremallera | 5 |

Las familias iniciales 630 y BT conservan sus referencias y documentos existentes. Tras la carga habrá ocho modelos y 57 referencias, si no se han añadido otros desde el panel. El inventario físico no cambia: modelos y referencias comerciales no representan unidades vendidas o alquiladas.

Cada familia nueva se vincula a ficha, manual y declaración CE. Las series 630 y 650 comparten exactamente el mismo manual: se conserva un único archivo y un único registro documental. En total hay 24 vínculos familia/documento y 23 PDF distintos. La ficha contiene también los dibujos y dimensiones de montaje; no se presentan como planos independientes ni como certificados de cada unidad.

`catalogo-ampliacion.json` contiene datos normalizados, su página de origen y fecha de verificación. Incluye capacidades, pesos y las condiciones de carga diferenciadas de los EM para piezas planas y redondas. Los manuales y fichas originales conservan el resto de condiciones y limitaciones. No se infieren datos que no aparecen en la documentación ni se inventan revisiones.

## Archivos originales

| Familia | Ficha | Manual | Declaración CE |
| --- | --- | --- | --- |
| 630 | [PDF](serie-630/ficha.pdf) | [PDF](serie-630/manual.pdf) | [PDF](serie-630/declaracion-ce.pdf) |
| BT | [PDF](modelo-bt/ficha.pdf) | [PDF](modelo-bt/manual.pdf) | [PDF](modelo-bt/declaracion-ce.pdf) |
| 650 | [PDF](serie-650/ficha.pdf) | [PDF compartido](serie-630/manual.pdf) | [PDF](serie-650/declaracion-ce.pdf) |
| 500 | [PDF](serie-500/ficha.pdf) | [PDF](serie-500/manual.pdf) | [PDF](serie-500/declaracion-ce.pdf) |
| BC | [PDF](modelo-bc/ficha.pdf) | [PDF](modelo-bc/manual.pdf) | [PDF](modelo-bc/declaracion-ce.pdf) |
| 900 | [PDF](serie-900/ficha.pdf) | [PDF](serie-900/manual.pdf) | [PDF](serie-900/declaracion-ce.pdf) |
| EM | [PDF](modelo-em/ficha.pdf) | [PDF](modelo-em/manual.pdf) | [PDF](modelo-em/declaracion-ce.pdf) |
| GC | [PDF](modelo-gc/ficha.pdf) | [PDF](modelo-gc/manual.pdf) | [PDF](modelo-gc/declaracion-ce.pdf) |

Las familias iniciales se descargaron el 16 de octubre de 2026 desde [poleas manuales](https://www.industriasjaguar.com/es/productos/elevacion-traccion/poleas-manuales) y [garras articuladas](https://www.industriasjaguar.com/es/productos/garras-de-elevacion-y-elevadores-magneticos/garras-articuladas). El manual BT cubre también otros modelos; no se han creado esas familias adicionales sin verificar sus propias fichas.

Se mantiene la distinción entre documentación común y propia de una unidad. El certificado individual de prueba con número de serie no se ha descargado ni se sustituye por la declaración CE. Las revisiones y la aplicabilidad histórica deben validarse para las unidades correspondientes: el último PDF público no demuestra por sí solo que cubra cualquier unidad antigua. La descarga offline sigue siendo una función pendiente.

## Incorporar al NAS

1. Construir y desplegar las imágenes actualizadas de API y web (`jaguar-api:catalog-check` y `jaguar-web:catalog-check` para esta prueba local), manteniendo las variables y el volumen.
2. Ejecutar desde la raíz:

   ```sh
   python3 scripts/setup-catalog-nas.py
   ```

3. Recargar el panel y abrir **Catálogo**.

El script comprueba que la API activa contiene el catálogo actualizado, crea una copia privada en `backups/` y ejecuta una transacción con el propietario. Verifica los hashes de todos los PDF antes de importar. Es repetible, no duplica referencias/documentos y conserva los datos previamente editados. Si una referencia ya pertenece a otro modelo o un archivo ha cambiado, cancela la carga sin aplicarla parcialmente. No modifica cuentas, permisos, equipos, NFC ni asignaciones.
