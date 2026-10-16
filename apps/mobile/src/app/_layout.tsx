import { Stack } from 'expo-router';
import { AuthProvider } from '../lib/session';
// La sesión se conserva por encima de todas las pantallas, incluido el formulario de acceso.
export default function RootLayout() {
  return <AuthProvider><Stack screenOptions={{headerShown:false}} /></AuthProvider>;
}
