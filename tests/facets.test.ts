import test from 'node:test';
import assert from 'node:assert/strict';
import {FACETS,facetValues} from '../lib/facets';
import {matches} from '../lib/search';
const f=(id:string)=>FACETS.find(x=>x.id===id)!;
test('Termika, smak i kanały mają ujednolicone wartości',()=>{
 assert.deepEqual(f('thermal5').classify('lekko zimne'),['cool']);assert.deepEqual(f('thermal5').classify('bardzo zimne'),['cold']);
 assert.deepEqual(f('thermal5').classify('lekko ciepłe'),['warm']);assert.deepEqual(f('thermal5').classify('lub'),[]);
 assert.deepEqual(f('taste5').classify('lekko gorzki'),['bitter']);assert.deepEqual(f('chan').classify('Brak informacji'),[]);
 assert.deepEqual(f('chan').classify('Niedobór Yang Nerek'),['kidney']);
 assert.deepEqual(f('toxic').classify('lekko toksyczne'),['slight']);assert.deepEqual(f('toxic').classify('nietoksyczne'),[]);
});
test('Wzorce rozkładają się na grupy według zdania',()=>{
 const p=(l:string)=>f('pgroup').classify(l).sort();
 assert.deepEqual(p('Zastój Qi Wątroby'),['qi-stag']);
 assert.deepEqual(p('Zastój Qi i Krwi z Niedoborem Yin'),['blood-stag','qi-stag','yin-def']);
 assert.deepEqual(p('Toksyczna Wilgoć-Gorąco'),['damp','damp-heat','heat','toxic-heat']);
 assert.deepEqual(p('Niedobór Śledziony'),['qi-def']);
 assert.ok(p('Wewnętrzny Wiatr z powodu Niedoboru Yin Nerek i Wątroby').includes('wind-int'));
});
test('Wskazania trafiają do obszarów, a rekord do grup',()=>{
 const i=(l:string)=>f('igroup').classify(l);
 assert.deepEqual(i('Zapalenie nerek'),['urinary']);assert.ok(i('Rak płuca').includes('onco'));assert.deepEqual(i('Ból w nadbrzuszu'),['digest']);
 const facets=facetValues('formula',[{dimension:'pattern',label:'Zastój Qi Wątroby'},{dimension:'indication',label:'Bezsenność'}]);
 assert.deepEqual(facets.pgroup,['qi-stag']);assert.deepEqual(facets.chan,['liver']);assert.deepEqual(facets.igroup,['psych']);
 const r={id:'x',kind:'formula',name:'X',latin:'',translation:'',status:'',verified_at:null,notes:'',terms:[{id:1,dimension:'pattern',label:'Zastój Qi Wątroby',synonyms:''}],ingredients:[],related:[],sources:[],facets} as never;
 assert.ok(matches(r,'stagnacja qi',{},'AND'));assert.ok(matches(r,'',{pgroup:['qi-stag'],chan:['liver']},'AND'));assert.equal(matches(r,'',{pgroup:['qi-stag','heat']},'AND'),false);
});
