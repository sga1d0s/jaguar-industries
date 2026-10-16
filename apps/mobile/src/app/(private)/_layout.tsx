import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../lib/session';
// Ninguna ruta de este grupo se muestra antes de validar la sesión en el servidor.
export default function PrivateLayout() {
  const {ready,user,restoreError}=useAuth();
  if(!ready && restoreError)return <Redirect href="/" />;
  if(!ready)return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator /></View>;
  if(!user)return <Redirect href="/" />;
  return <Stack screenOptions={{headerTintColor:'#13212c',headerShadowVisible:false}}>
    <Stack.Screen name="equipos/index" options={{headerShown:false}} />
    <Stack.Screen name="equipos/[id]" options={{title:'Ficha del equipo',headerBackTitle:'Mis equipos'}} />
  </Stack>;
}
