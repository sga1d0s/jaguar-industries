import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/session';
import { errorMessage } from '../../../lib/api';
import { colors } from '../../../components/equipment-ui';

// El UID ya fue leído por Android: no obliga a acercar el chip una segunda vez.
export default function NfcOpened(){
  const {uid,sequence}=useLocalSearchParams<{uid:string;sequence?:string}>();
  const {authenticatedRequest}=useAuth();
  const [failure,setFailure]=useState<{key:string;message:string}|null>(null);
  const [attempt,setAttempt]=useState(0);
  const requestKey=JSON.stringify([uid,sequence,attempt]);
  const error=failure?.key===requestKey?failure.message:null;
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        if(!/^[0-9A-F]{16}$/i.test(uid))throw new Error('La etiqueta no contiene un identificador válido.');
        const unit=await authenticatedRequest<{id:string}>(`/equipment/by-nfc/${uid}`);
        if(active)router.replace({pathname:'/equipos/[id]',params:{id:unit.id}});
      }catch(error){if(active)setFailure({key:requestKey,message:error instanceof Error?error.message:errorMessage(error)});}
    })();
    return ()=>{active=false;};
  },[uid,requestKey,authenticatedRequest]);
  return <View style={styles.page}>
    <Text style={styles.title}>{error?'Etiqueta detectada':'Abriendo tu equipo…'}</Text>
    <Text selectable style={styles.uid}>{uid}</Text>
    {error?<><Text accessibilityRole="alert" style={styles.copy}>{error}</Text><Pressable style={styles.button} onPress={()=>setAttempt(value=>value+1)}><Text style={styles.buttonText}>Reintentar consulta</Text></Pressable><Pressable style={styles.secondary} onPress={()=>router.replace('/escanear')}><Text>Escanear otra etiqueta</Text></Pressable></>:<ActivityIndicator color={colors.orange}/>}
  </View>;
}
const styles=StyleSheet.create({
  page:{flex:1,padding:24,justifyContent:'center',backgroundColor:'#f5f6f7'},
  title:{fontSize:25,fontWeight:'700',color:colors.ink},uid:{marginVertical:16,fontSize:18,color:colors.ink},
  copy:{color:colors.muted,lineHeight:23,marginBottom:20},button:{backgroundColor:colors.orange,padding:16,borderRadius:12,alignItems:'center'},
  buttonText:{color:'white',fontWeight:'700'},secondary:{padding:18,alignItems:'center'},
});
