import { startNfc } from '../../lib/nfc-reader';
import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import NfcManager, { NfcTech, NfcError, NfcAdapter } from 'react-native-nfc-manager';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '../../lib/session';
import { errorMessage } from '../../lib/api';
import { colors } from '../../components/equipment-ui';

export default function ScanNfc(){
  const {authenticatedRequest}=useAuth();
  const active=useRef(true);
  const [reading,setReading]=useState(false);
  const [uid,setUid]=useState<string|null>(null);
  const [readerError,setReaderError]=useState<string|null>(null);
  const busy=useRef(false);
  const generation=useRef(0);
  const lastScan=useRef<Promise<void>>(Promise.resolve());
  const scan=useCallback(async()=>{
    const ticket=generation.current;
    const live=()=>active.current&&generation.current===ticket;
    if(busy.current)return;
    busy.current=true;setReading(true);setUid(null);setReaderError(null);
    try{
      if(Platform.OS!=='ios'&&Platform.OS!=='android')throw new Error('La lectura NFC requiere la app instalada en un móvil.');
      if(!await NfcManager.isSupported())throw new Error('La lectura NFC no está disponible en este dispositivo.');
      await startNfc();
      if(Platform.OS==='android'&&!await NfcManager.isEnabled())throw new Error('Activa NFC en los ajustes del teléfono y vuelve a intentarlo.');
      if(!live())return;
      // NfcV permite detectar ISO 15693 aunque la etiqueta esté vacía, sin NDEF.
      await NfcManager.requestTechnology(Platform.OS==='ios'?NfcTech.Iso15693IOS:NfcTech.NfcV,{
        alertMessage:'Acerca la parte superior del iPhone a una sola etiqueta Jaguar.',
        isReaderModeEnabled:true,
        readerModeFlags:NfcAdapter.FLAG_READER_NFC_V|NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
      });
      const tag=await NfcManager.getTag();
      const identifier=tag?.id?.replace(/[:\s-]/g,'').toUpperCase();
      if(!identifier||!/^[0-9A-F]{16}$/.test(identifier)){
        throw new Error('No se ha recibido un UID ISO 15693 válido. Vuelve a acercar la etiqueta.');
      }
      if(live())setUid(identifier);
      if(Platform.OS==='ios')await NfcManager.setAlertMessageIOS('Etiqueta leída correctamente.');
      // Finaliza el acceso al chip antes de consultar el servidor. El UID identifica
      // la unidad; la API sigue comprobando membresía y asignación en cada lectura.
      await NfcManager.cancelTechnologyRequest();
      if(!live())return;
      const unit=await authenticatedRequest<{id:string;uid:string}>(`/equipment/by-nfc/${identifier}`);
      if(live())router.push({pathname:'/equipos/[id]',params:{id:unit.id}});
    }catch(error){
      if(live()&&!(error instanceof NfcError.UserCancel)){
        setReaderError(error instanceof NfcError.Timeout?'Se agotó el tiempo. Acerca el móvil a la etiqueta y reintenta.':error instanceof Error?error.message:errorMessage(error));
      }
    }finally{
      await NfcManager.cancelTechnologyRequest().catch(()=>{});
      busy.current=false;
      setReading(false);
    }
  },[authenticatedRequest]);
  // Serializa reinicios: al volver a la pantalla, espera a que termine la
  // cancelación anterior. Nunca quedan dos solicitudes nativas simultáneas.
  const requestScan=useCallback(()=>{
    const ticket=++generation.current;
    const task=lastScan.current.catch(()=>{}).then(async()=>{
      if(active.current&&generation.current===ticket&&AppState.currentState==='active')await scan();
    });
    lastScan.current=task;
  },[scan]);
  const cancelScan=useCallback(()=>{
    generation.current++;
    void NfcManager.cancelTechnologyRequest().catch(()=>{});
  },[]);
  useFocusEffect(useCallback(()=>{
    active.current=true;
    requestScan();
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='background'){active.current=false;cancelScan();}
      if(state==='active'){active.current=true;requestScan();}
    });
    return ()=>{active.current=false;subscription.remove();cancelScan();};
  },[requestScan,cancelScan]));
  const status=readerError?'No se pudo completar la lectura':uid?'Etiqueta detectada':reading?'Buscando etiqueta…':'Lectura detenida';
  // La ilustración representa proximidad entre móvil y chip, sin visor de cámara.
  return <SafeAreaView style={styles.safe} edges={['bottom','left','right']}><StatusBar style="light"/>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.illustration} accessible={false} importantForAccessibility="no-hide-descendants">
          <View style={styles.phoneBack}>
            <View style={styles.cameras}><View style={styles.camera}/><View style={styles.camera}/></View>
            <Feather name="radio" size={34} color="#c0d0d8"/>
          </View>
          <View style={styles.proximity}><Feather name="wifi" size={25} color={colors.orange}/></View>
          <View style={styles.physicalTag}><Feather name="radio" size={32} color="white"/><Text style={styles.tagLabel}>NFC</Text></View>
        </View>
        <Text style={styles.title}>Acerca el móvil a la etiqueta</Text>
        <Text style={styles.subtitle}>{Platform.OS==='ios'?'Coloca la parte superior del iPhone junto a la etiqueta del equipo.':'Coloca la parte trasera del teléfono junto a la etiqueta del equipo.'}</Text>
        <View accessibilityLiveRegion="polite" style={[styles.status,readerError&&styles.statusError]}>
          {reading&&!readerError?<ActivityIndicator size="small" color={colors.orange}/>:<Feather name={readerError?'alert-circle':uid?'check-circle':'pause-circle'} size={19} color={readerError?'#a33325':colors.orange}/>}
          <Text style={[styles.statusText,readerError&&styles.errorText]}>{reading&&uid&&!readerError?'Abriendo equipo…':status}</Text>
        </View>
        {!readerError&&<Text style={styles.hint}>{reading?'Mantén el móvil cerca unos segundos. Si no la detecta, muévelo lentamente sobre la etiqueta.':'La lectura se inicia automáticamente al entrar. Puedes volver a intentarlo cuando quieras.'}</Text>}
      </View>
      {readerError&&<View accessibilityRole="alert" style={styles.errorCard}><Text style={styles.errorText}>{readerError}</Text></View>}
      {uid&&<View style={styles.detected}><Text style={styles.detectedLabel}>Identificador de la etiqueta</Text><Text selectable style={styles.uid}>{uid}</Text></View>}
      {reading?<Pressable accessibilityRole="button" onPress={cancelScan} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar lectura</Text></Pressable>:<Pressable accessibilityRole="button" onPress={requestScan} style={({pressed})=>[styles.primary,pressed&&{opacity:0.75}]}><Feather name="radio" size={20} color="white"/><Text style={styles.primaryText}>Volver a leer etiqueta</Text></Pressable>}
      <View style={styles.bottom}>
        <Text style={styles.automatic}>La ficha se abrirá cuando identifiquemos el equipo.</Text>
        <Pressable accessibilityRole="button" onPress={()=>router.push('/equipos')} style={({pressed})=>[styles.manual,pressed&&{opacity:0.7}]}>
          <Feather name="search" size={21} color={colors.ink}/><View style={styles.manualCopy}><Text style={styles.manualTitle}>Buscar en Mis equipos</Text><Text style={styles.manualSubtitle}>También puedes encontrarlo por su serie.</Text></View><Feather name="chevron-right" size={19} color={colors.muted}/>
        </Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f5f6f7'},
  content:{flexGrow:1,padding:24,paddingTop:30,paddingBottom:28,width:'100%',maxWidth:480,alignSelf:'center'},
  hero:{alignItems:'center'},
  illustration:{height:192,width:230,alignItems:'center',justifyContent:'center',marginBottom:20},
  phoneBack:{height:158,width:94,borderRadius:22,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',transform:[{rotate:'-9deg'}],marginRight:61},
  cameras:{position:'absolute',top:14,left:12,gap:5},camera:{width:9,height:9,borderRadius:5,backgroundColor:'#435967'},
  proximity:{position:'absolute',left:125,top:70,transform:[{rotate:'-90deg'}]},
  physicalTag:{position:'absolute',right:4,top:90,height:74,width:66,borderRadius:14,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',gap:3,transform:[{rotate:'8deg'}]},
  tagLabel:{color:'white',fontSize:9,fontWeight:'800',letterSpacing:1},
  title:{fontSize:27,lineHeight:34,fontWeight:'800',textAlign:'center',color:colors.ink,letterSpacing:-0.5},
  subtitle:{fontSize:15,lineHeight:23,textAlign:'center',color:colors.muted,marginTop:12},
  status:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,backgroundColor:'#fbe9e1',borderRadius:24,paddingHorizontal:16,paddingVertical:12,marginTop:26,maxWidth:'100%'},
  statusText:{fontSize:14,fontWeight:'600',color:'#a73a20',flexShrink:1},statusError:{backgroundColor:'#fae9e6'},
  hint:{fontSize:13,lineHeight:21,color:colors.muted,textAlign:'center',marginTop:17},
  errorCard:{backgroundColor:'#fae9e6',padding:16,borderRadius:12,marginTop:18},errorText:{color:'#a33325',fontSize:14,lineHeight:22},
  detected:{alignItems:'center',paddingTop:18},detectedLabel:{fontSize:12,color:colors.muted},uid:{fontSize:16,fontWeight:'600',color:colors.ink,marginTop:6},
  primary:{paddingVertical:17,paddingHorizontal:16,borderRadius:13,backgroundColor:colors.orange,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,marginTop:22},
  primaryText:{fontSize:15,fontWeight:'700',color:'white'},
  secondary:{padding:18,alignItems:'center',marginTop:8},secondaryText:{fontSize:14,fontWeight:'600',color:colors.ink},
  bottom:{marginTop:'auto',paddingTop:30},automatic:{fontSize:12,lineHeight:19,color:colors.muted,textAlign:'center',marginBottom:22},
  manual:{flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:1,borderTopColor:'#dfe5e8',paddingTop:22},
  manualCopy:{flex:1},manualTitle:{fontSize:14,fontWeight:'700',color:colors.ink},manualSubtitle:{fontSize:12,lineHeight:19,color:colors.muted,marginTop:4},
});
