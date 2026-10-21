import { startNfc } from './nfc-reader';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import NfcManager, { NfcEvents, type TagEvent } from 'react-native-nfc-manager';

type PendingTag={uid:string;sequence:number};
const Context=createContext<{pending:PendingTag|null;consume:(sequence:number)=>void}>({pending:null,consume:()=>{}});

// Recoge el UID que Android entrega al abrir Jaguar, incluso mientras se restaura
// la sesión o se muestra el login. Solo lo conserva en memoria y no concede acceso.
export function NfcIntents({children}:{children:ReactNode}) {
  const [pending,setPending]=useState<PendingTag|null>(null);
  const sequence=useRef(0);
  const consume=useCallback((value:number)=>setPending(current=>current?.sequence===value?null:current),[]);
  useEffect(()=>{
    if(Platform.OS!=='android')return;
    let active=true;
    let last={uid:'',time:0};
    const receive=(tag:TagEvent|null)=>{
      if(!active||!tag?.techTypes?.includes('android.nfc.tech.NfcV'))return;
      const uid=tag.id?.toUpperCase();
      if(!uid||!/^[0-9A-F]{16}$/.test(uid))return;
      // El mismo intent puede llegar por evento y por la cola nativa al reanudar.
      const now=Date.now();
      if(last.uid===uid&&now-last.time<2000)return;
      last={uid,time:now};
      setPending({uid,sequence:++sequence.current});
    };
    const background=async()=>{
      try{
        const tag=await NfcManager.getBackgroundTag();
        receive(tag);
        await NfcManager.clearBackgroundTag();
      }catch{/* No hay etiqueta pendiente o el dispositivo no ofrece NFC. */}
    };
    NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag,tag=>{
      receive(tag);
      void NfcManager.clearBackgroundTag().catch(()=>{});
    });
    void (async()=>{
      try{
        if(!await NfcManager.isSupported()||!active)return;
        await startNfc();
        receive(await NfcManager.getLaunchTagEvent());
        await background();
      }catch{/* La lectura explícita de la pantalla muestra los errores al usuario. */}
    })();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void background();});
    return ()=>{
      active=false;subscription.remove();
      NfcManager.setEventListener(NfcEvents.DiscoverBackgroundTag,null);
    };
  },[]);
  return <Context.Provider value={{pending,consume}}>{children}</Context.Provider>;
}

// Se monta dentro del grupo privado: primero se valida la sesión, después se
// navega a la resolución del UID. El servidor vuelve a comprobar la asignación.
export function NfcIntentNavigation(){
  const {pending,consume}=useContext(Context);
  const path=usePathname();
  useEffect(()=>{
    if(!pending)return;
    consume(pending.sequence);
    const destination={pathname:'/nfc/[uid]' as const,params:{uid:pending.uid,sequence:String(pending.sequence)}};
    if(path.startsWith('/nfc/'))router.replace(destination);
    else router.push(destination);
  },[pending,consume,path]);
  return null;
}
