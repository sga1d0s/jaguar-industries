import { pool } from '../db.mjs';
// Esta tarea usa el rol administrador, separado del rol que tendrá la API en ejecución.
const password = process.env.APP_DATABASE_PASSWORD;
if (!password || password.length < 20) throw new Error('Define APP_DATABASE_PASSWORD con al menos 20 caracteres. Usar credenciales de migración en PGUSER/PGPASSWORD.');
const client = await pool.connect();
try {
  // Agrupa los cambios: un error revierte esta migración completa.
  await client.query('BEGIN');
  await client.query(`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
    name text NOT NULL, password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS login_attempts (
    email text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL);`);
  // Prepara el usuario de la API sin otorgarle permisos para modificar usuarios o tablas.
  // Reutilizar la contraseña configurada en Portainer permite repetir la tarea.
  const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname='jaguar_app'");
  if (!role.rowCount) await client.query('CREATE ROLE jaguar_app LOGIN');
  await client.query(`ALTER ROLE jaguar_app PASSWORD ${client.escapeLiteral(password)}`);
  await client.query(`GRANT CONNECT ON DATABASE jaguar TO jaguar_app;
    GRANT USAGE ON SCHEMA public TO jaguar_app;
    GRANT SELECT ON users TO jaguar_app;
    GRANT SELECT, INSERT, DELETE ON sessions TO jaguar_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON login_attempts TO jaguar_app;`);
  await client.query('COMMIT');
  console.log('Esquema de autenticación y rol limitado preparados.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
