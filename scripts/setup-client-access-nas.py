"""Copia previa y permisos para crear el primer usuario de cada cliente desde el panel."""
import argparse
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--image', default='jaguar-api:client-access-check')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]

def docker(*items, env=None):
    result = subprocess.run(['docker', *items], env={**os.environ, **(env or {})}, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('La tarea Docker falló. No se han mostrado credenciales.')
    return result.stdout

# Las credenciales existentes se mantienen en memoria y no se muestran ni guardan.
config = json.loads(docker('inspect', 'jaguar-industries-db-1'))[0]
values = dict(item.split('=', 1) for item in config['Config']['Env'] if '=' in item)
owner = values.get('POSTGRES_USER', 'jaguar_owner')
backup = root / 'backups'
backup.mkdir(exist_ok=True)
path = backup / ('before-client-access-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.sql')
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as out:
    subprocess.run(['docker', 'exec', 'jaguar-industries-db-1', 'pg_dump', '-U', owner, '-d', 'jaguar'], stdout=out, check=True)
# No reemplaza contenedores ni cambia la contraseña o los permisos de otros usuarios.
docker('run', '--rm', '--pull=never', '--network', 'jaguar-industries_backend',
       '-e', 'PGHOST=db', '-e', 'PGDATABASE=jaguar', '-e', 'PGUSER=' + owner, '-e', 'PGPASSWORD',
       args.image, 'node', 'scripts/migrate-client-access.mjs',
       env={'PGPASSWORD': values['POSTGRES_PASSWORD']})
print('Permisos de alta de clientes preparados; no se ha creado ninguna cuenta. Copia previa en backups/.')
