import { pool } from './db.mjs';
import { tokenHash } from './auth.mjs';
import { sessionUser } from './equipment.mjs';

// Una conexión HTTP por sesión activa; no ocupa una conexión PostgreSQL mientras
// espera. Solo transmite invalidaciones: los datos se leen con los permisos de la API.
const streams=new Set();
const send=(stream,event)=>{
  if(stream.res.destroyed || !stream.res.write(`event: ${event}\ndata: {}\n\n`))stream.res.end();
};
export async function eventsRoute(req,res,reply) {
  if(req.url!=='/api/events' || req.method!=='GET')return false;
  const user=await sessionUser(req);
  if(!user){reply(res,401,{error:'Inicia sesión para continuar.'});return true;}
  if(streams.size>=1000 || [...streams].filter(s=>s.userId===user.id).length>=5){
    reply(res,429,{error:'Demasiadas conexiones de actualización.'});return true;
  }
  const stream={res,userId:user.id,hash:tokenHash(req.headers.authorization.slice(7))};
  res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store',
    'x-accel-buffering':'no','x-content-type-options':'nosniff'});
  streams.add(stream);
  // ready obliga a reconciliar tras cualquier reconexión: no hay que reproducir
  // todos los avisos que ocurrieron sin cobertura o durante un redespliegue.
  send(stream,'ready');
  const heartbeat=setInterval(()=>{if(!res.write(': keepalive\n\n'))res.end();},15000);
  // Renueva periódicamente la autorización sin mantener sesiones SSE indefinidas.
  const lifetime=setTimeout(()=>res.end(),300000);
  res.on('close',()=>{clearInterval(heartbeat);clearTimeout(lifetime);streams.delete(stream);});
  return true;
}
export async function equipmentChanged(organizationId) {
  if(!streams.size)return;
  try {
    // Se vuelven a comprobar sesión, actividad y membresía al emitir. Un usuario
    // de otra empresa, revocado o desconectado nunca recibe la invalidación.
    const hashes=[...new Set([...streams].map(s=>s.hash))];
    const {rows}=await pool.query(`SELECT DISTINCT s.token_hash FROM sessions s
      JOIN users u ON u.id=s.user_id AND u.active
      JOIN memberships m ON m.user_id=u.id AND m.organization_id=$1
      WHERE s.expires_at>now() AND s.token_hash=ANY($2::text[])`,[organizationId,hashes]);
    const allowed=new Set(rows.map(r=>r.token_hash));
    for(const stream of streams)if(allowed.has(stream.hash))send(stream,'equipment-changed');
  } catch {
    // El guardado ya está confirmado: un fallo del canal no revierte la asignación.
    // Reconectar provoca una lectura completa y recupera el aviso perdido.
    closeEventStreams();
  }
}
export function closeEventStreams(){for(const stream of streams)stream.res.end();}
