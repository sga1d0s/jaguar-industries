import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';
import { apiRequest, ApiError } from './api';
export type User = { id:string; name:string; email:string };
type Session = {user:User;token:string};
const KEY='jaguar.session';
type Auth = {
  user:User|null; token:string|null; ready:boolean; restoreError:boolean;
  restore:()=>Promise<void>; login:(email:string,password:string)=>Promise<void>; logout:()=>Promise<void>;
  authenticatedRequest:<T>(path:string)=>Promise<T>; expire:()=>Promise<void>;
};
const Context=createContext<Auth|null>(null);
// Los PDF se guardan de forma temporal y separados por cuenta; no son aún un modo offline.
export const pdfDirectory = (userId:string) => new Directory(Paths.cache, 'jaguar-pdfs', userId);
const clearDocuments = (id?:string) => {
  const directory=id?pdfDirectory(id):new Directory(Paths.cache,'jaguar-pdfs');
  if(directory.exists) directory.delete();
};
async function savedSession():Promise<Session|null> {
  const token=await SecureStore.getItemAsync(KEY);
  if(!token) return null;
  try { const data=await apiRequest<{user:User}>('/auth/me',token);return {user:data.user,token}; }
  catch(error) {
    if(!(error instanceof ApiError) || error.status!==401) throw error;
    await SecureStore.deleteItemAsync(KEY);clearDocuments();return null;
  }
}
// Una única sesión compartida por las rutas: cambiar de pantalla no vuelve a pedir el login.
export function AuthProvider({children}:{children:ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [restoreError,setRestoreError]=useState(false);
  useEffect(()=>{
    let mounted=true;
    savedSession().then(value=>{if(mounted){setSession(value);setReady(true);}})
      .catch(()=>{if(mounted)setRestoreError(true);});
    return ()=>{mounted=false;};
  },[]);
  const restore=async()=>{
    try {const value=await savedSession();setSession(value);setRestoreError(false);setReady(true);}
    catch {setRestoreError(true);throw new Error('No se pudo recuperar la sesión.');}
  };
  const login=async(email:string,password:string)=>{
    const value=await apiRequest<Session>('/auth/login',undefined,{email:email.trim(),password});
    await SecureStore.setItemAsync(KEY,value.token);setSession(value);
  };
  const expire=useCallback(async()=>{
    await SecureStore.deleteItemAsync(KEY);
    // La navegación protegida desaparece en cuanto se invalida la sesión.
    setSession(null);setReady(true);clearDocuments();
  },[]);
  const token=session?.token;
  const authenticatedRequest=useCallback(async<T,>(path:string):Promise<T>=>{
    if(!token) throw new ApiError('Inicia sesión.',401);
    try {return await apiRequest<T>(path,token);}
    catch(error) {if(error instanceof ApiError && error.status===401) await expire();throw error;}
  },[token,expire]);
  const logout=async()=>{
    if(!session)return;
    await apiRequest('/auth/logout',session.token,{});
    await expire();
  };
  return <Context.Provider value={{user:session?.user||null,token:token||null,ready,restoreError,restore,login,logout,authenticatedRequest,expire}}>{children}</Context.Provider>;
}
export function useAuth() {
  const value=useContext(Context);if(!value)throw new Error('Falta AuthProvider');return value;
}
