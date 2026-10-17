import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pool } from '../db.mjs';
import { documentRoot } from '../equipment.mjs';

// Carga únicamente catálogo y documentación común. No crea usuarios, unidades,
// etiquetas, membresías ni asignaciones y no sobrescribe datos editados en el panel.
const models = JSON.parse(await readFile(resolve(documentRoot, 'catalogo-ampliacion.json'), 'utf8'));
const sources = JSON.parse(await readFile(resolve(documentRoot, 'fuentes.json'), 'utf8'));
const kinds = { ficha: 'datasheet', manual: 'manual', 'declaracion-ce': 'declaration' };
const titles = { ficha: 'Ficha técnica', manual: 'Manual de instrucciones', 'declaracion-ce': 'Declaración CE' };
const documents = sources.filter(source => models.some(model => model.folder === source.producto));

// Verifica todos los archivos antes de empezar la transacción: una descarga incompleta
// o una ruta errónea nunca debe dejar documentos registrados que no puedan abrirse.
for (const source of documents) {
  const path = resolve(documentRoot, source.archivo);
  if (!path.startsWith(documentRoot + sep) || !path.endsWith('.pdf')) throw new Error('Ruta documental no válida.');
  const bytes = await readFile(path);
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || bytes.length !== source.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
    throw new Error(`Documento incompleto o modificado: ${source.archivo}`);
  }
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Impide dos importaciones concurrentes del mismo catálogo, incluidos los PDF compartidos.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('jaguar-official-catalog'))");
  for (const model of models) {
    const familyDocuments = documents.filter(source => source.producto === model.folder);
    if (familyDocuments.length !== 3 || new Set(familyDocuments.map(d => d.tipo)).size !== 3) {
      throw new Error(`Faltan documentos del modelo ${model.code}.`);
    }
    await client.query(`INSERT INTO product_models(code,name,category,description) VALUES($1,$2,$3,$4)
      ON CONFLICT(code) DO NOTHING`, [model.code, model.name, model.category, model.description]);
    const modelId = (await client.query('SELECT id FROM product_models WHERE code=$1', [model.code])).rows[0].id;
    for (const variant of model.variants) {
      await client.query(`INSERT INTO product_variants(model_id,reference,name,specifications) VALUES($1,$2,$3,$4)
        ON CONFLICT(reference) DO NOTHING`, [modelId, variant.reference, variant.name, JSON.stringify(variant.specifications)]);
      const saved = (await client.query('SELECT model_id FROM product_variants WHERE reference=$1', [variant.reference])).rows[0];
      if (saved.model_id !== modelId) throw new Error(`La referencia ${variant.reference} ya pertenece a otro modelo.`);
    }
    for (const source of familyDocuments) {
      // Un mismo manual puede aplicarse a varias familias (630/650), sin duplicar el PDF
      // ni su registro. El vínculo modelo-documento conserva esa aplicabilidad compartida.
      let document = (await client.query('SELECT id FROM product_documents WHERE sha256=$1 AND kind=$2 ORDER BY id LIMIT 1',
        [source.sha256, kinds[source.tipo]])).rows[0];
      if (!document) {
        document = (await client.query(`INSERT INTO product_documents
          (storage_key,title,kind,language,downloaded_on,sha256,source_url,byte_size)
          VALUES($1,$2,$3,'es',$4,$5,$6,$7) RETURNING id`,
        [source.archivo, titles[source.tipo], kinds[source.tipo], source.fecha_descarga, source.sha256, source.url, source.bytes])).rows[0];
      }
      await client.query('INSERT INTO model_documents(model_id,document_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [modelId, document.id]);
    }
  }
  await client.query('COMMIT');
  console.log(`Catálogo preparado: ${models.length} familias y ${models.reduce((n,m) => n + m.variants.length, 0)} referencias oficiales. Sin cambios en unidades o asignaciones.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
