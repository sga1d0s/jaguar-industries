"""Prueba aislada en el contexto Docker actual. No publica puertos ni toca el stack real."""
import subprocess, secrets, time, os
image=os.environ.get('JAGUAR_TEST_IMAGE','jaguar-api:login-check')
# Nombres únicos y contraseñas aleatorias para aislar la prueba del stack real.
suffix=secrets.token_hex(4)
network='jaguar-auth-test-'+suffix
db=network+'-db'
api=network+'-api'
web=network+'-web'
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
    panel_migration=migration[:-1]+['scripts/migrate-panel.mjs','test@example.com']
    run(*panel_migration,env=admin);run(*panel_migration,env=admin)
    run('run','-d','--name',api,'--network-alias','api',*common,'-e','PGUSER=jaguar_app','-e','PGPASSWORD','--read-only','--cap-drop','ALL',image,env={'PGPASSWORD':app})
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
    # El operador gestiona inventario, pero una cuenta de cliente no puede consultar
    # ni modificar el panel. Las carreras de asignación deben tener un solo ganador.
    panel_code="""
    const assert=(await import('node:assert/strict')).default;
    const base='http://localhost:3000/api';
    const login=async email=>(await (await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'a-long-test-password-123'})})).json()).token;
    const token=await login('test@example.com'), customer=await login('other@example.com');
    const call=(path,body,t=token)=>fetch(base+'/panel/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+t,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await fetch(base+'/panel/me')).status,401);
    for(const path of ['me','summary','clients','models','units'])assert.equal((await call(path,null,customer)).status,403);
    assert.equal((await call('clients',{name:'Forbidden'},customer)).status,403);
    const summary=await (await call('summary')).json();assert.equal(summary.units,0);assert.equal(summary.all_units,4);assert.equal(summary.clients,0);
    const models=(await (await call('models')).json()).items;
    const doc=models[0].documents[0].id;
    assert.equal((await call('documents/'+doc,null,customer)).status,403);
    const pdf=await call('documents/'+doc);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0,5)),'%PDF-');
    const create=async(path,body)=>{const response=await call(path,body);assert.equal(response.status,201,await response.clone().text());return response.json();};
    const client=await create('clients',{name:'Cliente integración'});
    const model=await create('models',{code:'TEST',name:'Modelo de prueba',category:'Pruebas',description:'Solo base temporal'});
    const variant=await create('variants',{modelId:model.id,reference:'TEST-1',name:'Variante de prueba',specifications:[{label:'Carga',value:'100 kg'}]});
    assert.equal((await call('variants',{modelId:model.id,reference:'TEST-1',name:'Duplicada',specifications:[]})).status,409);
    assert.equal((await call('clients',{name:''})).status,400);
    assert.equal((await call('units',{variantId:'invalid',serialNumber:'X'})).status,400);
    const unit=await create('units',{variantId:variant.id,serialNumber:'REAL-TEST-1'});
    const assignments=await Promise.all([call('assignments',{equipmentId:unit.id,clientId:client.id,kind:'rental'}),call('assignments',{equipmentId:unit.id,clientId:client.id,kind:'sale'})]);
    assert.deepEqual(assignments.map(r=>r.status).sort(),[201,400]);
    // Nueva unidad con alquiler completo, devolución y venta posterior.
    const second=await create('units',{variantId:variant.id,serialNumber:'REAL-TEST-2'});
    const rental=await create('assignments',{equipmentId:second.id,clientId:client.id,kind:'rental'});
    assert.equal((await call('assignments',{equipmentId:second.id,clientId:client.id,kind:'rental'})).status,400);
    const returns=await Promise.all([call('assignments/'+rental.id+'/end',{}),call('assignments/'+rental.id+'/end',{})]);
    assert.deepEqual(returns.map(r=>r.status).sort(),[201,400]);
    assert.equal((await call('assignments/'+rental.id+'/end',{})).status,400);
    const sale=await create('assignments',{equipmentId:second.id,clientId:client.id,kind:'sale'});
    assert.equal((await call('assignments/'+sale.id+'/end',{})).status,400);
    assert.equal((await call('assignments',{equipmentId:second.id,clientId:client.id,kind:'rental'})).status,400);
    const units=(await (await call('units')).json()).items;
    const sold=units.find(e=>e.id===second.id);assert.equal(sold.owner_name,'Cliente integración');assert.equal(sold.assignment_kind,'sale');assert.equal(sold.client_id,client.id);assert.equal(sold.nfc_linked,false);
    // Los nuevos clientes no se vinculan accidentalmente al usuario operador o a otro cliente.
    const mobile=(await (await fetch(base+'/equipment',{headers:{authorization:'Bearer '+customer}})).json()).items;
    assert.equal(mobile.some(e=>e.id===unit.id || e.id===second.id),false);
    const {pool}=await import('./db.mjs');
    const user=(await pool.query("SELECT id FROM users WHERE email='other@example.com'")).rows[0];
    await assert.rejects(pool.query('INSERT INTO panel_operators(user_id) VALUES($1)',[user.id]));
    await assert.rejects(pool.query('DELETE FROM panel_audit'));
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM panel_audit')).rows[0].n,9);
    await pool.end(); console.log('OK: panel aislado, altas, validación, auditoría, asignación concurrente, devolución y propiedad de venta');
    """
    print(run('exec',api,'node','--input-type=module','-e',panel_code).strip())
    # Importar dos veces no duplica referencias, unidades o documentos. Se conserva
    # una edición hecha por el propietario entre ambas cargas del catálogo oficial.
    catalog_seed=migration[:-1]+['scripts/seed-catalog.mjs']
    run(*catalog_seed,env=admin)
    run('exec',db,'psql','-U','jaguar_owner','-d','jaguar','-c',"UPDATE product_models SET name='Nombre ajustado en Jaguar' WHERE code='650'")
    run(*catalog_seed,env=admin)
    catalog_code="""
    const assert=(await import('node:assert/strict')).default;
    const base='http://localhost:3000/api';
    const login=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'test@example.com',password:'a-long-test-password-123'})});
    const {token}=await login.json();const headers={authorization:'Bearer '+token};
    const models=(await (await fetch(base+'/panel/models',{headers})).json()).items;
    assert.equal(models.length,9);assert.equal(models.reduce((n,m)=>n+m.variants.length,0),58);
    const codes=['650','500','BC','900','EM','GC'];
    for(const code of codes){
      const model=models.find(m=>m.code===code);assert.equal(model.documents.length,3);
      for(const document of model.documents){
        const pdf=await fetch(base+'/panel/documents/'+document.id,{headers});assert.equal(pdf.status,200);
        assert.equal(pdf.headers.get('content-type'),'application/pdf');
        assert.equal(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0,5)),'%PDF-');
      }
    }
    const a=models.find(m=>m.code==='630'),b=models.find(m=>m.code==='650');
    assert.equal(a.documents.find(d=>d.kind==='manual').id,b.documents.find(d=>d.kind==='manual').id);
    assert.equal(b.name,'Nombre ajustado en Jaguar');
    const summary=await (await fetch(base+'/panel/summary',{headers})).json();assert.equal(summary.all_units,6);
    const {pool}=await import('./db.mjs');assert.equal((await pool.query('SELECT count(*)::int AS n FROM product_documents')).rows[0].n,23);
    await pool.end();console.log('OK: catálogo repetible, 55 referencias, PDF íntegros, manual compartido y ediciones conservadas; sin unidades nuevas');
    """
    print(run('exec',api,'node','--input-type=module','-e',catalog_code).strip())
    if os.environ.get('JAGUAR_TEST_WEB_IMAGE'):
        run('run','-d','--name',web,'--network',network,'--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=32m,mode=1777','--cap-drop','ALL',os.environ['JAGUAR_TEST_WEB_IMAGE'])
        web_code="""
        const assert=(await import('node:assert/strict')).default;
        const base=process.argv[1];
        for(let i=0;i<30;i++){try{if((await fetch(base+'/healthz')).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
        const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/Panel de equipos/);
        assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
        const js=await fetch(base+'/app.js');assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
        const images=await fetch(base+'/product-images.js');assert.equal(images.status,200);assert.match(await images.text(),/modelo-em.png/);
        for(const image of ['serie-650','serie-500','modelo-bc','serie-900','modelo-em','modelo-gc']){
          const response=await fetch(base+'/assets/'+image+'.png');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
        }
        const health=await fetch(base+'/api/ready');assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');
        assert.equal((await fetch(base+'/api/panel/units')).status,401);
        const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'test@example.com',password:'a-long-test-password-123'})});
        assert.equal(login.status,200);const {token}=await login.json();
        const headers={authorization:'Bearer '+token};assert.equal((await fetch(base+'/api/panel/me',{headers})).status,200);
        const units=await fetch(base+'/api/equipment',{headers});assert.equal(units.status,200);assert.equal((await units.json()).items.length,2);
        console.log('OK: frontal de solo lectura, CSP, login y rutas web/móvil a través del proxy');
        """
        print(run('exec',api,'node','--input-type=module','-e',web_code,'http://'+web+':8080').strip())
    # Retirar el permiso interno invalida inmediatamente la sesión para el panel.
    run('exec',db,'psql','-U','jaguar_owner','-d','jaguar','-c','DELETE FROM panel_operators')
    revoke_panel="""
    const assert=(await import('node:assert/strict')).default;
    const r=await fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'test@example.com',password:'a-long-test-password-123'})});
    const {token}=await r.json();
    assert.equal((await fetch('http://localhost:3000/api/panel/units',{headers:{authorization:'Bearer '+token}})).status,403);
    console.log('OK: revocación del permiso interno');
    """
    print(run('exec',api,'node','--input-type=module','-e',revoke_panel).strip())
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
    for name in [web,api,db]:
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(['docker','network','rm',network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
