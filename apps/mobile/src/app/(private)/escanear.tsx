import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import NfcManager, { NfcTech, NfcError, NfcAdapter } from 'react-native-nfc-manager';
import { ActivityIndicator, Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '../../lib/session';
import { type EquipmentPage } from '../../lib/equipment';
import { errorMessage } from '../../lib/api';
import { colors } from '../../components/equipment-ui';

export default function ScanNfc(){
  const {authenticatedRequest}=useAuth();
  const [loading,setLoading]=useState(false);
  const active=useRef(true);
  const [reading,setReading]=useState(false);
  const [uid,setUid]=useState<string|null>(null);
  const [readerError,setReaderError]=useState<string|null>(null);
  const busy=useRef(false);
  // La sesión pertenece a esta pantalla y se cancela al salir o bloquear el móvil.
  useFocusEffect(useCallback(()=>{
    active.current=true;
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='background')void NfcManager.cancelTechnologyRequest().catch(()=>{});
    });
    return ()=>{
      active.current=false;
      subscription.remove();
      void NfcManager.cancelTechnologyRequest().catch(()=>{});
    };
  },[]));
  async function scan(){
    if(busy.current)return;
    busy.current=true;setReading(true);setUid(null);setReaderError(null);
    try{
      if(Platform.OS!=='ios'&&Platform.OS!=='android')throw new Error('La lectura NFC requiere la app instalada en un móvil.');
      if(!await NfcManager.isSupported())throw new Error('La lectura NFC no está disponible en este dispositivo.');
      await NfcManager.start();
      if(Platform.OS==='android'&&!await NfcManager.isEnabled())throw new Error('Activa NFC en los ajustes del teléfono y vuelve a intentarlo.');
      if(!active.current)return;
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
      if(active.current)setUid(identifier);
      if(Platform.OS==='ios')await NfcManager.setAlertMessageIOS('Etiqueta leída correctamente.');
      // Finaliza el acceso al chip antes de consultar el servidor. El UID identifica
      // la unidad; la API sigue comprobando membresía y asignación en cada lectura.
      await NfcManager.cancelTechnologyRequest();
      if(!active.current)return;
      const unit=await authenticatedRequest<{id:string;uid:string}>(`/equipment/by-nfc/${identifier}`);
      if(active.current)router.push({pathname:'/equipos/[id]',params:{id:unit.id}});
    }catch(error){
      if(active.current&&!(error instanceof NfcError.UserCancel)){
        setReaderError(error instanceof NfcError.Timeout?'Se agotó el tiempo. Acerca el móvil a la etiqueta y reintenta.':error instanceof Error?error.message:errorMessage(error));
      }
    }finally{
      await NfcManager.cancelTechnologyRequest().catch(()=>{});
      busy.current=false;
      setReading(false);
    }
  }
  // Permite revisar el destino del flujo con una unidad DEMO ya autorizada.
  // No se genera un UID ni se simula una lectura del hardware del teléfono.
  async function example(){
    if(loading)return;
    setLoading(true);
    try{
      let cursor:string|null=null;
      do{
        const page:EquipmentPage=await authenticatedRequest<EquipmentPage>(`/equipment${cursor?`?cursor=${cursor}`:''}`);
        if(!active.current)return;
        const demo=page.items.find(item=>item.isDemo);
        if(demo){router.push({pathname:'/equipos/[id]',params:{id:demo.id}});return;}
        cursor=page.nextCursor;
      }while(cursor);
      Alert.alert('No hay una unidad de ejemplo','Puedes consultar los equipos que tienes asignados desde Mis equipos.');
    }catch(error){Alert.alert('No se pudo abrir el ejemplo',errorMessage(error));}
    finally{setLoading(false);}
  }
  return <SafeAreaView style={styles.safe} edges={['bottom','left','right']}><StatusBar style="light"/>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.intro}><View style={styles.previewBadge}><View style={styles.dot}/><Text style={styles.previewText}>PRUEBA NFC</Text></View><Text style={styles.title}>Un toque.\nToda la información.</Text><Text style={styles.subtitle}>Acerca el móvil a la etiqueta para identificar tu equipo y abrir su ficha.</Text></View>
      <View style={styles.reader}>
        <View pointerEvents="none" style={styles.cornerTopLeft}/><View pointerEvents="none" style={styles.cornerTopRight}/><View pointerEvents="none" style={styles.cornerBottomLeft}/><View pointerEvents="none" style={styles.cornerBottomRight}/>
        <View style={styles.ringOuter}><View style={styles.ringInner}><View style={styles.phone}><Feather name="smartphone" size={51} color="white"/><View style={styles.tag}><Feather name="radio" size={24} color={colors.orange}/></View></View></View></View>
        <Text style={styles.readerTitle}>Acerca tu etiqueta</Text><Text style={styles.readerCopy}>Mantén el móvil junto al equipo\nhasta completar la lectura.</Text><View style={styles.readerState}><View style={styles.stateDot}/><Text style={styles.readerStateText}>{reading?'Leyendo etiqueta…':uid?'Lectura completada':'Listo para iniciar la lectura'}</Text></View>
      </View>
      <View style={styles.notice}><Feather name="info" size={18} color="#906a28"/><Text style={styles.noticeText}>Prueba de lectura ISO 15693: ICODE SLIX2 para pruebas y SupraNail para producción. Vincula la etiqueta a una unidad desde el panel. Al leerla, se abrirá su ficha si tu cuenta tiene acceso.</Text></View>
      <Pressable accessibilityRole="button" disabled={reading} onPress={scan} style={[styles.primary,reading&&{opacity:0.7}]}>
        {reading?<ActivityIndicator color="white"/>:<Feather name="radio" size={19} color="white"/>}
        <Text style={styles.primaryText}>{reading?'Esperando etiqueta…':'Leer etiqueta NFC'}</Text>
      </Pressable>
      {reading&&<Pressable accessibilityRole="button" onPress={()=>void NfcManager.cancelTechnologyRequest().catch(()=>{})} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar lectura</Text></Pressable>}
      {uid&&<View style={styles.notice}><View style={{flex:1}}><Text style={styles.stepTitle}>Etiqueta detectada · ISO 15693</Text><Text selectable style={styles.value}>{uid}</Text><Text style={styles.noticeText}>Identificador leído del chip. Si no se abre la ficha, comprueba la vinculación en el panel y que tu cuenta tenga acceso a la unidad.</Text></View></View>}
      {readerError&&<View accessibilityRole="alert" style={styles.notice}><Text selectable style={styles.noticeText}>{readerError}</Text></View>}
      <Text style={styles.sectionTitle}>Cómo escanear</Text>
      {[{title:'Acerca el móvil',copy:'Coloca la zona NFC del teléfono junto a la etiqueta de la unidad.'},{title:'Identificamos el equipo',copy:'Comprobaremos qué unidad es y si tu cuenta tiene acceso.'},{title:'Consulta su ficha',copy:'Abre las características, los manuales y la documentación aplicable.'}].map((step,index)=><View style={styles.step} key={step.title}><View style={styles.stepNumber}><Text style={styles.number}>{index+1}</Text></View><View style={{flex:1}}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepCopy}>{step.copy}</Text></View></View>)}
      <Pressable accessibilityRole="button" disabled={loading} onPress={example} style={({pressed})=>[styles.primary,(pressed||loading)&&{opacity:0.7}]}>{loading?<ActivityIndicator color="white"/>:<Feather name="box" color="white" size={19}/>}<Text style={styles.primaryText}>{loading?'Abriendo ejemplo…':'Ver ficha de ejemplo'}</Text><View style={styles.demoBadge}><Text style={styles.demoText}>DEMO</Text></View></Pressable>
      <Pressable accessibilityRole="button" onPress={()=>router.push('/equipos')} style={styles.secondary}><Feather name="search" size={17} color={colors.ink}/><Text style={styles.secondaryText}>Buscar en Mis equipos</Text></Pressable>
      <Text style={styles.footer}>La ficha de ejemplo pertenece a una unidad de demostración de tu cuenta.</Text>
    </ScrollView>
  </SafeAreaView>;
}
const corner={position:'absolute' as const,width:29,height:29,borderColor:'#dc6d4b'};
const styles=StyleSheet.create({
  value:{fontSize:19,fontWeight:'700',color:colors.ink,marginVertical:12},
  safe:{flex:1,backgroundColor:'#f5f6f7'},content:{padding:22,paddingBottom:34},intro:{marginBottom:23},previewBadge:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',backgroundColor:'#faeade',paddingHorizontal:10,paddingVertical:7,borderRadius:20,marginBottom:17},dot:{width:5,height:5,borderRadius:3,backgroundColor:colors.orange},previewText:{fontSize:9,fontWeight:'700',letterSpacing:1,color:colors.orange},title:{fontSize:33,lineHeight:39,fontWeight:'800',color:colors.ink,letterSpacing:-0.8},subtitle:{fontSize:14,lineHeight:23,color:colors.muted,marginTop:14},reader:{borderRadius:23,backgroundColor:colors.ink,alignItems:'center',padding:28,paddingVertical:30,overflow:'hidden'},cornerTopLeft:{...corner,left:15,top:15,borderLeftWidth:2,borderTopWidth:2,borderTopLeftRadius:10},cornerTopRight:{...corner,right:15,top:15,borderRightWidth:2,borderTopWidth:2,borderTopRightRadius:10},cornerBottomLeft:{...corner,left:15,bottom:15,borderLeftWidth:2,borderBottomWidth:2,borderBottomLeftRadius:10},cornerBottomRight:{...corner,right:15,bottom:15,borderRightWidth:2,borderBottomWidth:2,borderBottomRightRadius:10},ringOuter:{height:158,width:158,borderRadius:79,borderWidth:1,borderColor:'#304551',alignItems:'center',justifyContent:'center',marginBottom:20},ringInner:{height:124,width:124,borderRadius:62,borderWidth:1,borderColor:'#425460',alignItems:'center',justifyContent:'center'},phone:{padding:10,position:'relative'},tag:{position:'absolute',bottom:8,right:-12,padding:8,borderRadius:12,backgroundColor:'#fff1e9',transform:[{rotate:'-12deg'}]},readerTitle:{fontSize:17,fontWeight:'700',color:'white',textAlign:'center'},readerCopy:{fontSize:12,color:'#b8c8d1',lineHeight:20,textAlign:'center',marginTop:9},readerState:{backgroundColor:'#243742',flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:8,borderRadius:20,gap:6,marginTop:20},stateDot:{height:5,width:5,borderRadius:3,backgroundColor:'#d4a46a'},readerStateText:{fontSize:9,color:'#d2c2ad'},notice:{marginTop:16,padding:13,borderRadius:11,backgroundColor:'#fff3dc',flexDirection:'row',alignItems:'center',gap:10},noticeText:{fontSize:11,color:'#795b2c',lineHeight:18,flex:1},sectionTitle:{fontSize:19,fontWeight:'700',color:colors.ink,marginTop:29,marginBottom:20},step:{flexDirection:'row',gap:13,marginBottom:21},stepNumber:{width:29,height:29,borderRadius:10,backgroundColor:'#e6edf1',alignItems:'center',justifyContent:'center'},number:{color:colors.ink,fontSize:12,fontWeight:'700'},stepTitle:{fontSize:14,color:colors.ink,fontWeight:'700'},stepCopy:{fontSize:12,lineHeight:20,color:colors.muted,marginTop:5},primary:{paddingVertical:17,paddingHorizontal:16,borderRadius:13,backgroundColor:colors.orange,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,marginTop:8},primaryText:{fontSize:14,fontWeight:'700',color:'white'},demoBadge:{backgroundColor:'#ffffff26',borderRadius:5,paddingHorizontal:6,paddingVertical:4},demoText:{fontSize:8,color:'white',fontWeight:'800'},secondary:{padding:18,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:9},secondaryText:{fontSize:13,fontWeight:'600',color:colors.ink},footer:{fontSize:10,color:colors.muted,textAlign:'center',lineHeight:17,paddingHorizontal:15},
});
