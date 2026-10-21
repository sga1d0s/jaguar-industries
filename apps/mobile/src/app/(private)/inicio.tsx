import { useCallback, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useAuth } from '../../lib/session';
import { loadSummary, type EquipmentSummary } from '../../lib/dashboard';
import { useLiveQuery } from '../../hooks/use-live-query';
import { colors } from '../../components/equipment-ui';

type Feature={title:string;subtitle:string;icon:ComponentProps<typeof Feather>['name'];action:'equipment'|'scan'|'documents'|'help'|'soon';badge?:string;description?:string};
const features:Feature[]=[
  {title:'Escanear NFC',subtitle:'Identifica tu equipo',icon:'radio',action:'scan',badge:'Prueba NFC'},
  {title:'Mis equipos',subtitle:'Consulta tus unidades',icon:'box',action:'equipment'},
  {title:'Documentación',subtitle:'Manuales y fichas',icon:'file-text',action:'documents'},
  {title:'Avisos',subtitle:'Novedades de tus equipos',icon:'bell',action:'soon',description:'Aquí podrás consultar avisos relacionados con tus equipos.'},
  {title:'Alquileres',subtitle:'Control de entregas',icon:'repeat',action:'soon',description:'Aquí se reunirá la información de tus alquileres. Ahora puedes identificar los equipos alquilados desde Mis equipos.'},
  {title:'Inspecciones',subtitle:'Revisiones e historial',icon:'clipboard',action:'soon',description:'Aquí podrás consultar las revisiones y el historial cuando incorporemos este módulo.'},
  {title:'Certificados',subtitle:'Documentos de la unidad',icon:'award',action:'soon',description:'Este espacio reunirá los certificados individuales de cada unidad. Las declaraciones CE de modelo ya están en su ficha.'},
  {title:'Sin conexión',subtitle:'Consulta donde estés',icon:'download-cloud',action:'soon',description:'Podrás preparar equipos y documentos para consultarlos sin cobertura. Por ahora la consulta requiere conexión.'},
  {title:'Ayuda',subtitle:'Cómo utilizar Jaguar',icon:'help-circle',action:'help'},
];

export default function HomeScreen(){
  const {user,logout,authenticatedRequest}=useAuth();
  const load=useCallback(()=>loadSummary(authenticatedRequest),[authenticatedRequest]);
  const {data:summary,loading,error,refresh:reload}=useLiveQuery<EquipmentSummary>(load);
  const failed=!!error;
  const refresh=()=>{void reload();};
  const [signingOut,setSigningOut]=useState(false);
  async function signOut(){
    setSigningOut(true);
    try{await logout();}catch{Alert.alert('No se pudo cerrar la sesión','Comprueba tu conexión y vuelve a intentarlo.');setSigningOut(false);}
  }
  function openFeature(feature:Feature){
    if(feature.action==='equipment')return router.push('/equipos');
    if(feature.action==='scan')return router.push('/escanear');
    if(feature.action==='documents')return router.push({pathname:'/equipos',params:{mode:'documents'}});
    // Los módulos futuros se explican sin simular altas, alertas o inspecciones inexistentes.
    if(feature.action==='soon')return Alert.alert(`${feature.title} · próximamente`,feature.description);
    Alert.alert('Tu espacio Jaguar','En Mis equipos encontrarás tus unidades asignadas. Abre una ficha para consultar sus características, manual y declaración CE. En Escanear NFC puedes probar la lectura de etiquetas. La vinculación con equipos y el modo sin conexión siguen pendientes.');
  }
  const initials=(user?.name||'J').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  return <SafeAreaView style={styles.safe} edges={['top','left','right']}><StatusBar style="light"/>
    <ScrollView refreshControl={<RefreshControl refreshing={loading&&summary!==null} onRefresh={refresh} tintColor="white"/>} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroCircle}/>
        <View style={styles.topline}><Text style={styles.brand}>JAGUAR<Text style={styles.brandDot}>.</Text></Text><Text style={styles.brandCaption}>INDUSTRIAS</Text></View>
        <View style={styles.profileRow}><View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
          <View style={styles.profile}><Text style={styles.welcome}>BIENVENIDO A TU ESPACIO</Text><Text style={styles.userName}>{user?.name}</Text><Text numberOfLines={1} style={styles.email}>{user?.email}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" disabled={signingOut} onPress={signOut} style={styles.signOut}>{signingOut?<ActivityIndicator color="white"/>:<Feather name="log-out" size={21} color="#e3e9ee"/>}</Pressable>
        </View>
        <View style={styles.metrics}>
          {([{key:'total',label:'Equipos'},{key:'sales',label:'En propiedad'},{key:'rentals',label:'En alquiler'}] as const).map((metric,index)=><View key={metric.key} style={[styles.metric,index>0&&styles.metricDivider]}>
            <Text style={styles.metricValue}>{failed?'—':summary?summary[metric.key]:'…'}</Text><Text style={styles.metricLabel}>{metric.label}</Text>
          </View>)}
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.connection}>
          <View style={[styles.connectionIcon,failed&&styles.connectionIconError]}><Feather name={failed?'wifi-off':'cloud'} color={failed?'#a45221':colors.orange} size={19}/></View>
          <View style={{flex:1}}><Text style={styles.connectionTitle}>{loading?'Actualizando tu espacio…':failed?'No se pudo actualizar':'Tu espacio está actualizado'}</Text><Text style={styles.connectionText}>{failed?'Reintenta para consultar los datos actuales.':'Consulta en línea · Jaguar Industries'}</Text></View>
          {loading?<ActivityIndicator color={colors.orange}/>:<Pressable accessibilityRole="button" accessibilityLabel="Actualizar resumen" hitSlop={12} onPress={refresh}><Feather name="refresh-cw" size={18} color={colors.muted}/></Pressable>}
        </View>
        {summary!==null&&summary.demos>0&&<View style={styles.demo}><View style={styles.demoDot}/><Text style={styles.demoText}>Tu cuenta incluye unidades de demostración</Text></View>}
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>¿Qué necesitas hacer?</Text><Text style={styles.sectionSubtitle}>Todo lo que acompaña a tus equipos.</Text></View>
        <View style={styles.grid}>{features.map(feature=><Pressable accessibilityRole="button" accessibilityLabel={`${feature.title}${feature.action==='soon'?', próximamente':feature.badge?', vista previa':''}`} key={feature.title} onPress={()=>openFeature(feature)} style={({pressed})=>[styles.tile,feature.action==='scan'&&styles.scanTile,pressed&&styles.tilePressed]}>
          <View style={[styles.featureIcon,feature.action==='scan'&&styles.scanIcon,feature.action==='soon'&&styles.futureIcon]}><Feather name={feature.icon} size={26} color={feature.action==='scan'?'white':feature.action==='soon'?'#74828e':colors.ink}/></View>
          <Text style={styles.tileTitle}>{feature.title}</Text><Text style={styles.tileSubtitle}>{feature.subtitle}</Text>
          {(feature.action==='soon'||feature.badge)&&<Text style={[styles.tileBadge,feature.action==='scan'&&styles.scanBadge]}>{feature.action==='soon'?'Próximamente':feature.badge}</Text>}
        </Pressable>)}</View>
        <Pressable accessibilityRole="button" onPress={()=>router.push('/equipos')} style={styles.bottomCard}><View style={styles.bottomIcon}><Feather name="shield" size={23} color={colors.orange}/></View><View style={{flex:1}}><Text style={styles.bottomTitle}>La información, con cada equipo</Text><Text style={styles.bottomText}>Ficha, manual y declaración CE en un mismo lugar.</Text></View><Feather name="arrow-up-right" size={22} color={colors.ink}/></Pressable>
        <Text style={styles.footer}>EQUIPOS QUE ELEVAN. INFORMACIÓN QUE ACOMPAÑA.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.ink},scroll:{flexGrow:1},hero:{backgroundColor:colors.ink,paddingHorizontal:24,paddingTop:22,paddingBottom:47,overflow:'hidden'},heroCircle:{position:'absolute',width:270,height:270,borderRadius:135,borderWidth:42,borderColor:'#1b303c',right:-140,top:-65},topline:{flexDirection:'row',alignItems:'baseline',gap:10,marginBottom:26},brand:{fontSize:25,fontWeight:'900',letterSpacing:3,color:'white'},brandDot:{color:'#ed6943'},brandCaption:{fontSize:9,letterSpacing:2.2,color:'#94aab8'},profileRow:{flexDirection:'row',alignItems:'center',gap:13},avatar:{height:53,width:53,borderRadius:18,backgroundColor:'#f1e7df',alignItems:'center',justifyContent:'center'},initials:{color:colors.ink,fontWeight:'800',fontSize:21},profile:{flex:1},welcome:{fontSize:8,letterSpacing:1.3,color:'#aebec9',marginBottom:6},userName:{fontSize:24,fontWeight:'700',color:'white'},email:{fontSize:12,color:'#aebec9',marginTop:5},signOut:{padding:8},metrics:{flexDirection:'row',marginTop:30},metric:{flex:1,alignItems:'center'},metricDivider:{borderLeftWidth:1,borderColor:'#39505e'},metricValue:{fontSize:29,color:'white',fontWeight:'700'},metricLabel:{fontSize:12,color:'#b9c9d4',marginTop:7},body:{backgroundColor:'#f5f6f7',borderTopLeftRadius:29,borderTopRightRadius:29,paddingHorizontal:18,paddingBottom:32,marginTop:-23},connection:{backgroundColor:'white',borderRadius:15,padding:16,flexDirection:'row',alignItems:'center',gap:12,marginTop:-21,borderWidth:1,borderColor:'#e9edef',boxShadow:'0 5px 16px rgba(19,33,44,0.06)'},connectionIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#fcf0e9',alignItems:'center',justifyContent:'center'},connectionIconError:{backgroundColor:'#fff1d7'},connectionTitle:{fontSize:13,fontWeight:'700',color:colors.ink},connectionText:{fontSize:10,color:colors.muted,marginTop:4},demo:{flexDirection:'row',alignItems:'center',gap:7,paddingTop:14,paddingHorizontal:3},demoDot:{width:5,height:5,borderRadius:3,backgroundColor:'#ae7c2d'},demoText:{fontSize:10,color:'#8b6b37',flex:1},sectionHeading:{paddingTop:27,paddingBottom:19},sectionTitle:{fontSize:22,fontWeight:'800',color:colors.ink},sectionSubtitle:{color:colors.muted,fontSize:12,marginTop:7},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:12},tile:{width:'31.3%',backgroundColor:'white',borderRadius:16,paddingHorizontal:7,paddingVertical:16,minHeight:143,alignItems:'center',borderWidth:1,borderColor:'#e9edef'},scanTile:{borderColor:'#efc9ba',backgroundColor:'#fff8f4'},tilePressed:{opacity:0.72,transform:[{scale:0.98}]},featureIcon:{width:49,height:49,alignItems:'center',justifyContent:'center',borderRadius:15,backgroundColor:'#edf2f5',marginBottom:12},scanIcon:{backgroundColor:colors.orange},futureIcon:{backgroundColor:'#f0f2f4'},tileTitle:{fontSize:13,fontWeight:'700',color:colors.ink,textAlign:'center'},tileSubtitle:{fontSize:10,color:colors.muted,textAlign:'center',lineHeight:14,marginTop:5},tileBadge:{fontSize:9,color:'#74828e',marginTop:7},scanBadge:{color:colors.orange,fontWeight:'700'},bottomCard:{marginTop:23,padding:16,borderRadius:16,backgroundColor:'#eaf0f3',flexDirection:'row',alignItems:'center',gap:12},bottomIcon:{padding:3},bottomTitle:{fontSize:12,fontWeight:'700',color:colors.ink},bottomText:{fontSize:11,lineHeight:17,color:colors.muted,marginTop:5},footer:{fontSize:8,letterSpacing:1.05,textAlign:'center',color:'#8a969e',marginTop:24},
});
