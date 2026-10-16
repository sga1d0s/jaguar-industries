import { Image, StyleSheet, Text, View } from 'react-native';
import { productPhoto } from '../lib/equipment';
export function ProductPhoto({code,large=false}:{code:string;large?:boolean}) {
  const source=productPhoto(code);
  return <View style={[styles.photo,large&&styles.large]}>{source
    ? <Image source={source} style={styles.image} resizeMode="contain" accessibilityLabel={`Foto del modelo ${code}`} />
    : <Text style={styles.placeholder}>{code}</Text>}</View>;
}
export function DemoNotice() {
  return <View style={styles.notice}><Text style={styles.noticeText}>UNIDAD DE DEMOSTRACIÓN</Text><Text style={styles.copy}>Datos de prueba: no representa un equipo ni una asignación real.</Text></View>;
}
export const colors={ink:'#13212c',muted:'#586b79',orange:'#be4125',background:'#f3f5f6',border:'#dce2e6'};
const styles=StyleSheet.create({
  photo:{width:88,height:100,backgroundColor:'white',borderRadius:12,padding:8},large:{width:'100%',height:230},
  image:{width:'100%',height:'100%'},placeholder:{color:'#586b79',fontSize:26,fontWeight:'700',textAlign:'center',marginTop:24},
  notice:{backgroundColor:'#fff1d7',padding:14,borderRadius:10,marginVertical:12},noticeText:{color:'#71470b',fontWeight:'700',fontSize:11,letterSpacing:0.7},copy:{color:'#71470b',lineHeight:20,marginTop:5},
});
