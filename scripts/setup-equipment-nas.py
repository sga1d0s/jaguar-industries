"""Migración aditiva y unidades DEMO en Jaguar. No cambia el contenedor de la API."""
import argparse, json, os, subprocess
from datetime import datetime
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--image',default='jaguar-api:equipment-check')
parser.add_argument('--email',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
def docker(*items,env=None):
    result=subprocess.run(['docker',*items],env={**os.environ,**(env or {})},text=True,capture_output=True)
    if result.returncode:
        # Los errores no se vuelcan sin filtrar: podrían incluir SQL o configuración sensible.
        raise RuntimeError('La tarea Docker falló. No se han mostrado credenciales.')
    return result.stdout
# Recupera la conexión existente en memoria; ninguna credencial se imprime ni se escribe.
config=json.loads(docker('inspect','jaguar-industries-db-1'))[0]
values=dict(item.split('=',1) for item in config['Config']['Env'] if '=' in item)
owner=values.get('POSTGRES_USER','jaguar_owner')
backup=root/'backups';backup.mkdir(exist_ok=True)
path=backup/('before-equipment-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.sql')
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as out:
    subprocess.run(['docker','exec','jaguar-industries-db-1','pg_dump','-U',owner,'-d','jaguar'],stdout=out,check=True)
# Cambia únicamente el esquema de equipos y asigna dos unidades ficticias al cliente demo.
common=['run','--rm','--pull=never','--network','jaguar-industries_backend','-e','PGHOST=db',
        '-e','PGDATABASE=jaguar','-e','PGUSER='+owner,'-e','PGPASSWORD',args.image,'node']
env={'PGPASSWORD':values['POSTGRES_PASSWORD']}
docker(*common,'scripts/migrate-equipment.mjs',env=env)
docker(*common,'scripts/seed-equipment.mjs',args.email,env=env)
print('Migración y dos unidades DEMO preparadas. Copia previa en backups/. La API actual no se ha reemplazado.')
