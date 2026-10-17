import { ImageSourcePropType } from 'react-native';
export type Equipment = {
  id:string;serialNumber:string;nfcLinked:boolean;isDemo:boolean;reference:string;variantName:string;
  modelCode:string;modelName:string;category:string;description:string;
  specifications:{label:string;value:string}[];assignmentKind:'sale'|'rental';customerName:string;
};
export type EquipmentPage={items:Equipment[];nextCursor:string|null};
export type ProductDocument={id:string;title:string;kind:string;language:string;revision:string|null;downloadedOn:string;byteSize:number};
export type EquipmentDetail={equipment:Equipment;documents:ProductDocument[]};
// Fotografías públicas del catálogo oficial. Una referencia desconocida tiene un marcador
// neutro; no se utiliza la foto de un producto diferente como sustituto.
export function productPhoto(code:string):ImageSourcePropType|undefined {
  if(code==='630')return require('../../assets/products/serie-630.png');
  if(code==='BT')return require('../../assets/products/modelo-bt.png');
  // Metro necesita rutas literales para incluir cada foto en el APK y el bundle iOS.
  // El código de modelo llega de la API; todas sus referencias comparten esta imagen.
  if(code==='650')return require('../../assets/products/serie-650.png');
  if(code==='500')return require('../../assets/products/serie-500.png');
  if(code==='900')return require('../../assets/products/serie-900.png');
  if(code==='BC')return require('../../assets/products/modelo-bc.png');
  if(code==='EM')return require('../../assets/products/modelo-em.png');
  if(code==='GC')return require('../../assets/products/modelo-gc.png');
}
