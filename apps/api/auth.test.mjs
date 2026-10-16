import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, newToken, tokenHash } from './auth.mjs';
test('contraseñas con sal, verificación y límites', async () => {
  const hash = await hashPassword('example-password-123');
  assert.notEqual(hash, await hashPassword('example-password-123'));
  assert.equal(await verifyPassword('example-password-123', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(await verifyPassword('x'.repeat(1025), hash), false);
  await assert.rejects(hashPassword('short'));
});
test('tokens opacos y hash para almacenamiento', () => {
  const token = newToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(token, newToken());
  assert.equal(tokenHash(token).length, 64);
  assert.notEqual(tokenHash(token), token);
});
