import pg from 'pg';
export const pool = new pg.Pool({
  host: process.env.PGHOST || 'db', port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'jaguar', user: process.env.PGUSER || 'jaguar_app',
  password: process.env.PGPASSWORD, max: 5, connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
pool.on('error', () => console.error('Database connection error'));
