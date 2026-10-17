import { pool } from '../db.mjs';
import { migratePanel } from '../panel-schema.mjs';
// Migración y autorización explícitas; no existe una ruta pública para hacerse operador.
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error('Indica el correo de la cuenta que administrará Jaguar.');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const user = (await client.query('SELECT id FROM users WHERE email=$1 AND active',[email])).rows[0];
  if (!user) throw new Error('La cuenta debe existir y estar activa.');
  await migratePanel(client);
  await client.query('INSERT INTO panel_operators(user_id) VALUES($1) ON CONFLICT DO NOTHING',[user.id]);
  await client.query('COMMIT');
  console.log('Esquema del panel preparado y acceso interno concedido a la cuenta indicada.');
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
