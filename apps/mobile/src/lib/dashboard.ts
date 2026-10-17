import { ApiError } from './api';
import { type EquipmentPage } from './equipment';
export type EquipmentSummary={total:number;sales:number;rentals:number;demos:number};
// Compatibilidad con la API ya instalada: una página completa permite calcular el resumen.
// Si hay más páginas no presentamos sus recuentos parciales como si fueran el total.
export async function loadSummary(request:<T>(path:string)=>Promise<T>):Promise<EquipmentSummary> {
  try{return await request<EquipmentSummary>('/equipment/summary');}
  catch(error){
    if(!(error instanceof ApiError)||error.status!==404)throw error;
    const page=await request<EquipmentPage>('/equipment');
    if(page.nextCursor)throw new Error('Resumen completo no disponible.');
    return {
      total:page.items.length,
      sales:page.items.filter(item=>item.assignmentKind==='sale').length,
      rentals:page.items.filter(item=>item.assignmentKind==='rental').length,
      demos:page.items.filter(item=>item.isDemo).length,
    };
  }
}
