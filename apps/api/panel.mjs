import { pool } from './db.mjs';
import { sessionUser, documentRoot } from './equipment.mjs';
import { resolve, sep } from 'node:path';
import { open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class InputError extends Error {}
const text = (v,max=200) => {
  if (typeof v!=='string' || !v.trim() || v.includes('\0') || v.trim().length>max) throw new InputError('Revisa los campos obligatorios y su longitud.');
  return v.trim();
};
const id = v => { if (typeof v!=='string' || !uuid.test(v)) throw new InputError('Identificador no válido.'); return v; };
async function body(req) {
  let size=0, parts=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>16384) throw new InputError('Formulario demasiado grande.');
    parts.push(chunk);
  }
  try { const value=JSON.parse(Buffer.concat(parts)); if (!value || Array.isArray(value) || typeof value!=='object') throw 0; return value; }
  catch { throw new InputError('Formulario no válido.'); }
}

// El control se repite en TODAS las rutas, incluidas las descargas. Las membresías
// que usa el móvil no conceden permiso de administración.
export async function panelRoute(req,res,reply) {
  const url=new URL(req.url,'http://localhost');
  if (!url.pathname.startsWith('/api/panel/')) return false;
  const user=await sessionUser(req);
  if (!user) { reply(res,401,{error:'Inicia sesión para continuar.'}); return true; }
  const operator=await pool.query('SELECT 1 FROM panel_operators WHERE user_id=$1',[user.id]);
  if (!operator.rowCount) { reply(res,403,{error:'Esta cuenta no tiene acceso al panel interno de Jaguar.'}); return true; }
  try {
    if (req.method==='GET' && url.pathname==='/api/panel/me') { reply(res,200,{user}); return true; }
    // Listas paginadas: nunca se trunca silenciosamente el catálogo o el inventario.
    const cursor=url.searchParams.get('cursor');
    if (cursor) id(cursor);
    if (req.method==='GET' && url.pathname==='/api/panel/summary') {
      const {rows}=await pool.query(`SELECT
        (SELECT count(*)::int FROM organizations WHERE kind='client' AND NOT is_demo) AS clients,
        (SELECT count(*)::int FROM product_models) AS models,
        (SELECT count(*)::int FROM equipment WHERE NOT is_demo) AS units,
        (SELECT count(*)::int FROM equipment) AS all_units,
        (SELECT count(*)::int FROM equipment_assignments a JOIN equipment e ON e.id=a.equipment_id
          JOIN organizations customer ON customer.id=a.client_organization_id
          WHERE a.kind='rental' AND a.starts_at<=now() AND (a.ends_at IS NULL OR a.ends_at>now())
          AND NOT e.is_demo AND NOT customer.is_demo) AS rentals`);
      reply(res,200,rows[0]); return true;
    }
    const lists={
      clients: `SELECT id,name,is_demo FROM organizations WHERE kind='client' AND ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 51`,
      models: `SELECT m.id,m.code,m.name,m.category,m.description,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'reference',v.reference,'name',v.name,'specifications',v.specifications) ORDER BY v.reference)
          FROM product_variants v WHERE v.model_id=m.id),'[]') AS variants,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'kind',d.kind,'language',d.language) ORDER BY d.title)
          FROM model_documents md JOIN product_documents d ON d.id=md.document_id WHERE md.model_id=m.id),'[]') AS documents
        FROM product_models m WHERE ($1::uuid IS NULL OR m.id>$1) ORDER BY m.id LIMIT 51`,
      units: `SELECT e.id,e.serial_number,e.is_demo,e.nfc_uid IS NOT NULL AS nfc_linked,
        v.reference,v.name AS variant_name,m.name AS model_name,m.code AS model_code,
        o.name AS owner_name,a.id AS assignment_id,a.kind AS assignment_kind,a.client_name,a.client_id
        FROM equipment e JOIN product_variants v ON v.id=e.variant_id JOIN product_models m ON m.id=v.model_id
        JOIN organizations o ON o.id=e.owner_organization_id
        LEFT JOIN LATERAL (SELECT ea.id,ea.kind,c.name AS client_name,c.id AS client_id FROM equipment_assignments ea
          JOIN organizations c ON c.id=ea.client_organization_id WHERE ea.equipment_id=e.id
          AND ea.starts_at<=now() AND (ea.ends_at IS NULL OR ea.ends_at>now()) ORDER BY ea.starts_at DESC LIMIT 1) a ON true
        WHERE ($1::uuid IS NULL OR e.id>$1) ORDER BY e.id LIMIT 51`,
    };
    const section=url.pathname.slice('/api/panel/'.length);
    if (req.method==='GET' && lists[section]) {
      const {rows}=await pool.query(lists[section],[cursor]);
      reply(res,200,{items:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null}); return true;
    }
    const doc=url.pathname.match(/^\/api\/panel\/documents\/([^/]+)$/);
    if (req.method==='GET' && doc) {
      id(doc[1]);
      const row=(await pool.query('SELECT storage_key FROM product_documents WHERE id=$1',[doc[1]])).rows[0];
      if (!row) { reply(res,404,{error:'Documento no disponible.'}); return true; }
      const path=resolve(documentRoot,row.storage_key);
      if (!path.startsWith(documentRoot+sep) || !path.endsWith('.pdf')) throw new Error('Document key');
      const file=await open(path,'r');
      try {
        res.writeHead(200,{'content-type':'application/pdf','content-length':(await file.stat()).size,
          'content-disposition':`attachment; filename="jaguar-${doc[1]}.pdf"`,'cache-control':'no-store','x-content-type-options':'nosniff'});
        await pipeline(file.createReadStream({autoClose:false}),res);
      } finally { await file.close(); }
      return true;
    }
    const end=url.pathname.match(/^\/api\/panel\/assignments\/([^/]+)\/end$/);
    if (req.method!=='POST' || (!['clients','models','variants','units','assignments'].includes(section) && !end)) {
      reply(res,404,{error:'Ruta no disponible.'}); return true;
    }
    const input=await body(req);
    // Datos y registro de auditoría se confirman juntos. Bloquear la unidad evita
    // vender/alquilar dos veces cuando llegan formularios simultáneos.
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      let result, action=section;
      if (section==='clients') {
        result=(await client.query("INSERT INTO organizations(name) VALUES($1) RETURNING id",[text(input.name)])).rows[0];
      } else if (section==='models') {
        result=(await client.query('INSERT INTO product_models(code,name,category,description) VALUES($1,$2,$3,$4) RETURNING id',
          [text(input.code,50),text(input.name),text(input.category),text(input.description,2000)])).rows[0];
      } else if (section==='variants') {
        const specs=input.specifications;
        if (!Array.isArray(specs) || specs.length>30) throw new InputError('Introduce hasta 30 características.');
        const normalized=specs.map(s=>({label:text(s?.label,100),value:text(s?.value,200)}));
        result=(await client.query('INSERT INTO product_variants(model_id,reference,name,specifications) VALUES($1,$2,$3,$4) RETURNING id',
          [id(input.modelId),text(input.reference,80),text(input.name),JSON.stringify(normalized)])).rows[0];
      } else if (section==='units') {
        // Las unidades nuevas pertenecen a Jaguar hasta que una venta las transfiere.
        result=(await client.query(`INSERT INTO equipment(variant_id,owner_organization_id,serial_number)
          VALUES($1,(SELECT id FROM organizations WHERE kind='jaguar' AND NOT is_demo ORDER BY id LIMIT 1),$2) RETURNING id`,
          [id(input.variantId),text(input.serialNumber,150)])).rows[0];
      } else if (section==='assignments') {
        const unit=(await client.query(`SELECT e.id,e.is_demo,o.kind AS owner_kind FROM equipment e
          JOIN organizations o ON o.id=e.owner_organization_id WHERE e.id=$1 FOR UPDATE OF e`,[id(input.equipmentId)])).rows[0];
        if (!unit) throw new InputError('La unidad no existe.');
        if (unit.is_demo) throw new InputError('Las unidades DEMO son solo de consulta en el panel.');
        if (unit.owner_kind!=='jaguar') throw new InputError('La unidad ya pertenece a un cliente.');
        const active=await client.query(`SELECT 1 FROM equipment_assignments WHERE equipment_id=$1
          AND (ends_at IS NULL OR ends_at>clock_timestamp())`,[unit.id]);
        if (active.rowCount) throw new InputError('La unidad ya tiene una asignación. Finaliza primero el alquiler vigente.');
        if (!['sale','rental'].includes(input.kind)) throw new InputError('Selecciona venta o alquiler.');
        // El operador puede elegir también un cliente DEMO para probar el recorrido.
        // La membresía sigue determinando quién podrá consultar la unidad en la app.
        const customer=(await client.query("SELECT id FROM organizations WHERE id=$1 AND kind='client'",[id(input.clientId)])).rows[0];
        if (!customer) throw new InputError('El cliente no existe.');
        result=(await client.query('INSERT INTO equipment_assignments(equipment_id,client_organization_id,kind,starts_at) VALUES($1,$2,$3,clock_timestamp()) RETURNING id',
          [unit.id,customer.id,input.kind])).rows[0];
        if (input.kind==='sale') await client.query('UPDATE equipment SET owner_organization_id=$1 WHERE id=$2',[customer.id,unit.id]);
      } else {
        id(end[1]);
        const assignment=(await client.query(`SELECT a.equipment_id,e.is_demo FROM equipment_assignments a
          JOIN equipment e ON e.id=a.equipment_id WHERE a.id=$1`,[end[1]])).rows[0];
        if (!assignment) throw new InputError('Asignación no disponible.');
        if (assignment.is_demo) throw new InputError('Las unidades DEMO son solo de consulta en el panel.');
        await client.query('SELECT id FROM equipment WHERE id=$1 FOR UPDATE',[assignment.equipment_id]);
        result=(await client.query(`UPDATE equipment_assignments SET ends_at=clock_timestamp()
          WHERE id=$1 AND kind='rental' AND starts_at<=clock_timestamp() AND (ends_at IS NULL OR ends_at>clock_timestamp()) RETURNING id`,[end[1]])).rows[0];
        if (!result) throw new InputError('Solo se puede finalizar un alquiler vigente.');
        action='end-rental';
      }
      await client.query('INSERT INTO panel_audit(actor_id,action,target_id) VALUES($1,$2,$3)',[user.id,action,result.id]);
      await client.query('COMMIT');
      reply(res,201,result);
    } catch(error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } catch(error) {
    if (error instanceof InputError) reply(res,400,{error:error.message});
    else if (error.code==='23505') reply(res,409,{error:'Ya existe ese código, referencia o número de serie.'});
    else if (error.code==='23503') reply(res,400,{error:'El modelo, referencia o cliente seleccionado ya no está disponible.'});
    else throw error;
  }
  return true;
}
