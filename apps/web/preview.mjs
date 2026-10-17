import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('./public',import.meta.url));
const origin=new URL(process.env.JAGUAR_PREVIEW_API || 'https://paneljaguar.sgaldos.com');
const { request:secureRequest }=await import('node:https');
// Solo desarrollo local: evita CORS y no almacena credenciales ni respuestas privadas.
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')) {
    const proxy=(origin.protocol==='https:'?secureRequest:request)(new URL(req.url,origin),{method:req.method,headers:{'content-type':req.headers['content-type'] || 'application/json',...(req.headers.authorization?{authorization:req.headers.authorization}:{})}},upstream=>{
      res.writeHead(upstream.statusCode,{'content-type':upstream.headers['content-type'] || 'application/json','cache-control':'no-store'}); upstream.pipe(res);
    });
    proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('API no disponible');});
    req.pipe(proxy); return;
  }
  try {
    const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
    const path=resolve(root,name);
    if(!path.startsWith(root+sep))throw new Error('Path');
    const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',png:'image/png',json:'application/json'};
    const body=await readFile(path);
    res.writeHead(200,{'content-type':types[path.split('.').pop()] || 'application/octet-stream','cache-control':'no-store'});res.end(body);
  } catch { res.writeHead(404);res.end('No disponible'); }
});
server.listen(4173,'127.0.0.1',()=>console.log('Panel local: http://127.0.0.1:4173'));
