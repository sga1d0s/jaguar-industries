"""Prueba aislada en el contexto Docker actual. No publica puertos ni toca el stack real."""
import subprocess, secrets, time, os
# Nombres únicos y contraseñas aleatorias para aislar la prueba del stack real.
suffix=secrets.token_hex(4)
network='jaguar-auth-test-'+suffix
db=network+'-db'
api=network+'-api'
owner=secrets.token_urlsafe(32)
app=secrets.token_urlsafe(32)
def run(*args,env=None,input=None):
    return subprocess.run(['docker',*args],check=True,env={**os.environ,**(env or {})},input=input,text=True,capture_output=True).stdout
try:
    run('network','create',network)
    run('run','-d','--name',db,'--network',network,'--network-alias','db','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_PASSWORD','-e','POSTGRES_DB=jaguar','-e','POSTGRES_USER=jaguar_owner','postgres:17-bookworm',env={'POSTGRES_PASSWORD':owner})
    for _ in range(40):
        try: run('exec',db,'pg_isready','-U','jaguar_owner','-d','jaguar'); break
        except subprocess.CalledProcessError: time.sleep(1)
# Las tareas de migración usan el propietario; el servidor se prueba con el rol limitado.
    common=['--network',network,'-e','PGHOST=db','-e','PGDATABASE=jaguar']
    admin={ 'PGPASSWORD':owner, 'APP_DATABASE_PASSWORD':app }
    migration=['run','--rm',*common,'-e','PGUSER=jaguar_owner','-e','PGPASSWORD','-e','APP_DATABASE_PASSWORD','jaguar-api:login-check','node','scripts/migrate.mjs']
    run(*migration,env=admin);run(*migration,env=admin)
    run('run','--rm','-i',*common,'-e','PGUSER=jaguar_owner','-e','PGPASSWORD','jaguar-api:login-check','node','scripts/create-user.mjs','test@example.com','Test User',env=admin,input='a-long-test-password-123\n')
    run('run','-d','--name',api,*common,'-e','PGUSER=jaguar_app','-e','PGPASSWORD','--read-only','--cap-drop','ALL','jaguar-api:login-check',env={'PGPASSWORD':app})
    for _ in range(30):
        try: run('exec',api,'node','-e',"fetch('http://localhost:3000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"); break
        except subprocess.CalledProcessError: time.sleep(1)
    code="""
    const assert = (await import('node:assert/strict')).default;
    const base='http://localhost:3000/api';
    const post=(path,body,token)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
    assert.equal((await fetch(base+'/ready')).status,200);
    assert.equal((await fetch(base+'/auth/me')).status,401);
    assert.equal((await post('/auth/login',{email:'test@example.com',password:'wrong'})).status,401);
    const login=await post('/auth/login',{email:'TEST@example.com',password:'a-long-test-password-123'});
    assert.equal(login.status,200);const {token,user}=await login.json();assert.equal(user.email,'test@example.com');assert.equal(user.password_hash,undefined);
    assert.equal((await fetch(base+'/auth/me',{headers:{authorization:'Bearer '+token}})).status,200);
    assert.equal((await post('/auth/logout',{},token)).status,200);
    assert.equal((await fetch(base+'/auth/me',{headers:{authorization:'Bearer '+token}})).status,401);
    for(let i=0;i<10;i++) assert.equal((await post('/auth/login',{email:'absent@example.com',password:'wrong'})).status,401);
    assert.equal((await post('/auth/login',{email:'absent@example.com',password:'wrong'})).status,429);
    const {pool}=await import('./db.mjs');
    await assert.rejects(pool.query('UPDATE users SET active=false'));
    await assert.rejects(pool.query('DROP TABLE users'));
    await pool.end(); console.log('OK: migración repetible, login, sesión, logout, límite de intentos y rol limitado');
    """
    print(run('exec',api,'node','--input-type=module','-e',code).strip())
# Esta limpieza se ejecuta también si falla una comprobación; la base es temporal.
finally:
    for name in [api,db]:
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','network','rm',network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
