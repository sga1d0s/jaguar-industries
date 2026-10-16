"""Preparación explícita del login real. Ejecutar localmente en una terminal."""
import argparse, getpass, json, os, secrets, subprocess
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--image',required=True)
parser.add_argument('--email',required=True)
parser.add_argument('--name',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
def docker(*items, env=None, input=None):
    result=subprocess.run(['docker',*items],env={**os.environ,**(env or {})},input=input,text=True,capture_output=True)
    if result.returncode:
        # No imprimir errores que puedan contener SQL o contraseñas.
        raise RuntimeError('La operación Docker falló. No se han mostrado datos sensibles.')
    return result.stdout
password=getpass.getpass('Contraseña para entrar en la app (mínimo 12 caracteres): ')
if password!=getpass.getpass('Repite la contraseña: '): raise SystemExit('Las contraseñas no coinciden.')
if len(password)<12 or len(password.encode())>1024: raise SystemExit('Longitud de contraseña no válida.')
config=json.loads(docker('inspect','jaguar-industries-db-1'))[0]
values=dict(item.split('=',1) for item in config['Config']['Env'] if '=' in item)
owner=values.get('POSTGRES_USER','jaguar_owner')
owner_password=values['POSTGRES_PASSWORD']
secretfile=root/'infra'/'.env.login.local'
if secretfile.exists():
    app_password=secretfile.read_text().strip().split('=',1)[1]
else:
    app_password=secrets.token_urlsafe(36)
    fd=os.open(secretfile,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f: f.write('APP_DATABASE_PASSWORD='+app_password+'\n')
backup=root/'backups';backup.mkdir(exist_ok=True)
from datetime import datetime
backup_path=backup/('before-auth-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.sql')
backup_fd=os.open(backup_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(backup_fd,'w') as out:
    subprocess.run(['docker','exec','jaguar-industries-db-1','pg_dump','-U',owner,'-d','jaguar'],stdout=out,check=True)
common=['run','--rm','--network','jaguar-industries_backend','-e','PGHOST=db','-e','PGDATABASE=jaguar','-e','PGUSER='+owner,'-e','PGPASSWORD']
env={'PGPASSWORD':owner_password,'APP_DATABASE_PASSWORD':app_password}
docker(*common,'-e','APP_DATABASE_PASSWORD',args.image,'node','scripts/migrate.mjs',env=env)
docker(*common,'-i',args.image,'node','scripts/create-user.mjs',args.email,args.name,env=env,input=password+'\n')
print('Esquema y usuario preparados. Copia APP_DATABASE_PASSWORD desde infra/.env.login.local a las variables del stack en Portainer, sin compartirla. Después despliega la imagen con el Compose actualizado y comprueba /api/ready.')
