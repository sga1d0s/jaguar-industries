import { createServer } from 'node:http';
import { pool } from './db.mjs';
import { hashPassword, verifyPassword, newToken, tokenHash } from './auth.mjs';
const dummyHash = await hashPassword(newToken());
let activeLogins = 0;
const reply = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
};
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
    if (req.method === 'GET' && req.url === '/api/health') return reply(res, 200, { status: 'ok', service: 'jaguar-api' });
    if (req.method === 'GET' && req.url === '/api/ready') {
      await pool.query('SELECT 1 FROM users LIMIT 1');
      return reply(res, 200, { status: 'ok' });
    }
    if (req.method === 'POST' && req.url === '/api/auth/login') {
      if (activeLogins >= 8) return reply(res, 429, { error: 'Espera un momento antes de volver a intentarlo.' });
      activeLogins++;
      try {
        let body;
        try { body = await readBody(req); } catch { return reply(res, 400, { error: 'Solicitud no válida.' }); }
        const { email, password } = body || {};
        if (typeof email !== 'string' || email.length > 254 || !email.includes('@') || typeof password !== 'string' || Buffer.byteLength(password) > 1024) return reply(res, 400, { error: 'Introduce un email y una contraseña válidos.' });
        const normalized = email.trim().toLowerCase();
        const limit = await pool.query(`INSERT INTO login_attempts(email, attempts, reset_at)
          VALUES ($1,1,now()+interval '15 minutes') ON CONFLICT(email) DO UPDATE SET
          attempts=CASE WHEN login_attempts.reset_at<=now() THEN 1 ELSE login_attempts.attempts+1 END,
          reset_at=CASE WHEN login_attempts.reset_at<=now() THEN now()+interval '15 minutes' ELSE login_attempts.reset_at END RETURNING attempts`, [normalized]);
        if (limit.rows[0].attempts > 10) return reply(res, 429, { error: 'Demasiados intentos. Prueba dentro de 15 minutos.' });
        const { rows } = await pool.query('SELECT id,email,name,password_hash,active FROM users WHERE email=$1', [normalized]);
        const user = rows[0];
        const valid = await verifyPassword(password, user?.password_hash || dummyHash);
        if (!user?.active || !valid) return reply(res, 401, { error: 'Email o contraseña incorrectos.' });
        const token = newToken();
        const session = await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '7 days') RETURNING expires_at", [tokenHash(token), user.id]);
        await pool.query('DELETE FROM login_attempts WHERE email=$1', [normalized]);
        return reply(res, 200, { token, expiresAt: session.rows[0].expires_at, user: { id: user.id, email: user.email, name: user.name } });
      } finally { activeLogins--; }
    }
    if ((req.method === 'GET' && req.url === '/api/auth/me') || (req.method === 'POST' && req.url === '/api/auth/logout')) {
      const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
      if (!token) return reply(res, 401, { error: 'Inicia sesión.' });
      const hash = tokenHash(token);
      if (req.url.endsWith('/logout')) {
        await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hash]);
        return reply(res, 200, { status: 'ok' });
      }
      const { rows } = await pool.query('SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active', [hash]);
      return rows[0] ? reply(res, 200, { user: rows[0] }) : reply(res, 401, { error: 'La sesión ha caducado. Vuelve a entrar.' });
    }
    return reply(res, 404, { error: 'Not found' });
  } catch { console.error('Request failed'); if (!res.headersSent) reply(res, 503, { error: 'Servicio temporalmente no disponible.' }); else res.end(); }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Jaguar API listening'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
