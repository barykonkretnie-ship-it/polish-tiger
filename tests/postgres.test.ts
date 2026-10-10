import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
test('PostgreSQL: relacje, zapis, rollback i powtarzalny seed',{skip:!process.env.POLISH_TIGER_TEST_DATABASE_URL},async()=>{
 process.env.POLISH_TIGER_DATABASE_URL=process.env.POLISH_TIGER_TEST_DATABASE_URL;
 process.env.POLISH_TIGER_DATABASE_SSL='local-test';
 const pg=await import('../lib/db-postgres');
 const db=await import('../lib/db');
 try{
  await pg.initializePostgres();
  const all=await db.records();
  assert.equal(all.filter(r=>r.kind==='herb').length,20);assert.equal(all.filter(r=>r.kind==='formula').length,10);
  for(const formula of all.filter(r=>r.kind==='formula'))for(const ingredient of formula.ingredients)assert.ok(all.find(r=>r.id===ingredient.id)?.related.some(r=>r.id===formula.id));
  const ren=all.find(r=>r.id==='ren-shen')!,update={name:ren.name,translation:ren.translation,notes:'Trwała edycja PostgreSQL',termIds:ren.terms.map(t=>t.id)};
  await db.updateRecord(ren.id,update);await pg.initializePostgres();await pg.closeDatabase();
  assert.equal((await db.records()).find(r=>r.id===ren.id)?.notes,update.notes);
  await assert.rejects(db.updateRecord(ren.id,{...update,name:'Nie zapisać',termIds:[-1]}));assert.equal((await db.records()).find(r=>r.id===ren.id)?.name,ren.name);
  await db.updateRecord(ren.id,{...update,notes:ren.notes});
  assert.ok((await db.dictionary()).length>0);
  const key='test-'+randomUUID();
  for(let i=0;i<10;i++)assert.equal(await pg.allowLoginAttempt(key),true);
  assert.equal(await pg.allowLoginAttempt(key),false);
 }finally{await pg.closeDatabase();}
});
