import { Stack } from 'expo-router';
// Contenedor de navegación: las pantallas de src/app se registran automáticamente.
// Ocultamos la cabecera porque la pantalla de acceso presenta su propio contenido.
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
