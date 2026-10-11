import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTerms} from '../lib/term-order';

const sorted=(dimension:string,labels:string[])=>labels.map(label=>({dimension,label})).sort(compareTerms).map(t=>t.label);

test('Termika: od zimnych przez neutralne do ciepłych',()=>{
 assert.deepEqual(sorted('thermal',['ciepłe','neutralne','zimne','chłodne','lekko ciepłe','lekko zimne']),['zimne','lekko zimne','chłodne','neutralne','lekko ciepłe','ciepłe']);
});

test('Kanały: N Pm W Wż S O Jc Śl Ż P Jg, potem pozostałe',()=>{
 assert.deepEqual(sorted('channel',['Płuca','Potrójny Ogrzewacz','Śledziona','Serce','Nerki','Jelito grube','Wątroba','Pęcherzyk żółciowy','Pęcherz moczowy','Osierdzie','Żołądek','Jelito cienkie']),
  ['Nerki','Pęcherz moczowy','Wątroba','Pęcherzyk żółciowy','Serce','Osierdzie','Jelito cienkie','Śledziona','Żołądek','Płuca','Jelito grube','Potrójny Ogrzewacz']);
});
