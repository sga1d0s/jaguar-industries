# Decisiones iniciales

## Alojamiento

NAS: API, web, PostgreSQL, archivos privados y tareas programadas. Un proxy existente publicará únicamente web/API mediante HTTPS. Los archivos se servirán tras verificar permisos, sin una carpeta pública de documentos. Empezar con un volumen de archivos y una abstracción de almacenamiento; evaluar S3 si aparecen necesidades concretas.

Móviles: aplicaciones instaladas. NFC y SQLite funcionan en el dispositivo. El NAS no compila iOS: usar macOS/Xcode o un servicio de compilación. NFC requiere un development build propio y pruebas físicas.

## Empresas y autorización

Entidades iniciales: organizaciones, usuarios, membresías, centros, equipos, etiquetas, asignaciones de acceso, plantillas versionadas, inspecciones, incidencias, documentos y auditoría.

Separar organización propietaria de equipo y organización prestadora del servicio. Los técnicos internos reciben asignaciones explícitas de acceso a clientes; los clientes acceden solo a los equipos autorizados. Verificar permisos en cada operación y descarga de archivos. Nunca confiar en un organization_id enviado por el móvil. UID y URL NFC son identificadores, no credenciales.

La API usará un rol de base de datos limitado; el usuario propietario del Compose inicial se reservará a administración/migraciones.

## Sin conexión

Descargar un conjunto autorizado por trabajo o centro, con fecha de actualización y documentos seleccionados. SQLite particionada por cuenta, archivos locales privados y tokens en almacenamiento seguro. Definir caducidad del acceso offline; una revocación remota no puede aplicarse inmediatamente a un dispositivo desconectado.

Cada operación tiene UUID, autor y versión base. Cola persistente con reintentos e idempotencia en servidor. Sincronización incremental con cursor y registros de borrado. Fotografías se suben de forma independiente y la app muestra las pendientes.

Inspecciones finalizadas conservan plantilla y evidencias; correcciones mediante nuevos registros. Cambios incompatibles del estado del equipo requieren resolución explícita. Mostrar estado operativo, resultado de inspección y estado de sincronización por separado. Un dato local antiguo nunca se presentará como comprobación actual del servidor.

## NFC

SupraNail 13248: ISO 15693, 13,56 MHz, UID de 8 bytes y EEPROM anunciada de 2 kbits. Identificación por UID normalizado con vectores de prueba entre iOS y Android. Escritura administrativa opcional, con lectura de verificación. Modelo de etiqueta reemplazable, conservando historial de asociaciones.

Probar primero ICODE SLIX2 para comunicación y flujo, después SupraNail instalado para alcance y orientación. No asumir igual memoria, comandos propietarios ni NDEF.

## Operación

Entornos separados de desarrollo y producción. Antes de producción: autenticación y recuperación de cuenta, pruebas de aislamiento entre clientes, migraciones, copias de PostgreSQL y archivos coherentes entre sí, restauración ensayada, copia fuera del NAS, monitorización y HTTPS. RAID y snapshots locales no sustituyen una copia externa.

## Primera entrega funcional

Alta de equipo → vinculación NFC → asignación a cliente → descarga autorizada → consulta e inspección offline → sincronización idempotente → consulta desde panel del cliente. Validar este recorrido antes de ampliar módulos.

## Panel interno Jaguar (primera entrega)

El dominio del panel sirve un frontal estático y un proxy `/api/` al servidor Node. El permiso de gestión interna se guarda en `panel_operators`, separado de las membresías que autorizan al cliente en la app. Se valida en cada ruta del panel, también en los PDF. Solo una tarea del propietario de PostgreSQL concede/revoca ese permiso; la API no puede escribir esa tabla.

Las organizaciones distinguen cliente/Jaguar. Una unidad se registra como propiedad de Jaguar; una venta transfiere la propiedad y un alquiler solo asigna el uso. Asignar o devolver bloquea la unidad y registra auditoría junto con los cambios. Las unidades DEMO no se modifican desde el panel ni cuentan como actividad real. La descarga común sigue vinculada al modelo. La primera entrega no permite editar/borrar ni cargar documentación nueva o gestionar credenciales.
