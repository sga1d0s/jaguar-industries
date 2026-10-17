import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { fetch } from 'expo/fetch';
import { API_URL } from './api';
import { useAuth } from './session';

const listeners=new Set<()=>void>();
export function subscribeEquipmentChanges(listener:()=>void){
  listeners.add(listener);return ()=>{listeners.delete(listener);};
}
const notify=()=>{for(const listener of listeners)listener();};

// Un solo canal por app, compartido por todas las pantallas. La credencial va
// únicamente en Authorization, nunca en la URL ni en mensajes de diagnóstico.
export function EquipmentEvents({children}:{children:ReactNode}) {
  const {token,expire}=useAuth();
  useEffect(()=>{
    if(!token)return;
    let disposed=false,controller:AbortController|undefined;
    let retry:ReturnType<typeof setTimeout>|undefined;
    let watchdog:ReturnType<typeof setTimeout>|undefined;
    let failures=0;
    const stop=()=>{
      clearTimeout(retry);clearTimeout(watchdog);controller?.abort();controller=undefined;
    };
    async function connect(){
      if(disposed || controller || AppState.currentState!=='active')return;
      const active=new AbortController();controller=active;
      const touch=()=>{clearTimeout(watchdog);watchdog=setTimeout(()=>active.abort(),45000);};
      try {
        touch();
        const response=await fetch(`${API_URL}/events`,{signal:active.signal,
          headers:{Authorization:`Bearer ${token}`,Accept:'text/event-stream'}});
        if(disposed || active.signal.aborted)return;
        if(response.status===401){await expire();return;}
        if(!response.ok || !response.headers.get('content-type')?.includes('text/event-stream') || !response.body)throw new Error('Canal no disponible');
        const reader=response.body.getReader(),decoder=new TextDecoder();
        let buffer='';
        while(!disposed && !active.signal.aborted){
          const {done,value}=await reader.read();if(done || disposed || active.signal.aborted)break;
          touch();buffer+=decoder.decode(value,{stream:true});
          let end;
          while((end=buffer.indexOf('\n\n'))!==-1){
            const event=buffer.slice(0,end);buffer=buffer.slice(end+2);
            if(/^event: (ready|equipment-changed)$/m.test(event)){
              failures=0;notify();
            }
          }
          if(buffer.length>16384)throw new Error('Aviso demasiado grande');
        }
      } catch { /* Sin cobertura: se reintenta sin mostrar animación ni borrar datos. */ }
      finally {
        active.abort();
        // Una conexión anterior no debe cancelar el watchdog de la nueva.
        if(controller===active){
          clearTimeout(watchdog);controller=undefined;
          if(!disposed && AppState.currentState==='active'){
            const delay=Math.min(30000,1000*2**Math.min(failures++,5))+Math.random()*500;
            retry=setTimeout(()=>{void connect();},delay);
          }
        }
      }
    }
    void connect();
    const subscription=AppState.addEventListener('change',state=>{
      stop();if(state==='active'){failures=0;void connect();}
    });
    return ()=>{disposed=true;stop();subscription.remove();};
  },[token,expire]);
  return children;
}
