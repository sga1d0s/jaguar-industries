import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { File } from 'expo-file-system';
import Pdf from 'react-native-pdf';
import { useAuth, pdfDirectory } from '../../../../lib/session';
import { useLiveQuery } from '../../../../hooks/use-live-query';
import { API_URL } from '../../../../lib/api';
import { type EquipmentDetail } from '../../../../lib/equipment';
import { colors } from '../../../../components/equipment-ui';

export default function DocumentViewer(){
  const {equipmentId,documentId}=useLocalSearchParams<{equipmentId:string;documentId:string}>();
  const {user,token,authenticatedRequest}=useAuth();
  const load=useCallback(()=>authenticatedRequest<EquipmentDetail>(`/equipment/${encodeURIComponent(equipmentId)}`),[equipmentId,authenticatedRequest]);
  // Las invalidaciones SSE también retiran el visor si deja de haber acceso al equipo.
  const metadata=useLiveQuery(load);
  const doc=!metadata.error?metadata.data?.documents.find(doc=>doc.id===documentId):undefined;
  const allowed=!!doc;
  const [localUri,setLocalUri]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [attempt,setAttempt]=useState(0);
  const [page,setPage]=useState(1);
  const [pages,setPages]=useState(0);
  // El visor recibe únicamente el archivo local. Nunca recibe el token ni lo
  // incorpora a una URL, ni vuelve a descargar el documento por su cuenta.
  const source=useMemo(()=>({uri:localUri||'',cache:false}),[localUri]);
  useFocusEffect(useCallback(()=>{
    if(!allowed||!user||!token)return;
    let active=true;
    const directory=pdfDirectory(user.id);
    const file=new File(directory,`${documentId}-${Date.now()}-${attempt}.pdf`);
    const remove=()=>{try{if(file.exists)file.delete();}catch{/* La sesión puede haber limpiado ya su directorio. */}};
    setLocalUri(null);setError(null);setPage(1);setPages(0);
    void (async()=>{
      try{
        directory.create({idempotent:true,intermediates:true});
        await File.downloadFileAsync(`${API_URL}/equipment/${encodeURIComponent(equipmentId)}/documents/${encodeURIComponent(documentId)}`,file,{
          headers:{Authorization:`Bearer ${token}`},idempotent:true,
        });
        // Revalida el acceso tras descargar; salir o cerrar sesión invalida la tarea.
        if(!active){remove();return;}
        const current=await load();
        if(!current.documents.some(doc=>doc.id===documentId))throw new Error('DOCUMENT_UNAVAILABLE');
        if(!active){remove();return;}
        if(!file.exists||!file.size)throw new Error('EMPTY_PDF');
        setLocalUri(file.uri);
      }catch{
        remove();
        if(active){
          try{await authenticatedRequest('/auth/me');}catch{/* AuthProvider gestiona una sesión caducada. */}
          if(active)setError('No se pudo cargar el documento. Comprueba tu conexión y que sigues teniendo acceso al equipo.');
        }
      }
    })();
    // El PDF es temporal: al salir se retira el archivo y una descarga tardía lo borra.
    return ()=>{active=false;setLocalUri(null);remove();};
  },[allowed,user,token,equipmentId,documentId,attempt,load,authenticatedRequest]));
  const failure=metadata.error||error||(!metadata.loading&&!allowed?'Documento no disponible para este equipo.':null);
  const retry=()=>{setAttempt(value=>value+1);void metadata.refresh();};
  return <SafeAreaView style={styles.safe} edges={['bottom','left','right']}>
    <Stack.Screen options={{title:doc?.title||'Documento PDF'}}/>
    {failure?<View style={styles.state}><Text accessibilityRole="alert" style={styles.message}>{failure}</Text><Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryText}>Reintentar</Text></Pressable></View>
      :allowed&&localUri?<>
        <Pdf source={source} style={styles.pdf} fitPolicy={0} minScale={1} maxScale={5} enableDoubleTapZoom trustAllCerts={false}
          onLoadComplete={count=>setPages(count)} onPageChanged={(current,count)=>{setPage(current);setPages(count);}}
          onError={()=>setError('No se pudo mostrar este PDF. Vuelve a descargarlo pulsando Reintentar.')}
          renderActivityIndicator={()=><ActivityIndicator color={colors.orange}/>}/>
        <View style={styles.toolbar}><Text style={styles.page}>{pages?`Página ${page} de ${pages}`:'Preparando páginas…'}</Text><Text style={styles.hint}>Pellizca para ampliar</Text></View>
      </>:<View style={styles.state}><ActivityIndicator color={colors.orange}/><Text style={styles.message}>Cargando documento…</Text></View>}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#e4e8eb'},pdf:{flex:1,width:'100%',backgroundColor:'#e4e8eb'},
  state:{flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:16},message:{fontSize:15,lineHeight:23,color:colors.muted,textAlign:'center'},
  retry:{backgroundColor:colors.orange,paddingHorizontal:24,paddingVertical:14,borderRadius:12},retryText:{color:'white',fontWeight:'700'},
  toolbar:{backgroundColor:'white',paddingVertical:14,paddingHorizontal:20,flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8},
  page:{fontSize:13,fontWeight:'600',color:colors.ink},hint:{fontSize:12,color:colors.muted},
});
