import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { subscribeEquipmentChanges } from '../lib/equipment-events';
import { errorMessage } from '../lib/api';

// Solo consulta mientras esta pantalla está visible y la app está activa. Al
// salir invalida las respuestas pendientes, para no pintar datos de otra visita.
export function useLiveQuery<T>(load:()=>Promise<T>) {
  const [data,setData]=useState<T|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const current=useRef({focused:false,busy:false,generation:0,hasData:false,queued:false});
  const run=useCallback(async function execute(fetchData=load,visible=false){
    const state=current.current;
    if(!state.focused || AppState.currentState!=='active')return;
    if(state.busy){state.queued=true;return;}
    state.busy=true;
    const generation=state.generation;
    if(visible || !state.hasData)setLoading(true);
    try {
      const result=await fetchData();
      if(current.current.generation===generation){state.hasData=true;setData(result);setError('');}
    } catch(error) {
      if(current.current.generation===generation)setError(errorMessage(error));
    } finally {
      if(current.current.generation===generation){state.busy=false;setLoading(false);
        if(state.queued){state.queued=false;void execute();}}
    }
  },[load]);
  useFocusEffect(useCallback(()=>{
    current.current={focused:true,busy:false,generation:current.current.generation+1,hasData:current.current.hasData,queued:false};
    void run();
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active')void run();
    });
    const unsubscribe=subscribeEquipmentChanges(()=>{void run();});
    return ()=>{
      unsubscribe();subscription.remove();
      current.current={focused:false,busy:false,generation:current.current.generation+1,hasData:current.current.hasData,queued:false};
    };
  },[run]));
  // Solo el gesto manual muestra el indicador de refresco. SSE es silencioso.
  const refresh=useCallback((fetchData=load)=>run(fetchData,true),[load,run]);
  return {data,loading,error,refresh};
}
