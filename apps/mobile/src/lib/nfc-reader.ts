import NfcManager from 'react-native-nfc-manager';

let started:Promise<void>|null=null;
// start() vuelve a cargar el intent original en la cola nativa de Android.
// Inicializar una sola vez evita reabrir una etiqueta antigua al reanudar la app.
export function startNfc():Promise<void> {
  if(!started)started=NfcManager.start().then(()=>{}).catch(error=>{started=null;throw error;});
  return started;
}
