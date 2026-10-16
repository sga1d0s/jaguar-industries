import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { File } from 'expo-file-system';
import { useAuth, pdfDirectory } from '../../../lib/session';
import { API_URL, errorMessage } from '../../../lib/api';
import { type EquipmentDetail, type ProductDocument } from '../../../lib/equipment';
import { colors, DemoNotice, ProductPhoto } from '../../../components/equipment-ui';

export default function EquipmentScreen() {
  const {id:rawId}=useLocalSearchParams<{id:string|string[]}>();
  const id=Array.isArray(rawId)?rawId[0]:rawId;
  const {authenticatedRequest,token,user}=useAuth();
  const [result,setResult]=useState<{id:string;data:EquipmentDetail}|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [opening,setOpening]=useState<string|null>(null);
  const active=useRef(true);
  useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
  // La ficha se solicita por ID, pero el servidor vuelve a comprobar la asignación vigente.
  useEffect(()=>{
    let mounted=true;
    authenticatedRequest<EquipmentDetail>(`/equipment/${encodeURIComponent(id)}`).then(data=>{
      if(mounted)setResult({id,data});
    }).catch(error=>{if(mounted)setError(errorMessage(error));})
      .finally(()=>{if(mounted)setLoading(false);});
    return ()=>{mounted=false;};
  },[id,authenticatedRequest]);
  async function retry() {
    setLoading(true);setError('');
    try{const data=await authenticatedRequest<EquipmentDetail>(`/equipment/${encodeURIComponent(id)}`);setResult({id,data});}
    catch(error){setError(errorMessage(error));}finally{setLoading(false);}
  }
  async function openDocument(doc:ProductDocument) {
    if(!user||!token||opening)return;
    setOpening(doc.id);
    const directory=pdfDirectory(user.id);
    // El nombre local no contiene el token. Siempre descargamos con autorización actual;
    // la caché temporal no ofrece todavía consulta offline ni permisos persistentes.
    const file=new File(directory,`${doc.id}.pdf`);
    try {
      directory.create({idempotent:true,intermediates:true});
      await File.downloadFileAsync(`${API_URL}/equipment/${id}/documents/${doc.id}`,file,{
        headers:{Authorization:`Bearer ${token}`},idempotent:true,
      });
      // Si el usuario cerró sesión durante la descarga no se abre el archivo recibido.
      // /auth/me también detecta una revocación ocurrida mientras se descargaba el PDF.
      if(!active.current){if(file.exists)file.delete();return;}
      await authenticatedRequest('/auth/me');
      if(!await file.canPreview())throw new Error('NO_PDF_VIEWER');
      await file.preview();
    } catch(error) {
      if(file.exists)file.delete();
      // Comprueba si el fallo fue una sesión caducada sin convertir una caída de red en logout.
      try{await authenticatedRequest('/auth/me');}catch{ /* AuthProvider gestiona un 401. */ }
      Alert.alert('No se pudo abrir el documento',error instanceof Error&&error.message==='NO_PDF_VIEWER'
        ?'Instala una aplicación que permita abrir archivos PDF y vuelve a intentarlo.'
        :'Comprueba tu conexión y que sigues teniendo acceso al equipo.');
    } finally{setOpening(null);}
  }
  const data=result?.id===id?result.data:null;
  if(!data)return <SafeAreaView style={styles.safe} edges={['bottom','left','right']}><StatusBar style="dark" />
    <View style={styles.state}>{loading?<ActivityIndicator color={colors.orange}/>:<><Text accessibilityRole="alert" style={styles.copy}>{error||'Equipo no disponible.'}</Text><Pressable style={styles.retry} onPress={retry}><Text style={styles.link}>Reintentar</Text></Pressable></>}</View>
  </SafeAreaView>;
  const unit=data.equipment;
  return <SafeAreaView style={styles.safe} edges={['bottom','left','right']}><StatusBar style="dark" />
    <ScrollView contentContainerStyle={styles.content}>
      <ProductPhoto code={unit.modelCode} large />
      <View style={styles.heading}><Text style={styles.category}>{unit.category}</Text><Text style={styles.title}>{unit.modelName}</Text><Text style={styles.variant}>{unit.variantName}</Text><Text style={styles.sale}>{unit.assignmentKind==='sale'?'Venta':'Alquiler'} · {unit.customerName}</Text></View>
      {unit.isDemo&&<DemoNotice/>}
      <View style={styles.card}><Text style={styles.section}>Identificación</Text><Text style={styles.label}>Referencia de catálogo</Text><Text selectable style={styles.value}>{unit.reference}</Text><Text style={styles.label}>Número de serie {unit.isDemo?'ficticio':''}</Text><Text selectable style={styles.value}>{unit.serialNumber}</Text><Text style={styles.label}>Etiqueta NFC</Text><Text style={styles.value}>{unit.nfcLinked?'Vinculada':'Pendiente de vincular'}</Text></View>
      <View style={styles.card}><Text style={styles.section}>Características</Text><Text style={styles.copy}>{unit.description}</Text>{unit.specifications.map((spec,index)=><View key={index} style={styles.spec}><Text style={styles.specLabel}>{spec.label}</Text><Text style={styles.specValue}>{spec.value}</Text></View>)}<Text style={styles.note}>Datos del catálogo. Consulta el manual completo antes de utilizar un equipo real.</Text></View>
      <View style={styles.card}><Text style={styles.section}>Documentación</Text><Text style={styles.copy}>Documentos comunes del modelo. Requieren conexión.</Text>
        {data.documents.length===0&&<Text style={styles.note}>Todavía no hay documentos disponibles para este modelo.</Text>}
        {data.documents.map(doc=><Pressable key={doc.id} accessibilityRole="button" accessibilityLabel={`Abrir ${doc.title}`} style={styles.document} disabled={opening!==null} onPress={()=>openDocument(doc)}>
          <View style={styles.pdf}><Text style={styles.pdfText}>PDF</Text></View><View style={{flex:1}}><Text style={styles.docTitle}>{doc.title}</Text><Text style={styles.docMeta}>Español · {(doc.byteSize/1024/1024).toFixed(1)} MB</Text><Text style={styles.docMeta}>Copia consultada: {new Date(doc.downloadedOn).toLocaleDateString('es-ES')}</Text><Text style={styles.docMeta}>{doc.revision?`Revisión ${doc.revision}`:'Revisión no identificada'}</Text></View>{opening===doc.id?<ActivityIndicator color={colors.orange}/>:<Text style={styles.link}>Abrir</Text>}
        </Pressable>)}
        <Text style={styles.note}>El certificado individual de la unidad todavía no está incorporado.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},content:{padding:20,paddingBottom:40},state:{flex:1,alignItems:'center',justifyContent:'center',padding:30},heading:{marginTop:22,marginBottom:6},category:{color:colors.muted,fontSize:12,textTransform:'uppercase',letterSpacing:0.8},title:{fontSize:30,fontWeight:'800',color:colors.ink,marginTop:8},variant:{fontSize:18,color:colors.muted,marginTop:8},sale:{color:colors.orange,fontSize:14,fontWeight:'600',marginTop:12},card:{padding:20,backgroundColor:'white',borderRadius:15,marginTop:18,borderColor:colors.border,borderWidth:1},section:{fontSize:20,fontWeight:'700',color:colors.ink,marginBottom:16},label:{fontSize:12,color:colors.muted,marginTop:14,marginBottom:6},value:{fontSize:15,lineHeight:23,color:colors.ink},copy:{fontSize:15,lineHeight:24,color:colors.muted},spec:{borderBottomWidth:1,borderColor:colors.border,paddingVertical:15,flexDirection:'row',gap:16},specLabel:{flex:1,color:colors.muted,fontSize:14,lineHeight:21},specValue:{flex:1,textAlign:'right',fontSize:15,fontWeight:'600',color:colors.ink},note:{color:colors.muted,fontSize:12,lineHeight:20,marginTop:16},document:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:18,borderBottomWidth:1,borderColor:colors.border},pdf:{borderRadius:8,padding:8,backgroundColor:'#fcebe5'},pdfText:{color:colors.orange,fontWeight:'800',fontSize:11},docTitle:{fontSize:15,fontWeight:'600',color:colors.ink},docMeta:{fontSize:11,color:colors.muted,marginTop:5},link:{color:colors.orange,fontWeight:'700'},retry:{padding:16,marginTop:14},
});
