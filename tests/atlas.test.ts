import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
process.env.POLISH_TIGER_DATA_DIR=mkdtempSync(path.join(tmpdir(),'polish-tiger-test-'));
const {records,dictionary,updateRecord,updateTerm}=await import('../lib/db-sqlite');
const {matches,normalize}=await import('../lib/search');
test('Dokładnie 20 ziół i 10 formuł; wszystkie składniki mają karty i powiązania zwrotne',()=>{
 const all=records();assert.equal(all.filter(r=>r.kind==='herb').length,20);assert.equal(all.filter(r=>r.kind==='formula').length,10);
 for(const formula of all.filter(r=>r.kind==='formula')){assert.ok(formula.ingredients.length>0);for(const ingredient of formula.ingredients){const herb=all.find(r=>r.id===ingredient.id);assert.equal(herb?.kind,'herb');assert.ok(herb.related.some(r=>r.id===formula.id));}}
 assert.ok(all.every(r=>r.status==='demonstracyjne'&&r.verified_at===null));
});
test('Polskie znaki, nazwa łacińska i Pinyin w wyszukiwaniu',()=>{
 const all=records();assert.equal(normalize('Śledziona Łódź'),'sledziona lodz');assert.ok(matches(all.find(r=>r.id==='ren-shen')!,'panax',{},'AND'));assert.ok(matches(all.find(r=>r.id==='bai-zhu')!,'sledziona',{},'AND'));assert.ok(matches(all.find(r=>r.id==='si-jun-zi-tang')!,'si jun zi',{},'AND'));
});
test('Filtry AND/OR oraz składnik formuły są niezależne',()=>{
 const all=records(),terms=dictionary(),neutral=String(terms.find(t=>t.dimension==='thermal'&&t.label==='neutralne')!.id),qi=String(terms.find(t=>t.dimension==='action'&&t.label==='tonizuje Qi')!.id);
 const filters={thermal:[neutral],action:[qi]};assert.equal(matches(all.find(r=>r.id==='ren-shen')!,'',filters,'AND'),false);assert.equal(matches(all.find(r=>r.id==='ren-shen')!,'',filters,'OR'),true);assert.equal(matches(all.find(r=>r.id==='shan-yao')!,'',filters,'AND'),true);
 assert.ok(matches(all.find(r=>r.id==='si-jun-zi-tang')!,'',{ingredient:['ren-shen']},'AND'));assert.equal(matches(all.find(r=>r.id==='si-wu-tang')!,'',{ingredient:['ren-shen']},'AND'),false);
});
test('Edycja jest trwała, synonimy działają, błędny termin cofa całą transakcję',()=>{
 const r=records().find(r=>r.id==='ren-shen')!;updateRecord(r.id,{name:r.name,translation:'Żeń-szeń test',notes:'Notatka testowa',termIds:r.terms.map(t=>t.id)});assert.equal(records().find(x=>x.id===r.id)!.notes,'Notatka testowa');
 const term=r.terms.find(t=>t.dimension==='action')!;updateTerm(term.id,term.label,'wspiera energie');assert.ok(matches(records().find(x=>x.id===r.id)!,'energie',{},'AND'));
 assert.throws(()=>updateRecord(r.id,{name:'Nie zapisać',translation:'',notes:'',termIds:[-1]}));assert.equal(records().find(x=>x.id===r.id)!.name,r.name);
});
