# App móvil Jaguar

Una app Expo / React Native para Android e iOS. Login real contra `https://paneljaguar.sgaldos.com/api`, sesión en Expo SecureStore, restauración validada con `/auth/me` y cierre de sesión en servidor. Incluye Mis equipos, ficha de unidad y apertura online de PDF autorizados. Incluye una primera prueba de lectura NFC ISO 15693 en Android e iPhone; vinculación NFC desde el panel y consulta autorizada por UID; consulta offline sigue pendiente.

## Desarrollo local (flujo habitual)

Usar Node >=22.13 (`nvm use` desde la raíz), JDK 17 y Android SDK. En este Mac ya están instalados Java 17 y el SDK en `~/Library/Android/sdk`. La primera compilación descarga Gradle y los componentes que falten; las siguientes reutilizan su caché.

Desde la raíz del repositorio:

```bash
pnpm install
pnpm android:apk
```

El APK de pruebas independiente de Metro queda en:

`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

Se compila para Android ARM64. Para otro dispositivo, definir `JAGUAR_ANDROID_ARCHS` (por ejemplo `arm64-v8a,armeabi-v7a`). Se usa la firma de depuración generada por Expo: sirve para pruebas locales, no para publicar en tiendas. Si ya se instaló una versión firmada por EAS, las firmas pueden ser distintas; no se puede actualizar una con la otra. Desinstalar borra la sesión y otros datos locales.

Para instalar mediante USB, activar la depuración USB y autorizar el Mac en el teléfono:

```bash
adb devices
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

También se puede copiar el APK al móvil y abrirlo allí.

Para iterar con recarga inmediata, conectar el móvil y ejecutar `pnpm android`: genera/instala una compilación debug e inicia Metro. Los cambios JavaScript no suelen requerir otro APK. Al cambiar dependencias nativas o `app.json`, regenerar con `pnpm --filter @jaguar/mobile exec expo prebuild --platform android --no-install` y recompilar. No editar manualmente `android/` ni versionarlo; el script conserva el directorio generado entre compilaciones para permitir compilación incremental.

Opcionalmente definir `EXPO_PUBLIC_API_URL` en un `.env` local. Es una URL pública, nunca incluir credenciales. La API debe tener desplegada la versión con autenticación y una cuenta creada previamente.

## Compilación cloud (alternativa)

El proyecto EAS está vinculado a `@sgaldos/jaguar-industries`. Solo si se elige compilar en la nube, desde `apps/mobile`:

```bash
pnpm dlx eas-cli build --platform android --profile preview
```

El perfil preview genera un APK instalable por enlace sin Metro. No es el flujo habitual acordado. No hay credenciales de usuario incorporadas en la app.

## iOS

El proyecto nativo se genera con Expo y no se versiona. Para preparar una instalación local desde el Mac:

```bash
nvm use
pnpm --filter @jaguar/mobile exec expo prebuild --platform ios --no-install
cd apps/mobile/ios
pod install
```

Abrir `JaguarIndustries.xcworkspace` en Xcode, seleccionar el target JaguarIndustries y elegir el equipo de la cuenta Apple en Signing & Capabilities. El iPhone debe estar emparejado por USB y tener activado el modo desarrollador. La primera compilación Release local ya se ha firmado e instalado en un iPhone 13 mini. Incluye el bundle JavaScript y no necesita Metro para arrancar.

En la primera instalación con Personal Team, iOS puede exigir confiar en la cuenta desde Ajustes → General → VPN y gestión de dispositivos → App del desarrollador. Este paso lo completa el propietario en el teléfono. La instalación inicial y el arranque están verificados: el propietario confirmó que aparece el login después de autorizar la firma.

La distribución mediante TestFlight/App Store requiere la cuenta Apple Developer del propietario, los certificados y la configuración de App Store Connect. No se ha publicado en ninguna tienda.

## Verificación en teléfono

1. Con red móvil (sin Wi-Fi del NAS), entrar con una contraseña incorrecta y comprobar el mensaje.
2. Entrar con la cuenta de pruebas y comprobar nombre y email.
3. Cerrar completamente la app, abrirla y comprobar que recupera la sesión.
4. Cerrar sesión y comprobar que vuelve al login.
5. Probar sin conexión: debe informar del fallo, sin simular una sesión validada.

## Primer recorrido de equipos

Tras entrar se abre Mis equipos. La lista incluye foto del modelo, referencia, número de serie y venta/alquiler. Las unidades ficticias se identifican con DEMO. La ficha muestra características de la referencia, estado de vinculación NFC y ficha técnica, manual y declaración CE del modelo. No se presenta una inspección o certificado individual como existente.

Los PDF se descargan con la cabecera de sesión a una caché temporal separada por cuenta y se abren con el visor nativo. Hace falta un visor PDF instalado en Android. La caché se limpia al cerrar o invalidar la sesión; no hay todavía biblioteca offline. No se ponen tokens en URL ni se abren enlaces públicos que eviten los permisos. Una sesión caducada vuelve al login; un fallo de red permite reintentar.

La API necesita la migración y la nueva imagen descritas en `apps/api/README.md`. Para preparar el APK tras añadir una dependencia nativa, ejecutar Expo prebuild y luego `pnpm android:apk`. El APK local sigue usando firma de depuración, que puede no coincidir con el APK EAS instalado previamente: no desinstalar la aplicación existente sin decidir antes si se quieren conservar sus datos.

## Home y vista previa NFC

Tras iniciar o restaurar sesión se abre `/inicio`: perfil, resumen de unidades en propiedad/alquiler y nueve accesos. Mis equipos y Documentación usan las rutas existentes; los módulos sin implementar se marcan Próximamente. No se muestran recuentos inventados de avisos ni de estado operativo.

El resumen usa `/equipment/summary`. Por compatibilidad con la API anterior, si esa ruta devuelve 404 se calcula desde la lista únicamente cuando cabe completa en una página; no se presentan recuentos parciales como totales. El error de actualización se muestra sin afirmar que exista modo offline.

`/escanear` permite iniciar una sesión nativa ISO 15693 en Android (NfcV) e iPhone (Iso15693IOS) mediante react-native-nfc-manager 4. Muestra el UID hexadecimal real de 8 bytes; no escribe etiquetas. Tras leer, consulta /equipment/by-nfc/:uid y abre la ficha autorizada. La asociación se realiza desde el panel. Incluye cancelación, errores y cierre al salir o pasar a segundo plano. ICODE SLIX2 se usa para pruebas y SupraNail 13248 para producción; ambas requieren validación física. La búsqueda y ficha DEMO siguen disponibles.

La configuración Expo añade NFCReaderUsageDescription en español y el entitlement TAG. Requiere recompilar iOS y un perfil de firma que admita NFC Tag Reading. La instalación puede realizarse por Wi-Fi con el iPhone emparejado en Xcode. Una actualización de JavaScript por sí sola no incorpora el módulo nativo. Android comprueba si NFC está activado y utiliza modo lector NfcV sin exigir NDEF, para leer etiquetas vacías. El UID leído se envía al backend, que normaliza los órdenes de bytes para guardar una clave convencional E0. Vector verificado en Android: 24369B21090104E0 → E0040109219B3624. La lectura física iOS sigue pendiente por la firma.

## Fotografías del catálogo

La app incluye las fotos oficiales de las ocho familias actuales (630, BT, 650, 500, 900, BC, EM y GC), con fuentes y hashes en `assets/products/fuentes.json`. Lista y ficha comparten el selector `productPhoto` por código de modelo. Los modelos desconocidos muestran su código como marcador. Las imágenes están empaquetadas en la app: incorporar fotos nuevas requiere actualizar el APK/bundle instalado, aunque las asignaciones se consultan en la API y aparecen sin reinstalar.

## Actualización automática de asignaciones

Una sola conexión SSE autenticada por app recibe avisos de asignación/devolución para las empresas de la cuenta. Inicio, lista y ficha consultan la API al entrar, al volver a primer plano y al recibir un aviso; las pantallas ocultas no consultan. No hay consultas periódicas de equipos. Los cambios automáticos son silenciosos; solo el gesto manual activa el indicador de refresco.

Al reconectar, el evento ready provoca una reconciliación con el estado actual, sin depender de reproducir mensajes antiguos. La conexión se cierra en segundo plano o al cambiar/cerrar sesión. Los fallos reintentan con espera creciente hasta unos 30 segundos y un watchdog detecta conexiones sin tráfico. Si llega otro aviso durante una consulta, se repite al terminar para no perder el cambio. La lista conserva el alcance de páginas cargadas y retira asignaciones finalizadas.

La API y Nginx deben incluir la ruta /api/events. Las credenciales solo viajan por Authorization. Los keepalive de SSE mantienen el canal abierto sin consultar equipos ni PostgreSQL; no son peticiones HTTP nuevas. Este canal es para la app activa, no notificaciones push. No incorpora todavía una biblioteca offline persistente; tras recuperar conexión se consulta la información vigente.

Se requiere actualizar API/web mediante el CI/CD e instalar las nuevas compilaciones Android/iOS. No hay migración de base de datos ni contenedor adicional.

### Firma NFC comprobada — 22 de octubre de 2026

Xcode rechaza la firma con el Personal Team actual: no admite NFC Tag Reading ni el entitlement com.apple.developer.nfc.readersession.formats. Para instalar esta versión NFC hace falta un equipo del Apple Developer Program que permita esa capacidad. No se ha actualizado la app instalada. El iPhone 13 mini figura disponible y emparejado; el usuario confirma instalación inalámbrica desde Xcode.

### Prueba Android

Instalar el APK desde Descargas, activar NFC y abrir Escanear NFC → Leer etiqueta NFC. Acercar una sola etiqueta a la antena trasera del teléfono y moverla lentamente hasta detectarla. La pantalla muestra los 16 caracteres leídos y abre la ficha si la etiqueta está vinculada desde el panel y el usuario tiene acceso. Etiqueta sin vinculación o sin asignación disponible muestra un aviso. No escribe el chip. Cancelar permite terminar la espera.
