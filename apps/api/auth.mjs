import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 1024) throw new Error('La contraseña debe tener entre 12 y 1024 bytes.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 1024) return false;
  const [salt, hex] = stored.split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
