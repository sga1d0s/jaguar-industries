import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
// Genera una sal aleatoria por contraseña y aplica scrypt, un cálculo deliberadamente
// costoso. Guardamos sal y resultado, nunca la contraseña original.
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 1024) throw new Error('La contraseña debe tener entre 12 y 1024 bytes.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
// Repite el cálculo con la sal guardada y compara sin detenerse en la primera
// diferencia, para reducir filtraciones por el tiempo que tarda la comparación.
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 1024) return false;
  const [salt, hex] = stored.split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
// La sesión usa 32 bytes aleatorios. SHA-256 permite buscarla en la base sin
// almacenar el token que sirve como credencial; no se usa para guardar contraseñas.
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
