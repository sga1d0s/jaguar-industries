import { pool } from '../db.mjs';
import { hashPassword } from '../auth.mjs';
const [email, name] = process.argv.slice(2);
if (!email || !name || !email.includes('@')) throw new Error('Uso: create-user.mjs email nombre (contraseña por stdin). Requiere rol administrador.');
let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, '');
try {
  await pool.query('INSERT INTO users(email,name,password_hash) VALUES ($1,$2,$3)', [email.trim().toLowerCase(), name, await hashPassword(password)]);
  console.log('Usuario creado.');
} finally { await pool.end(); }
