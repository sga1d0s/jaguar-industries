import { pool } from '../db.mjs';
import { migrateEquipment } from '../equipment-schema.mjs';
// Tarea explícita con credenciales del propietario; la API nunca cambia el esquema al arrancar.
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await migrateEquipment(client);
  await client.query('COMMIT');
  console.log('Esquema de equipos preparado.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
