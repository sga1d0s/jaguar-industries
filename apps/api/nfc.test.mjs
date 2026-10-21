import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNfcUid } from './nfc.mjs';

test('UID real ISO 15693: ambos órdenes producen la misma clave',()=>{
  for(const uid of ['24369B21090104E0','E0040109219B3624','24:36:9b:21:09:01:04:e0',' e0 04 01 09 21 9b 36 24 ']){
    assert.equal(normalizeNfcUid(uid),'E0040109219B3624');
  }
});
test('rechaza UIDs truncados, protocolos distintos, texto y entradas no escalares',()=>{
  for(const uid of [undefined,null,{},[],123,'','E004','E0040109219B362400','X0040109219B3624','00040109219B3624','E0040109219B362!',' '.repeat(65)]){
    assert.throws(()=>normalizeNfcUid(uid),TypeError);
  }
});
