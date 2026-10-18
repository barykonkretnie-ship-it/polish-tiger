import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
process.env.POLISH_TIGER_DATA_DIR=mkdtempSync(path.join(tmpdir(),'polish-tiger-tags-'));
const {records,dictionary,addTag,removeTag,deleteTag,updateRecord}=await import('../lib/db-sqlite');
const {matches}=await import('../lib/search');
const mine=()=>dictionary().filter(t=>t.dimension==='mine');
test('Własne znaczniki: dodawanie, wyszukiwanie, filtr i usuwanie',()=>{
 addTag('ren-shen','mine','Do zamówienia');addTag('si-jun-zi-tang','mine','Do zamówienia');addTag('ren-shen','mine','Do zamówienia');
 const [tag]=mine();assert.equal(mine().length,1);
 const r=records().find(r=>r.id==='ren-shen')!;assert.equal(r.terms.filter(t=>t.dimension==='mine').length,1);
 assert.ok(matches(r,'zamowienia',{},'AND'));assert.ok(matches(r,'',{mine:[String(tag.id)]},'AND'));
 assert.equal(matches(records().find(r=>r.id==='bai-zhu')!,'',{mine:[String(tag.id)]},'AND'),false);
 removeTag('ren-shen',tag.id);assert.equal(mine().length,1,'znacznik zostaje, dopóki ma inne karty');
 removeTag('si-jun-zi-tang',tag.id);assert.equal(mine().length,0,'osierocony znacznik znika');
 addTag('ren-shen','mine','Ulubione');deleteTag(mine()[0].id);assert.equal(mine().length,0);assert.ok(!records().find(r=>r.id==='ren-shen')!.terms.some(t=>t.dimension==='mine'));
});
test('Usuwanie znacznika nie dotyka zwykłych terminów',()=>{
 const action=records().find(r=>r.id==='ren-shen')!.terms.find(t=>t.dimension==='action')!;
 removeTag('ren-shen',action.id);deleteTag(action.id);
 assert.ok(records().find(r=>r.id==='ren-shen')!.terms.some(t=>t.id===action.id));
});
test('Znacznik dla nieistniejącego rekordu jest odrzucany',()=>{assert.throws(()=>addTag('nie-ma','mine','X'));assert.equal(mine().length,0);});
test('Własne wpisy w dowolnym wymiarze są oznaczone i usuwalne; importowane nie',()=>{
 addTag('si-jun-zi-tang','indication','bezsenność');
 const f=()=>records().find(r=>r.id==='si-jun-zi-tang')!,own=f().terms.find(t=>t.dimension==='indication'&&t.label==='bezsenność')!;
 assert.equal(own.byUser,true);assert.ok(matches(f(),'bezsennosc',{},'AND'));assert.ok(matches(f(),'',{indication:[String(own.id)]},'AND'));
 const imported=f().terms.find(t=>!t.byUser)!;assert.equal(imported.byUser,false);
 removeTag('si-jun-zi-tang',imported.id);assert.ok(f().terms.some(t=>t.id===imported.id),'import zostaje');
 updateRecord('si-jun-zi-tang',{name:f().name,translation:f().translation,notes:f().notes,termIds:[]});
 assert.ok(f().terms.some(t=>t.id===imported.id),'edycja nie usuwa importu');assert.ok(!f().terms.some(t=>t.id===own.id),'edycja może usunąć mój wpis');
 addTag('si-jun-zi-tang','indication','bezsenność');removeTag('si-jun-zi-tang',own.id);assert.ok(!f().terms.some(t=>t.id===own.id));
 assert.ok(dictionary().some(t=>t.id===own.id),'termin spoza "mine" zostaje w słowniku');
});
