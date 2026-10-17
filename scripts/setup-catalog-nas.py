"""Carga aditiva del catálogo oficial, con copia previa y archivos ya desplegados."""
import argparse
import hashlib
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--image', default='jaguar-api:catalog-check')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]

def docker(*items, env=None):
    result = subprocess.run(['docker', *items], env={**os.environ, **(env or {})}, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('La tarea Docker falló. No se han mostrado credenciales.')
    return result.stdout

# Se comprueba el contenido de la API activa antes de publicar registros en la base:
# evita enlaces rotos si todavía está ejecutándose una imagen sin los nuevos PDF.
expected = hashlib.sha256((root / 'docs/referencias/productos/catalogo-ampliacion.json').read_bytes()).hexdigest()
check = "const fs=require('node:fs'),c=require('node:crypto');console.log(c.createHash('sha256').update(fs.readFileSync(process.env.DOCUMENTS_ROOT+'/catalogo-ampliacion.json')).digest('hex'))"
try:
    deployed = docker('exec', 'jaguar-industries-api-1', 'node', '-e', check).strip()
except RuntimeError:
    raise SystemExit('Actualiza primero API_IMAGE a la imagen del catálogo: la API activa aún no contiene sus archivos.')
if deployed != expected:
    raise SystemExit('El catálogo de la API activa no coincide con el local. Despliega primero la imagen actualizada.')

config = json.loads(docker('inspect', 'jaguar-industries-db-1'))[0]
values = dict(item.split('=', 1) for item in config['Config']['Env'] if '=' in item)
owner = values.get('POSTGRES_USER', 'jaguar_owner')
backup = root / 'backups'
backup.mkdir(exist_ok=True)
path = backup / ('before-catalog-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.sql')
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as out:
    subprocess.run(['docker', 'exec', 'jaguar-industries-db-1', 'pg_dump', '-U', owner, '-d', 'jaguar'], stdout=out, check=True)

# La contraseña existente pasa en memoria. El servidor sigue usando su rol limitado.
docker('run', '--rm', '--pull=never', '--network', 'jaguar-industries_backend',
       '-e', 'PGHOST=db', '-e', 'PGDATABASE=jaguar', '-e', 'PGUSER=' + owner, '-e', 'PGPASSWORD',
       args.image, 'node', 'scripts/seed-catalog.mjs', env={'PGPASSWORD': values['POSTGRES_PASSWORD']})
print('Catálogo ampliado con seis familias y 55 referencias. Copia previa en backups/. Unidades y asignaciones conservadas.')
