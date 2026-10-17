import { Stack } from 'expo-router';
import { EquipmentEvents } from '../lib/equipment-events';
import { AuthProvider } from '../lib/session';
// La sesión se conserva por encima de todas las pantallas, incluido el formulario de acceso.
export default function RootLayout() {
  return <AuthProvider><EquipmentEvents><Stack screenOptions={{headerShown:false}} /></EquipmentEvents></AuthProvider>;
}
