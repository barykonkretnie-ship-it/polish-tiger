import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {parseHerb,parseFormula,parseDosage} from '../lib/source/parser';
import {canonicalUrl,discoverLinks} from '../lib/source/urls';
import {loadConfig,ConfigError} from '../lib/source/config';
import {PoliteFetcher,retryAfterMs,decode} from '../lib/source/fetcher';
import {loadPilot} from '../lib/source/importer';

const fixture=(name:string)=>readFileSync(path.join(import.meta.dirname,'fixtures','source',name),'utf8');
const value=(p:{fields:{name:string;value:unknown;completeness:string;excerpt:string}[]},name:string)=>p.fields.find(f=>f.name===name)!;
const env={IMPORT_DATABASE_URL:'postgres://x@127.0.0.1/db',SOURCE_BASE_URL:'https://www.americandragon.com',IMPORT_MAX_PAGES:'30',IMPORT_CONCURRENCY:'1',
 IMPORT_DELAY_SECONDS:'2',IMPORT_MAX_RETRIES:'3',IMPORT_ALLOW_FULL_IMPORT:'false',IMPORT_SOURCE_RIGHTS_CONFIRMED:'false',IMPORT_RETENTION:'excerpts_only',
 IMPORT_USER_AGENT:'test',AI_TRANSLATION_ENABLED:'false',AI_MAX_RECORDS_PER_RUN:'0',AI_MAX_SPEND_EUR:'0'};

test('Parser zioła: pola, nawiasy jako drugorzędne, toksyczność osobno, nieznana sekcja do przeglądu',()=>{
 const h=parseHerb(fixture('herb.html'),'Test Gen');
 assert.equal(h.id,'test-gen');assert.equal(h.chinese,'测试');assert.equal(h.latin,'Radix Testae');
 assert.deepEqual(value(h,'english_names').value,['Test Root','Sample Root']);
 assert.equal(value(h,'category').value,'Herbs that Test the Qi');
 assert.deepEqual(value(h,'taste').value,['Sweet','(Bitter)']);
 assert.ok(h.tags.some(t=>t.axis==='taste'&&t.label==='Bitter'&&t.qualifier==='secondary'));
 assert.ok(h.tags.some(t=>t.axis==='toxicity'&&t.label==='Slightly Toxic'));
 assert.ok(!h.tags.some(t=>t.axis==='temperature'&&/Toxic/.test(t.label)));
 assert.deepEqual(value(h,'actions').value,[{action:'Tonifies the testing Qi',indications:['Fatigue during tests','Low marks']},{action:'Calms the examiner',indications:['Restlessness']}]);
 assert.deepEqual(value(h,'contraindications').value,['Not for use during holidays.']);
 assert.equal(value(h,'incompatibilities').completeness,'missing_in_source');
 assert.deepEqual(value(h,'combinations').value,[{herbs:['Rx. Testae','Test Gen','Rx. Exempli','Li Zi'],indication:'Passing exams.'},{herbs:['Rx. Testae','Test Gen'],indication:'Single-herb use.'}]);
 // Text under an unknown heading is kept (in the preceding section) and the heading goes to review, never dropped.
 assert.deepEqual(value(h,'notes').value,['This is a synthetic record for automated tests.','PREPARATION SECRETS','An unexpected section the parser must report.']);
 assert.ok(h.issues.some(i=>i.type==='unknown_section'&&i.detail.includes('PREPARATION SECRETS')));
 assert.ok(h.issues.some(i=>i.type==='ambiguous_value'&&i.field==='channels'));
 assert.ok(value(h,'taste').excerpt.includes('Sweet'));
});

test('Parser formuły: kolejność i dawki składników, braki jawne, modyfikacje z rowspan/colspan',()=>{
 const f=parseFormula(fixture('formula.html'),'Test Tang');
 assert.equal(f.id,'test-tang');assert.equal(f.english,'Test Decoction');assert.deepEqual(f.alsoKnownAs,['Exam Soup']);
 assert.deepEqual(f.ingredients.map(i=>[i.position,i.pinyin,i.amountMin,i.amountMax,i.unit,i.optional]),
  [[1,'Test Gen',9,9,'g',false],[2,'Li Zi',22.5,22.5,'g',false],[3,'(Ke Xuan)',3,6,'g',true],[4,'Wei Zhi',null,null,null,false]]);
 assert.equal(f.ingredients[3].dosage,'a handful');
 assert.ok(f.issues.some(i=>i.type==='unreadable'&&i.detail.includes('a handful')));
 assert.deepEqual(value(f,'tongue').value,['Pale']);assert.deepEqual(value(f,'manifestations').value,['Fatigue']);
 assert.equal(value(f,'contraindications').completeness,'missing_in_source');assert.equal(value(f,'notes').completeness,'missing_in_source');
 assert.ok(!f.issues.some(i=>i.type==='unknown_section'),'EXAM STRESS w TREATS to treść, nie nagłówek');
 assert.deepEqual(f.modifications.map(m=>[m.operation,m.ingredient,m.condition]),[['add','Yi Hao','For severe fatigue'],['add','Er Hao','For restlessness'],['remove','Li Zi','For severe fatigue']]);
});

test('Dawki, adresy kanoniczne i odkrywanie linków',()=>{
 assert.deepEqual(parseDosage('4-21g'),{min:4,max:21,unit:'g'});assert.deepEqual(parseDosage('(3-5g)'),{min:3,max:5,unit:'g'});
 assert.deepEqual(parseDosage('3-12 Dates'),{min:3,max:12,unit:'dates'});assert.deepEqual(parseDosage('to taste'),{min:null,max:null,unit:null});
 const base='https://www.americandragon.com/HerbFormulaIndexA-G.html';
 const a=canonicalUrl('../Herb Formulas copy/BaWuTang.html',base),b=canonicalUrl('Herb%20Formulas%20copy/BaWuTang.html#x',base),c=canonicalUrl('http://americandragon.com/Herb Formulas copy/BaWuTang.html',base);
 assert.equal(a,'https://www.americandragon.com/Herb%20Formulas%20copy/BaWuTang.html');assert.equal(b,a);assert.equal(c,a);
 const {found,skipped}=discoverLinks('<a href="Herb Formulas copy/A.html">A Tang</a><a href="index.htm">Home</a><a href="https://other.example/x">x</a>',base,'formula','Herb Formulas copy/','https://www.americandragon.com');
 assert.deepEqual(found.map(f=>[f.label,f.url]),[['A Tang','https://www.americandragon.com/Herb%20Formulas%20copy/A.html']]);assert.equal(skipped.length,2);
 assert.equal(decode(Buffer.from([0x63,0x61,0x66,0xe9])).encoding,'windows-1252');assert.equal(decode(Buffer.from('测试')).encoding,'utf-8');
});

test('Konfiguracja wymaga jawnych wartości i blokuje AI oraz równoległość',()=>{
 assert.throws(()=>loadConfig({...env,IMPORT_MAX_PAGES:undefined}),/IMPORT_MAX_PAGES/);
 assert.throws(()=>loadConfig({...env,IMPORT_CONCURRENCY:'2'}),ConfigError);
 assert.throws(()=>loadConfig({...env,AI_TRANSLATION_ENABLED:'true'}),ConfigError);
 assert.throws(()=>loadConfig({...env,AI_MAX_SPEND_EUR:'5'}),ConfigError);
 assert.throws(()=>loadConfig({...env,IMPORT_RETENTION:'everything'}),ConfigError);
 assert.equal(loadConfig(env).sourceRightsConfirmed,false);
 const pilot=loadPilot();assert.equal(pilot.herbs.length,20);assert.equal(pilot.formulas.length,10);
 assert.ok([...pilot.herbs,...pilot.formulas].every(p=>p.url.startsWith('https://www.americandragon.com/')));
});

test('Pobieranie: odstęp między żądaniami, Retry-After przy 429, żądania warunkowe',async()=>{
 const waits:number[]=[];const seen:Record<string,string>[]=[];let calls=0;
 const fetcher=new PoliteFetcher({delaySeconds:2,maxRetries:2,userAgent:'t',sleep:async ms=>{waits.push(ms);},fetch:async(_u,init)=>{
  calls++;seen.push(init.headers);
  if(calls===1)return new Response('busy',{status:429,headers:{'retry-after':'7'}});
  if(init.headers['If-None-Match']==='"v1"')return new Response(null,{status:304});
  return new Response('<html>ok</html>',{status:200,headers:{etag:'"v1"'}});
 }});
 const first=await fetcher.get('https://www.americandragon.com/a.html');
 assert.equal(first.status,200);assert.equal(first.attempts,2);assert.ok(waits.includes(7000));assert.equal(first.headers.etag,'"v1"');
 const second=await fetcher.get('https://www.americandragon.com/a.html',{etag:'"v1"'});
 assert.equal(second.status,304);assert.equal(seen.at(-1)!['If-None-Match'],'"v1"');
 assert.equal(retryAfterMs('120'),120000);
});
