"""Prueba aislada en el contexto Docker actual. No publica puertos ni toca el stack real."""
import subprocess, secrets, time, os
image=os.environ.get('JAGUAR_TEST_IMAGE','jaguar-api:login-check')
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
    migration=['run','--rm',*common,'-e','PGUSER=jaguar_owner','-e','PGPASSWORD','-e','APP_DATABASE_PASSWORD',image,'node','scripts/migrate.mjs']
    run(*migration,env=admin);run(*migration,env=admin)
    equipment_migration=migration[:-1]+['scripts/migrate-equipment.mjs']
    run(*equipment_migration,env=admin);run(*equipment_migration,env=admin)
    run('run','--rm','-i',*common,'-e','PGUSER=jaguar_owner','-e','PGPASSWORD',image,'node','scripts/create-user.mjs','test@example.com','Test User',env=admin,input='a-long-test-password-123\n')
    # Dos clientes con documentación compartida, pero unidades y asignaciones diferentes.
    run('run','--rm','-i',*common,'-e','PGUSER=jaguar_owner','-e','PGPASSWORD',image,'node','scripts/create-user.mjs','other@example.com','Other User',env=admin,input='a-long-test-password-123\n')
    for email in ['test@example.com','other@example.com']:
        seed=['run','--rm',*common,'-e','PGUSER=jaguar_owner','-e','PGPASSWORD',image,'node','scripts/seed-equipment.mjs',email]
        run(*seed,env=admin);run(*seed,env=admin)
    run('run','-d','--name',api,*common,'-e','PGUSER=jaguar_app','-e','PGPASSWORD','--read-only','--cap-drop','ALL',image,env={'PGPASSWORD':app})
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
    // Se comprueba aislamiento de lista, ficha y descargas, incluso manipulando IDs.
    const get=(path,t=token)=>fetch(base+path,{headers:{authorization:'Bearer '+t}});
    assert.equal((await fetch(base+'/equipment')).status,401);
    assert.equal((await get('/equipment?cursor=invalid')).status,400);
    assert.equal((await fetch(base+'/equipment/summary')).status,401);
    const summary=await (await get('/equipment/summary')).json();
    assert.deepEqual(summary,{total:2,sales:1,rentals:1,demos:2});
    const listing=await (await get('/equipment')).json();assert.equal(listing.items.length,2);
    assert.equal(listing.nextCursor,null);assert.equal(listing.items.every(e=>e.isDemo),true);
    const detail=await (await get('/equipment/'+listing.items[0].id)).json();
    assert.equal(detail.documents.length,3);assert.equal(detail.equipment.nfcLinked,false);
    for(const doc of detail.documents){
      const pdf=await get('/equipment/'+listing.items[0].id+'/documents/'+doc.id);
      assert.equal(pdf.status,200);assert.equal(pdf.headers.get('cache-control'),'no-store');
      assert.equal(pdf.headers.get('content-type'),'application/pdf');
      assert.equal(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0,5)),'%PDF-');
    }
    const second=await (await post('/auth/login',{email:'other@example.com',password:'a-long-test-password-123'})).json();
    const otherListing=await (await get('/equipment',second.token)).json();assert.equal(otherListing.items.length,2);
    const foreign=otherListing.items[0].id;
    assert.equal(listing.items.some(e=>e.id===foreign),false);
    assert.equal((await get('/equipment/'+foreign)).status,404);
    const otherDetail=await (await get('/equipment/'+foreign,second.token)).json();
    assert.equal((await get('/equipment/'+foreign+'/documents/'+otherDetail.documents[0].id)).status,404);
    assert.equal((await fetch(base+'/equipment/'+listing.items[0].id+'/documents/'+detail.documents[0].id)).status,401);
    assert.equal((await get('/equipment/../../product-documents/serie-630/manual.pdf')).status,404);
    assert.equal((await get('/equipment/00000000-0000-0000-0000-000000000000')).status,404);
    assert.equal((await post('/auth/logout',{},token)).status,200);
    assert.equal((await fetch(base+'/auth/me',{headers:{authorization:'Bearer '+token}})).status,401);
    assert.equal((await get('/equipment')).status,401);
    for(let i=0;i<10;i++) assert.equal((await post('/auth/login',{email:'absent@example.com',password:'wrong'})).status,401);
    assert.equal((await post('/auth/login',{email:'absent@example.com',password:'wrong'})).status,429);
    const {pool}=await import('./db.mjs');
    await assert.rejects(pool.query('UPDATE users SET active=false'));
    await assert.rejects(pool.query('DROP TABLE users'));
    await pool.end(); console.log('OK: migración repetible, login, sesión, logout, límite de intentos y rol limitado');
    """
    print(run('exec',api,'node','--input-type=module','-e',code).strip())
    # Al retirar la asignación debe desaparecer el acceso incluso con un token válido.
    revoke="DELETE FROM memberships WHERE user_id=(SELECT id FROM users WHERE email='other@example.com')"
    run('exec',db,'psql','-U','jaguar_owner','-d','jaguar','-c',revoke)
    revoked="""
    const assert=(await import('node:assert/strict')).default;
    const r=await fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'other@example.com',password:'a-long-test-password-123'})});
    const {token}=await r.json();
    const list=await fetch('http://localhost:3000/api/equipment',{headers:{authorization:'Bearer '+token}});
    assert.equal(list.status,200);assert.equal((await list.json()).items.length,0);
    const summary=await fetch('http://localhost:3000/api/equipment/summary',{headers:{authorization:'Bearer '+token}});
    assert.deepEqual(await summary.json(),{total:0,sales:0,rentals:0,demos:0});
    console.log('OK: equipos y PDF aislados por cliente; revocación de membresía inmediata');
    """
    print(run('exec',api,'node','--input-type=module','-e',revoked).strip())
# Esta limpieza se ejecuta también si falla una comprobación; la base es temporal.
finally:
    for name in [api,db]:
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','network','rm',network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
