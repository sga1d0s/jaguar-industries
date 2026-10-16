import pg from 'pg';
// Reutiliza hasta cinco conexiones en vez de abrir una por petición. En producción
// las variables vienen de Portainer y usan jaguar_app, un rol con permisos limitados.
export const pool = new pg.Pool({
  host: process.env.PGHOST || 'db', port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'jaguar', user: process.env.PGUSER || 'jaguar_app',
  password: process.env.PGPASSWORD, max: 5, connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
// No imprimimos la configuración de conexión: puede contener credenciales.
pool.on('error', () => console.error('Database connection error'));
