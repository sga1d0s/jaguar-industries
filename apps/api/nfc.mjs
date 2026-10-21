// ISO 15693 identifica etiquetas con 8 bytes y prefijo E0. Android entrega
// los bytes en orden inverso al formato convencional. Aceptamos ambos órdenes
// para guardar una única clave y evitar asociaciones duplicadas entre plataformas.
export function normalizeNfcUid(value) {
  if (typeof value!=='string' || value.length>64) throw new TypeError('Introduce un UID ISO 15693 de 16 caracteres hexadecimales.');
  let uid=value.replace(/[\s:-]/g,'').toUpperCase();
  if (!/^[0-9A-F]{16}$/.test(uid)) throw new TypeError('Introduce un UID ISO 15693 de 16 caracteres hexadecimales.');
  if (!uid.startsWith('E0') && uid.endsWith('E0')) uid=uid.match(/../g).reverse().join('');
  if (!uid.startsWith('E0')) throw new TypeError('El UID no corresponde al formato ISO 15693 esperado (E0).');
  return uid;
}
