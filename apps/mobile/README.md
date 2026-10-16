# App móvil Jaguar

Una app Expo / React Native para Android e iOS. Login real contra `https://paneljaguar.sgaldos.com/api`, sesión en Expo SecureStore, restauración validada con `/auth/me` y cierre de sesión en servidor. No incluye todavía equipos ni NFC.

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

Código compartido y perfil production preparados. No se ha generado ni firmado una app iOS. La distribución mediante TestFlight/App Store requiere la cuenta Apple Developer del propietario, los certificados y la configuración de App Store Connect. No se ha publicado en ninguna tienda.

## Verificación en teléfono

1. Con red móvil (sin Wi-Fi del NAS), entrar con una contraseña incorrecta y comprobar el mensaje.
2. Entrar con la cuenta de pruebas y comprobar nombre y email.
3. Cerrar completamente la app, abrirla y comprobar que recupera la sesión.
4. Cerrar sesión y comprobar que vuelve al login.
5. Probar sin conexión: debe informar del fallo, sin simular una sesión validada.
