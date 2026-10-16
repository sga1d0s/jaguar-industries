# App móvil Jaguar

Una app Expo / React Native para Android e iOS. Login real contra `https://paneljaguar.sgaldos.com/api`, sesión en Expo SecureStore, restauración validada con `/auth/me` y cierre de sesión en servidor. No incluye todavía equipos ni NFC.

## Desarrollo

Usar Node >=22.13 (en este Mac existe `~/.nvm/versions/node/v22.13.0`). Desde la raíz: `pnpm install` y `pnpm mobile`. Para probar con Expo Go, instalar una versión compatible con el SDK del proyecto (58); la disponibilidad en las tiendas puede ir por detrás del SDK. El APK preview es la vía prevista para la instalación independiente de Metro.

Opcionalmente definir `EXPO_PUBLIC_API_URL` en un `.env` local. Es una URL pública, nunca incluir credenciales. La API debe tener desplegada la versión con autenticación y una cuenta creada previamente.

## APK de prueba Android

Desde `apps/mobile`:

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli init
pnpm dlx eas-cli build --platform android --profile preview
```

`eas init` vincula la app con la cuenta Expo y añade su projectId. Revisar propietario e identificador antes de confirmar. EAS puede ofrecer crear la clave de firma Android; conservar el acceso a esa clave para futuras actualizaciones. El perfil preview genera un APK instalable mediante su enlace de descarga, sin depender de Metro. Al abrirlo, introducir una cuenta real creada en la API. No hay credenciales incorporadas.

## iOS

Código compartido y perfil production preparados. No se ha generado ni firmado una app iOS. La distribución mediante TestFlight/App Store requiere la cuenta Apple Developer del propietario, los certificados y la configuración de App Store Connect. No se ha publicado en ninguna tienda.

## Verificación en teléfono

1. Con red móvil (sin Wi-Fi del NAS), entrar con una contraseña incorrecta y comprobar el mensaje.
2. Entrar con la cuenta de pruebas y comprobar nombre y email.
3. Cerrar completamente la app, abrirla y comprobar que recupera la sesión.
4. Cerrar sesión y comprobar que vuelve al login.
5. Probar sin conexión: debe informar del fallo, sin simular una sesión validada.
