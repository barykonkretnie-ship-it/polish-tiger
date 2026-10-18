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
  const label='Test '+randomUUID(),mine=async()=>(await db.dictionary()).filter(t=>t.dimension==='mine'&&t.label===label);
  await db.addTag(ren.id,'mine',label);await db.addTag(ren.id,'mine',label);const [tag]=await mine();
  assert.ok((await db.records()).find(r=>r.id===ren.id)!.terms.some(t=>t.id===tag.id));
  await db.removeTag(ren.id,tag.id);assert.equal((await mine()).length,0);
  await db.addTag(ren.id,'mine',label);await db.deleteTag((await mine())[0].id);assert.equal((await mine()).length,0);
  const action=ren.terms.find(t=>t.dimension==='action')!;await db.removeTag(ren.id,action.id);await db.deleteTag(action.id);
  await db.addTag(ren.id,'indication',label);const own=(await db.records()).find(r=>r.id===ren.id)!.terms.find(t=>t.label===label)!;assert.equal(own.byUser,true);
  await db.updateRecord(ren.id,{...update,notes:ren.notes,termIds:[]});const after=(await db.records()).find(r=>r.id===ren.id)!;
  assert.ok(after.terms.some(t=>t.id===action.id&&!t.byUser));
  await db.setUserNote(ren.id,'Moja uwaga');assert.equal((await db.recordById(ren.id))?.user_notes,'Moja uwaga');await db.setUserNote(ren.id,'');assert.ok(!after.terms.some(t=>t.id===own.id));
assert.ok((await db.records()).find(r=>r.id===ren.id)!.terms.some(t=>t.id===action.id));
  const key='test-'+randomUUID();
  for(let i=0;i<10;i++)assert.equal(await pg.allowLoginAttempt(key),true);
  assert.equal(await pg.allowLoginAttempt(key),false);
 }finally{await pg.closeDatabase();}
});
