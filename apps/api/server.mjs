import { createServer } from 'node:http';
import { pool } from './db.mjs';
import { equipmentRoute } from './equipment.mjs';
import { hashPassword, verifyPassword, newToken, tokenHash } from './auth.mjs';
// Si el correo no existe, calculamos igualmente scrypt para reducir diferencias de tiempo
// que podrían ayudar a averiguar qué cuentas existen.
const dummyHash = await hashPassword(newToken());
// Limita el trabajo de contraseñas simultáneo para no saturar este proceso Node.
let activeLogins = 0;
// Todas las respuestas son JSON y no deben almacenarse en cachés intermedias.
const reply = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
};
// Lee el JSON enviado por el móvil; el límite de 4 KiB evita peticiones desproporcionadas.
async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 4096) throw new Error('body');
  }
  return JSON.parse(body);
}
const server = createServer(async (req, res) => {
  try {
    // health comprueba HTTP; ready comprueba además el acceso al esquema de PostgreSQL.
    if (req.method === 'GET' && req.url === '/api/health') return reply(res, 200, { status: 'ok', service: 'jaguar-api' });
    if (req.method === 'GET' && req.url === '/api/ready') {
      await pool.query('SELECT 1 FROM users LIMIT 1');
      return reply(res, 200, { status: 'ok' });
    }
    // Login: valida los datos, comprueba la contraseña y crea una sesión revocable.
    if (req.method === 'POST' && req.url === '/api/auth/login') {
      if (activeLogins >= 8) return reply(res, 429, { error: 'Espera un momento antes de volver a intentarlo.' });
      activeLogins++;
      try {
        let body;
        try { body = await readBody(req); } catch { return reply(res, 400, { error: 'Solicitud no válida.' }); }
        const { email, password } = body || {};
        if (typeof email !== 'string' || email.length > 254 || !email.includes('@') || typeof password !== 'string' || Buffer.byteLength(password) > 1024) return reply(res, 400, { error: 'Introduce un email y una contraseña válidos.' });
        const normalized = email.trim().toLowerCase();
        // El contador se actualiza de forma atómica en PostgreSQL, incluso con peticiones
        // concurrentes. Cada correo dispone de diez intentos por ventana de quince minutos.
        const limit = await pool.query(`INSERT INTO login_attempts(email, attempts, reset_at)
          VALUES ($1,1,now()+interval '15 minutes') ON CONFLICT(email) DO UPDATE SET
          attempts=CASE WHEN login_attempts.reset_at<=now() THEN 1 ELSE login_attempts.attempts+1 END,
          reset_at=CASE WHEN login_attempts.reset_at<=now() THEN now()+interval '15 minutes' ELSE login_attempts.reset_at END RETURNING attempts`, [normalized]);
        if (limit.rows[0].attempts > 10) return reply(res, 429, { error: 'Demasiados intentos. Prueba dentro de 15 minutos.' });
        // Los valores van separados del SQL mediante $1: no se concatenan datos del usuario.
        const { rows } = await pool.query('SELECT id,email,name,password_hash,active FROM users WHERE email=$1', [normalized]);
        const user = rows[0];
        const valid = await verifyPassword(password, user?.password_hash || dummyHash);
        if (!user?.active || !valid) return reply(res, 401, { error: 'Email o contraseña incorrectos.' });
        // El móvil recibe el token original; la base conserva solo su hash y la caducidad.
        // El hash de la contraseña nunca forma parte de la respuesta.
        const token = newToken();
        const session = await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '7 days') RETURNING expires_at", [tokenHash(token), user.id]);
        await pool.query('DELETE FROM login_attempts WHERE email=$1', [normalized]);
        return reply(res, 200, { token, expiresAt: session.rows[0].expires_at, user: { id: user.id, email: user.email, name: user.name } });
      } finally { activeLogins--; }
    }
    // Las peticiones autenticadas traen el token en la cabecera Authorization: Bearer …
    if ((req.method === 'GET' && req.url === '/api/auth/me') || (req.method === 'POST' && req.url === '/api/auth/logout')) {
      const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      if (!token) return reply(res, 401, { error: 'Inicia sesión.' });
      const hash = tokenHash(token);
      // Borrar la sesión invalida ese token aunque alguien conserve una copia en el móvil.
      if (req.url.endsWith('/logout')) {
        await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hash]);
        return reply(res, 200, { status: 'ok' });
      }
      // Una sesión solo permite entrar si sigue vigente y su usuario continúa activo.
      const { rows } = await pool.query('SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active', [hash]);
      return rows[0] ? reply(res, 200, { user: rows[0] }) : reply(res, 401, { error: 'La sesión ha caducado. Vuelve a entrar.' });
    }
    // Las rutas de equipos aplican el alcance del cliente antes de devolver datos o PDF.
    if (await equipmentRoute(req, res, reply)) return;
    return reply(res, 404, { error: 'Not found' });
  } catch { console.error('Request failed'); if (!res.headersSent) reply(res, 503, { error: 'Servicio temporalmente no disponible.' }); else res.end(); }
});
// Límites de espera y apagado ordenado: Docker puede detener la API sin cortar
// inmediatamente las peticiones en curso ni dejar conexiones abiertas a PostgreSQL.
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Jaguar API listening'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
