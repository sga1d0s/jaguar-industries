import { pool } from './db.mjs';
import { tokenHash } from './auth.mjs';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
export const documentRoot = resolve(process.env.DOCUMENTS_ROOT || fileURLToPath(new URL('../../docs/referencias/productos/', import.meta.url)));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El usuario se obtiene del token, nunca de un organization_id o user_id enviado por el móvil.
export async function sessionUser(req) {
  const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return null;
  const { rows } = await pool.query(`SELECT u.id,u.email,u.name FROM sessions s
    JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,[tokenHash(token)]);
  return rows[0] || null;
}

// Esta cláusula se reutiliza en lista, ficha y descarga. La asignación y la membresía
// deben seguir vigentes en cada petición, aunque el cliente conserve identificadores antiguos.
const scope = `FROM equipment e
  JOIN product_variants v ON v.id=e.variant_id
  JOIN product_models m ON m.id=v.model_id
  JOIN LATERAL (
    SELECT ea.kind,ea.client_organization_id,o.name AS customer_name
    FROM equipment_assignments ea
    JOIN memberships member ON member.organization_id=ea.client_organization_id AND member.user_id=$1
    JOIN organizations o ON o.id=ea.client_organization_id
    WHERE ea.equipment_id=e.id AND ea.starts_at<=now() AND (ea.ends_at IS NULL OR ea.ends_at>now())
    ORDER BY ea.starts_at DESC,ea.id LIMIT 1
  ) assignment ON true`;
const fields = `e.id,e.serial_number,e.nfc_uid,e.is_demo,e.created_at,
  v.reference,v.name AS variant_name,v.specifications,m.id AS model_id,m.code AS model_code,
  m.name AS model_name,m.category,m.description,assignment.kind,assignment.customer_name`;
const equipmentDTO = row => ({
  id:row.id,serialNumber:row.serial_number,nfcLinked:!!row.nfc_uid,isDemo:row.is_demo,
  reference:row.reference,variantName:row.variant_name,modelCode:row.model_code,modelName:row.model_name,
  category:row.category,description:row.description,specifications:row.specifications,
  assignmentKind:row.kind,customerName:row.customer_name,
});

// Devuelve true si se ha atendido una ruta de equipos; el servidor conserva el resto de rutas.
export async function equipmentRoute(req, res, reply) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/equipment')) return false;
  if (req.method !== 'GET') { reply(res,405,{error:'Método no permitido.'}); return true; }
  const user = await sessionUser(req);
  if (!user) { reply(res,401,{error:'La sesión ha caducado. Vuelve a entrar.'}); return true; }
  if (url.pathname === '/api/equipment') {
    const cursor = url.searchParams.get('cursor');
    if (cursor && !uuid.test(cursor)) { reply(res,400,{error:'Cursor no válido.'}); return true; }
    // Una página tiene como máximo 50 unidades. El cursor no cambia el alcance autorizado.
    const { rows } = await pool.query(`SELECT ${fields} ${scope}
      WHERE ($2::uuid IS NULL OR e.id>$2::uuid) ORDER BY e.id LIMIT 51`,[user.id,cursor]);
    reply(res,200,{items:rows.slice(0,50).map(equipmentDTO),nextCursor:rows.length>50?rows[49].id:null});
    return true;
  }
  const match = url.pathname.match(/^\/api\/equipment\/([^/]+)(?:\/documents\/([^/]+))?$/);
  if (!match || !uuid.test(match[1]) || (match[2] && !uuid.test(match[2]))) {
    reply(res,404,{error:'Equipo o documento no disponible.'}); return true;
  }
  const [,id,documentId] = match;
  if (documentId) {
    // Autorización y aplicabilidad se comprueban en una consulta, antes de leer el archivo.
    const {rows} = await pool.query(`SELECT d.* ${scope}
      JOIN model_documents md ON md.model_id=m.id JOIN product_documents d ON d.id=md.document_id
      WHERE e.id=$2 AND d.id=$3`,[user.id,id,documentId]);
    if (!rows[0]) { reply(res,404,{error:'Equipo o documento no disponible.'}); return true; }
    const doc = rows[0];
    const path = resolve(documentRoot, doc.storage_key);
    if (!path.startsWith(documentRoot+sep) || !path.endsWith('.pdf')) throw new Error('Invalid document key');
    const file = await open(path, 'r');
    try {
      const stat = await file.stat();
      res.writeHead(200,{'content-type':'application/pdf','content-length':stat.size,
        'content-disposition':`inline; filename="${doc.kind}-${doc.id}.pdf"`,
        'cache-control':'no-store','x-content-type-options':'nosniff'});
      await pipeline(file.createReadStream({autoClose:false}),res);
    } finally { await file.close(); }
    return true;
  }
  const {rows} = await pool.query(`SELECT ${fields} ${scope} WHERE e.id=$2`,[user.id,id]);
  if (!rows[0]) { reply(res,404,{error:'Equipo o documento no disponible.'}); return true; }
  const unit = rows[0];
  const docs = await pool.query(`SELECT d.id,d.title,d.kind,d.language,d.revision,d.downloaded_on,d.byte_size
    FROM product_documents d JOIN model_documents md ON md.document_id=d.id
    WHERE md.model_id=$1 ORDER BY CASE d.kind WHEN 'datasheet' THEN 1 WHEN 'manual' THEN 2 ELSE 3 END`,[unit.model_id]);
  reply(res,200,{equipment:equipmentDTO(unit),documents:docs.rows.map(d=>({
    id:d.id,title:d.title,kind:d.kind,language:d.language,revision:d.revision,
    downloadedOn:d.downloaded_on,byteSize:d.byte_size,
  }))});
  return true;
}
