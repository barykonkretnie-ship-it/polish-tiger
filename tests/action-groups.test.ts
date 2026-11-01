import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionGroups,actionGroupLabel,ACTION_GROUPS} from '../lib/action-groups';
import {matches} from '../lib/search';
import type {RecordData} from '../lib/types';

test('Warianty tego samego działania trafiają do jednej grupy',()=>{
 for(const a of ['Porusza Krew','Rozbija Zastój Krwi','Pobudza krążenie Krwi','Rozprasza Zastój Krwi','Uaktywnia Krew'.replace('Uaktywnia','Aktywizuje')])assert.ok(actionGroups(a).includes('blood-move'),a);
 for(const a of ['Oczyszcza Gorąco','Odprowadza Ogień','Oczyszcza Gorąco Płuc'])assert.ok(actionGroups(a).includes('heat'),a);
 for(const a of ['Transformuje Flegmę','Wydala Flegmę','Usuwa Flegmę'])assert.deepEqual(actionGroups(a),['phlegm'],a);
 assert.deepEqual(actionGroups('Hamuje wzrost komórek nowotworowych'),['masses']);
 assert.deepEqual(actionGroups('Uspokaja Shen'),['shen']);
});
test('Działanie złożone należy do każdej nazwanej grupy',()=>{
 const g=actionGroups('Tonizuje Qi i Krew');assert.ok(g.includes('qi-tonify')&&g.includes('blood-tonify'));
 const w=actionGroups('Oczyszcza Wilgoć-Gorąco');assert.ok(w.includes('heat')&&w.includes('damp'));
});
test('„Pobudza” nie trafia do otworów zmysłów, nieznane działanie do „Inne”',()=>{
 assert.ok(!actionGroups('Pobudza Krew').includes('orifices'));
 assert.deepEqual(actionGroups('Wspiera transport'),['other']);
 assert.equal(actionGroupLabel('other'),'Inne');assert.equal(new Set(ACTION_GROUPS.map(g=>g.id)).size,ACTION_GROUPS.length);
});
test('Filtr grupy działań w wyszukiwaniu',()=>{
 const r={id:'x',kind:'formula',name:'X',latin:'',translation:'',status:'',verified_at:null,notes:'',terms:[],ingredients:[],related:[],sources:[],actionGroups:['heat','toxins'],facets:{agroup:['heat','toxins']}} as RecordData;
 assert.ok(matches(r,'',{agroup:['toxins']},'AND'));assert.equal(matches(r,'',{agroup:['yin']},'AND'),false);
});
