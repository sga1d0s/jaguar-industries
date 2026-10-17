import { pool } from '../db.mjs';
import { migrateClientAccess } from '../panel-schema.mjs';
// Tarea del propietario: no crea usuarios ni concede permisos internos del panel.
const client=await pool.connect();
try {
  await client.query('BEGIN');
  await migrateClientAccess(client);
  await client.query('COMMIT');
  console.log('Permisos de alta de clientes preparados.');
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
