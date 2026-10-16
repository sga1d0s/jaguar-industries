import { readFile } from 'node:fs/promises';
import { pool } from '../db.mjs';
import { documentRoot } from '../equipment.mjs';
import { join } from 'node:path';
// El correo se resuelve en el servidor. No se crean usuarios ni se cambian contraseñas.
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error('Uso: seed-equipment.mjs correo-de-una-cuenta-existente');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const user = (await client.query('SELECT id FROM users WHERE email=$1 AND active', [email])).rows[0];
  if (!user) throw new Error('La cuenta debe existir y estar activa.');
  // Las claves demo hacen repetible la carga y evitan tocar organizaciones reales.
  const org = async (key, name) => (await client.query(`INSERT INTO organizations(name,demo_key,is_demo)
    VALUES ($1,$2,true) ON CONFLICT(demo_key) DO UPDATE SET demo_key=EXCLUDED.demo_key RETURNING id`, [name,key])).rows[0].id;
  const jaguar = await org('jaguar-demo-owner', 'Jaguar · demostración');
  const customer = await org(`customer-demo-${user.id}`, 'Cliente de demostración');
  await client.query('INSERT INTO memberships(user_id,organization_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user.id,customer]);
  const products = [
    { folder:'serie-630', code:'630', name:'Polea manual', category:'Elevación y tracción',
      description:'Polipasto manual de cadena de la serie 630.', reference:'AFK3000', variant:'Serie 630 · 1.000 kg',
      specs:[{label:'Capacidad nominal',value:'1.000 kg'},{label:'Número de ramales',value:'1'},{label:'Peso con 3 m de elevación',value:'11 kg'}], kind:'sale' },
    { folder:'modelo-bt', code:'BT', name:'Garra articulada', category:'Garras de elevación',
      description:'Garra con anilla articulada para elevación vertical, volteo y transporte de chapas.', reference:'AGU101', variant:'BT-10 · 1.000 kg',
      specs:[{label:'Carga máxima de trabajo',value:'1.000 kg'},{label:'Apertura',value:'0–20 mm'},{label:'Peso',value:'4,6 kg'}], kind:'rental' },
  ];
  const sources = JSON.parse(await readFile(join(documentRoot, 'fuentes.json'), 'utf8'));
  for (const [index, p] of products.entries()) {
    const model = (await client.query(`INSERT INTO product_models(code,name,category,description) VALUES($1,$2,$3,$4)
      ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,[p.code,p.name,p.category,p.description])).rows[0].id;
    const variant = (await client.query(`INSERT INTO product_variants(model_id,reference,name,specifications) VALUES($1,$2,$3,$4)
      ON CONFLICT(reference) DO UPDATE SET reference=EXCLUDED.reference RETURNING id`,[model,p.reference,p.variant,JSON.stringify(p.specs)])).rows[0].id;
    // Cada cuenta recibe unidades ficticias distintas; no se inventan etiquetas NFC físicas.
    const serial = `DEMO-${user.id}-${index+1}`;
    const unit = (await client.query(`INSERT INTO equipment(variant_id,owner_organization_id,serial_number,is_demo)
      VALUES($1,$2,$3,true) ON CONFLICT(serial_number) DO UPDATE SET serial_number=EXCLUDED.serial_number RETURNING id`,[variant,p.kind==='sale'?customer:jaguar,serial])).rows[0].id;
    await client.query(`INSERT INTO equipment_assignments(equipment_id,client_organization_id,kind)
      SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM equipment_assignments WHERE equipment_id=$1)`,[unit,customer,p.kind]);
    // Documentos originales compartidos por modelo, no duplicados por unidad.
    for (const source of sources.filter(s=>s.producto===p.folder)) {
      const kind = {ficha:'datasheet',manual:'manual','declaracion-ce':'declaration'}[source.tipo];
      const title = {ficha:'Ficha técnica',manual:'Manual de instrucciones','declaracion-ce':'Declaración CE'}[source.tipo];
      const doc = (await client.query(`INSERT INTO product_documents(storage_key,title,kind,language,downloaded_on,sha256,source_url,byte_size)
        VALUES($1,$2,$3,'es',$4,$5,$6,$7) ON CONFLICT(storage_key) DO UPDATE SET storage_key=EXCLUDED.storage_key RETURNING id`,
      [source.archivo,title,kind,source.fecha_descarga,source.sha256,source.url,source.bytes])).rows[0].id;
      await client.query('INSERT INTO model_documents(model_id,document_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[model,doc]);
    }
  }
  await client.query('COMMIT');
  console.log('Dos unidades DEMO asignadas a la cuenta. No representan ventas, alquileres ni equipos reales.');
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
