import { NfcIntentNavigation } from '../../lib/nfc-intents';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../lib/session';
// Ninguna ruta de este grupo se muestra antes de validar la sesión en el servidor.
export default function PrivateLayout() {
  const {ready,user,restoreError}=useAuth();
  if(!ready && restoreError)return <Redirect href="/" />;
  if(!ready)return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator /></View>;
  if(!user)return <Redirect href="/" />;
  return <><NfcIntentNavigation/><Stack screenOptions={{headerTintColor:'#13212c',headerShadowVisible:false}}>
    <Stack.Screen name="inicio" options={{headerShown:false}} />
    <Stack.Screen name="nfc/[uid]" options={{title:'Etiqueta NFC',headerBackTitle:'Inicio'}} />
    <Stack.Screen name="escanear" options={{title:'Escanear NFC',headerBackTitle:'Inicio',headerStyle:{backgroundColor:'#13212c'},headerTintColor:'white'}} />
    <Stack.Screen name="equipos/index" options={{headerShown:false}} />
    <Stack.Screen name="documentos/[equipmentId]/[documentId]" options={{title:'Documento PDF',headerBackTitle:'Ficha del equipo'}} />
    <Stack.Screen name="equipos/[id]" options={{title:'Ficha del equipo',headerBackTitle:'Mis equipos'}} />
  </Stack></>;
}
