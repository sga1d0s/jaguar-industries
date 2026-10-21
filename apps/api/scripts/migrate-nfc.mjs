import { pool } from '../db.mjs';
import { migrateNfc } from '../panel-schema.mjs';
// Tarea explícita del propietario; no vincula etiquetas ni modifica equipos.
const client=await pool.connect();
try {
  await client.query('BEGIN');
  await migrateNfc(client);
  await client.query('COMMIT');
  console.log('Permiso de vinculación NFC preparado.');
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
