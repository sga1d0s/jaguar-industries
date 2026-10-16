import { pool } from '../db.mjs';
import { hashPassword } from '../auth.mjs';
// Solo el administrador crea cuentas; no existe registro público en esta primera versión.
const [email, name] = process.argv.slice(2);
if (!email || !name || !email.includes('@')) throw new Error('Uso: create-user.mjs email nombre (contraseña por stdin). Requiere rol administrador.');
// Recibe la contraseña por stdin, para no incluirla en argumentos visibles del proceso.
let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, '');
try {
  // Normaliza el correo y guarda únicamente el resultado de scrypt con su sal.
  await pool.query('INSERT INTO users(email,name,password_hash) VALUES ($1,$2,$3)', [email.trim().toLowerCase(), name, await hashPassword(password)]);
  console.log('Usuario creado.');
} finally { await pool.end(); }
