import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/session';
import { errorMessage } from '../../../lib/api';
import { type Equipment, type EquipmentPage } from '../../../lib/equipment';
import { colors, ProductPhoto } from '../../../components/equipment-ui';

export default function EquipmentList() {
  const {user,logout,authenticatedRequest}=useAuth();
  const [items,setItems]=useState<Equipment[]>([]);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [signingOut,setSigningOut]=useState(false);
  // Primera carga: la API calcula el cliente a partir de la sesión, no de esta pantalla.
  useEffect(()=>{
    let mounted=true;
    authenticatedRequest<EquipmentPage>('/equipment').then(page=>{
      if(mounted){setItems(page.items);setNextCursor(page.nextCursor);}
    }).catch(error=>{if(mounted)setError(errorMessage(error));})
      .finally(()=>{if(mounted)setLoading(false);});
    return ()=>{mounted=false;};
  },[authenticatedRequest]);
  async function load(more=false) {
    if(loading)return;
    setLoading(true);setError('');
    try {
      const page=await authenticatedRequest<EquipmentPage>(`/equipment${more&&nextCursor?`?cursor=${nextCursor}`:''}`);
      setItems(previous=>more?[...new Map([...previous,...page.items].map(item=>[item.id,item])).values()]:page.items);
      setNextCursor(page.nextCursor);
    } catch(error){setError(errorMessage(error));}
    finally{setLoading(false);}
  }
  async function signOut() {
    setSigningOut(true);
    try{await logout();}catch{Alert.alert('No se pudo cerrar la sesión','Comprueba tu conexión y vuelve a intentarlo.');setSigningOut(false);}
  }
  return <SafeAreaView style={styles.safe} edges={['top','left','right']}><StatusBar style="light" />
    <View style={styles.header}><View style={{flex:1}}><Text style={styles.brand}>JAGUAR</Text><Text style={styles.greeting}>Hola, {user?.name}</Text></View>
      <Pressable accessibilityRole="button" onPress={signOut} disabled={signingOut} style={styles.logout}><Text style={styles.logoutText}>{signingOut?'Saliendo…':'Cerrar sesión'}</Text></Pressable></View>
    <FlatList data={items} keyExtractor={item=>item.id} contentContainerStyle={styles.content}
      refreshing={loading&&items.length>0} onRefresh={()=>load()}
      ListHeaderComponent={<View><Text style={styles.title}>Mis equipos</Text><Text style={styles.subtitle}>Características y documentación de tus equipos.</Text>
        {items.some(item=>item.isDemo)&&<View style={styles.demo}><Text style={styles.demoText}>Estás viendo unidades de demostración. Las asignaciones y números de serie son ficticios.</Text></View>}
        {!!error&&<View style={styles.error}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Pressable onPress={()=>load()} disabled={loading}><Text style={styles.link}>Reintentar</Text></Pressable></View>}
        {items.length>0&&<Text style={styles.count}>{items.length} equipos{nextCursor?' cargados':''}</Text>}</View>}
      renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${item.modelName}, ${item.reference}`} style={styles.card} onPress={()=>router.push({pathname:'/equipos/[id]',params:{id:item.id}})}>
        <ProductPhoto code={item.modelCode} /><View style={styles.cardBody}><View style={styles.badges}><Text style={styles.badge}>{item.assignmentKind==='sale'?'VENTA':'ALQUILER'}</Text>{item.isDemo&&<Text style={styles.demoBadge}>DEMO</Text>}</View>
          <Text style={styles.name}>{item.modelName}</Text><Text style={styles.variant}>{item.variantName}</Text><Text numberOfLines={1} style={styles.serial}>N.º {item.serialNumber}</Text><Text style={styles.link}>Ver ficha →</Text></View>
      </Pressable>}
      ListEmptyComponent={loading?<ActivityIndicator style={{marginTop:40}} color={colors.orange} />:!error?<View style={styles.empty}><Text style={styles.emptyTitle}>Todavía no tienes equipos asignados</Text><Text style={styles.subtitle}>Cuando Jaguar te asigne una unidad, aparecerá aquí con su documentación.</Text></View>:undefined}
      ListFooterComponent={nextCursor?<Pressable style={styles.more} onPress={()=>load(true)} disabled={loading}><Text style={styles.link}>{loading?'Cargando…':'Cargar más equipos'}</Text></Pressable>:<View style={{height:24}} />}
    />
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.ink},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:22,paddingVertical:20,gap:12},brand:{color:'white',fontSize:23,fontWeight:'900',letterSpacing:3},greeting:{color:'#becbd4',marginTop:6,fontSize:14},logout:{paddingVertical:12,paddingLeft:12},logoutText:{color:'white',fontSize:13},
  content:{flexGrow:1,backgroundColor:colors.background,padding:20,paddingBottom:36},title:{fontSize:30,fontWeight:'800',color:colors.ink,marginBottom:8},subtitle:{fontSize:15,lineHeight:23,color:colors.muted},demo:{padding:14,backgroundColor:'#fff1d7',borderRadius:10,marginTop:18},demoText:{fontSize:13,lineHeight:20,color:'#71470b'},count:{color:colors.muted,fontSize:12,marginTop:22,marginBottom:12},
  card:{backgroundColor:'white',borderRadius:16,padding:14,marginBottom:14,flexDirection:'row',gap:16,borderWidth:1,borderColor:colors.border},cardBody:{flex:1},badges:{flexDirection:'row',gap:8,flexWrap:'wrap',marginBottom:8},badge:{color:colors.ink,fontWeight:'700',fontSize:10,backgroundColor:'#eaf0f3',padding:5,borderRadius:4},demoBadge:{fontSize:10,color:'#71470b',padding:5,backgroundColor:'#fff1d7',borderRadius:4},name:{fontSize:18,fontWeight:'700',color:colors.ink},variant:{fontSize:14,color:colors.muted,marginTop:5},serial:{fontSize:11,color:colors.muted,marginTop:8},link:{color:colors.orange,fontWeight:'700',marginTop:12},error:{padding:16,backgroundColor:'#ffebe8',borderRadius:10,marginTop:16},errorText:{color:'#9d2921',lineHeight:22},empty:{marginTop:36,padding:22,borderRadius:14,backgroundColor:'white'},emptyTitle:{fontWeight:'700',fontSize:19,color:colors.ink,marginBottom:10},more:{alignItems:'center',padding:12},
});
