import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import {migrate} from '../lib/source/migrate';
import {loadConfig} from '../lib/source/config';
import {PoliteFetcher} from '../lib/source/fetcher';
import {discover,fetchAndParse,reparse,RightsNotConfirmed,type Pilot} from '../lib/source/importer';

const url=process.env.POLISH_TIGER_TEST_DATABASE_URL;
const fixture=(name:string)=>readFileSync(path.join(import.meta.dirname,'fixtures','source',name),'utf8');
const BASE='https://www.americandragon.com';
const HERB=`${BASE}/Individualherbsupdate/TestGen.html`,FORMULA=`${BASE}/Herb%20Formulas%20copy/TestTang.html`;
const pilot:Pilot={herbs:[{id:'test-gen',name:'Test Gen',url:HERB}],formulas:[{id:'test-tang',name:'Test Tang',url:FORMULA}]};
const env=(over:Record<string,string>={})=>loadConfig({IMPORT_DATABASE_URL:url||'postgres://unused',SOURCE_BASE_URL:BASE,IMPORT_MAX_PAGES:'30',IMPORT_CONCURRENCY:'1',
 IMPORT_DELAY_SECONDS:'1',IMPORT_MAX_RETRIES:'1',IMPORT_ALLOW_FULL_IMPORT:'false',IMPORT_SOURCE_RIGHTS_CONFIRMED:'true',IMPORT_RETENTION:'raw_html',
 IMPORT_USER_AGENT:'test',AI_TRANSLATION_ENABLED:'false',AI_MAX_RECORDS_PER_RUN:'0',AI_MAX_SPEND_EUR:'0',...over});

/** A fake American Dragon: index pages linking the two synthetic cards, ETag support and switchable content. */
function fakeSite(){
 const site={pages:new Map<string,{body:string;etag:string}|number>(),requests:[] as string[]};
 site.pages.set(`${BASE}/IndividualHerbsIndex2.html`,{body:'<a href="Individualherbsupdate/TestGen.html">Test Gen</a><a href="index.htm">Home</a>',etag:'"i1"'});
 site.pages.set(`${BASE}/HerbFormulaIndexA-G.html`,{body:'<a href="../Herb Formulas copy/TestTang.html">Test Tang</a><a href="/Herb%20Formulas%20copy/TestTang.html">Test Tang</a>',etag:'"i2"'});
 for(const p of ['H-N','O-T','U-Z'])site.pages.set(`${BASE}/HerbFormulaIndex${p}.html`,{body:'<p>empty</p>',etag:`"${p}"`});
 site.pages.set(HERB,{body:fixture('herb.html'),etag:'"h1"'});site.pages.set(FORMULA,{body:fixture('formula.html'),etag:'"f1"'});
 const fetcher=new PoliteFetcher({delaySeconds:1,maxRetries:1,userAgent:'test',sleep:async()=>{},fetch:async(u,init)=>{
  site.requests.push(u);const page=site.pages.get(u);
  if(page===undefined)return new Response('missing',{status:404});
  if(typeof page==='number')return new Response('x',{status:page});
  if(init.headers['If-None-Match']===page.etag)return new Response(null,{status:304,headers:{etag:page.etag}});
  return new Response(page.body,{status:200,headers:{etag:page.etag,'content-type':'text/html'}});
 }});
 return {site,fetcher};
}

test('Warstwa źródłowa: blokada praw, odkrywanie, idempotentny import, rewizje, ponowne parsowanie, błędy',{skip:!url},async()=>{
 const sql=postgres(url!,{max:1,onnotice:()=>{}});
 try{
  await sql`DROP SCHEMA IF EXISTS polish_tiger_source CASCADE`;
  assert.deepEqual(await migrate(sql),['001_source_layer.sql']);
  assert.deepEqual(await migrate(sql),[],'migracje są stosowane raz');
  const count=async(t:string)=>(await sql`SELECT count(*)::int AS n FROM ${sql('polish_tiger_source')}.${sql(t)}`)[0].n as number;
  const {site,fetcher}=fakeSite();

  await assert.rejects(discover(sql,env({IMPORT_SOURCE_RIGHTS_CONFIRMED:'false'}),fetcher),RightsNotConfirmed);
  await assert.rejects(fetchAndParse(sql,env({IMPORT_SOURCE_RIGHTS_CONFIRMED:'false'}),fetcher,'pilot',pilot),RightsNotConfirmed);
  assert.equal(site.requests.length,0,'bez potwierdzenia praw nie wysłano żadnego żądania');assert.equal(await count('import_runs'),0);

  const d1=await discover(sql,env(),fetcher);
  assert.equal(d1.report.counters.new,2);assert.equal(d1.report.counters.duplicate,1);assert.equal(await count('source_pages'),7);
  const d2=await discover(sql,env(),fetcher);assert.equal(d2.report.counters.known,2);assert.equal(d2.report.counters.new??0,0);assert.equal(await count('source_pages'),7);

  await assert.rejects(fetchAndParse(sql,env({IMPORT_MAX_PAGES:'1'}),fetcher,'pilot',pilot),/IMPORT_MAX_PAGES/);
  await assert.rejects(fetchAndParse(sql,env(),fetcher,'all',pilot),/IMPORT_ALLOW_FULL_IMPORT/);

  const f1=await fetchAndParse(sql,env(),fetcher,'pilot',pilot);
  assert.equal(f1.report.records.herbs,1);assert.equal(f1.report.records.formulas,1);assert.equal(f1.report.counters.fetched,2);
  const ing=await sql`SELECT position,pinyin_raw,dosage_raw,amount_min,herb_id FROM polish_tiger_source.formula_ingredients ORDER BY position`;
  assert.deepEqual(ing.map(i=>[i.position,i.pinyin_raw,i.herb_id]),[[1,'Test Gen','test-gen'],[2,'Li Zi',null],[3,'(Ke Xuan)',null],[4,'Wei Zhi',null]]);
  assert.equal(Number(ing[1].amount_min),22.5);assert.equal(f1.report.unlinkedIngredients,3);
  const [ev]=await sql`SELECT value,source_excerpt,source_url,completeness,value_status FROM polish_tiger_source.field_evidence WHERE record_id='test-gen' AND field='taste'`;
  assert.deepEqual(ev.value,['Sweet','(Bitter)']);assert.equal(ev.source_url,HERB);assert.equal(ev.value_status,'source');assert.ok(ev.source_excerpt.includes('Sweet'));
  const [tox]=await sql`SELECT t.axis FROM polish_tiger_source.herb_tags h JOIN polish_tiger_source.taxonomy_terms t ON t.id=h.term_id WHERE t.label='Slightly Toxic'`;
  assert.equal(tox.axis,'toxicity');
  const reviewAfterFirst=await count('review_queue');assert.ok(reviewAfterFirst>0);
  const tables=['source_page_revisions','field_evidence','formula_ingredients','herb_tags','formula_tags','formula_modifications','taxonomy_terms'];
  const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,await count(t)])));
  const before=await snapshot();

  const f2=await fetchAndParse(sql,env(),fetcher,'pilot',pilot);
  assert.equal(f2.report.outcomes.not_modified,2,'drugie uruchomienie używa ETag');
  assert.deepEqual(await snapshot(),before,'ponowne uruchomienie nie tworzy duplikatów');assert.equal(await count('review_queue'),reviewAfterFirst);

  // The source changes: a new revision is stored and the old one stays.
  site.pages.set(FORMULA,{body:fixture('formula.html').replace('<td>9g</td>','<td>12g</td>'),etag:'"f2"'});
  const f3=await fetchAndParse(sql,env(),fetcher,'pilot',pilot);
  assert.equal(f3.report.outcomes.parsed??0,0);assert.ok((f3.report.outcomes.incomplete??0)>=1);assert.equal(f3.report.outcomes.not_modified,1);
  assert.equal((await sql`SELECT count(*)::int AS n FROM polish_tiger_source.source_page_revisions r JOIN polish_tiger_source.source_pages p ON p.id=r.source_page_id WHERE p.canonical_url=${FORMULA}`)[0].n,2);
  assert.equal((await sql`SELECT count(*)::int AS n FROM polish_tiger_source.field_evidence WHERE record_id='test-tang' AND field='ingredients'`)[0].n,2,'dowody obu rewizji zostają');
  assert.equal((await sql`SELECT dosage_raw FROM polish_tiger_source.formula_ingredients WHERE formula_id='test-tang' AND position=1`)[0].dosage_raw,'12g');

  const p1=await reparse(sql,env(),true);assert.equal((p1.report.counters.parsed??0)+(p1.report.counters.incomplete??0),2,'ponowne parsowanie z zachowanej treści');
  assert.equal(site.requests.filter(u=>u===HERB).length,3,'ponowne parsowanie nie pobiera stron');

  // A gone page is marked, never deleted.
  site.pages.delete(HERB);await sql`UPDATE polish_tiger_source.herbs SET parser_version='0'`;
  const f4=await fetchAndParse(sql,env(),fetcher,'pilot',pilot);
  assert.equal(f4.report.outcomes.error,1);assert.equal((await sql`SELECT status FROM polish_tiger_source.source_pages WHERE canonical_url=${HERB}`)[0].status,'gone');
  assert.equal(await count('herbs'),1);
 }finally{await sql`DROP SCHEMA IF EXISTS polish_tiger_source CASCADE`;await sql.end();}
});

test('Polityka excerpts_only: brak surowego HTML, a ponowne parsowanie to raportuje',{skip:!url},async()=>{
 const sql=postgres(url!,{max:1,onnotice:()=>{}});
 try{
  await sql`DROP SCHEMA IF EXISTS polish_tiger_source CASCADE`;await migrate(sql);
  const {fetcher}=fakeSite();const config=env({IMPORT_RETENTION:'excerpts_only'});
  await discover(sql,config,fetcher);await fetchAndParse(sql,config,fetcher,'pilot',pilot);
  assert.equal((await sql`SELECT count(*)::int AS n FROM polish_tiger_source.source_page_revisions WHERE raw_html IS NOT NULL`)[0].n,0);
  const r=await reparse(sql,config,true);assert.equal(r.report.counters.no_raw_html,2);
 }finally{await sql`DROP SCHEMA IF EXISTS polish_tiger_source CASCADE`;await sql.end();}
});

test('Połączenie z bazą przez tunel HTTP CONNECT (sieć tylko przez proxy)',{skip:!url},async()=>{
 const {tunnel}=await import('../lib/source/db');
 const http=await import('node:http'),net=await import('node:net');
 const target=new URL(url!);const seen:string[]=[];
 const proxy=http.createServer().on('connect',(req,client,head)=>{
  seen.push(req.url!);
  if(req.url!.endsWith(':9')){client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
  const upstream=net.connect(Number(target.port)||5432,target.hostname,()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');upstream.write(head);upstream.pipe(client);client.pipe(upstream);});
  upstream.on('error',()=>client.destroy());
 });
 await new Promise<void>(r=>proxy.listen(0,'127.0.0.1',()=>r()));
 const proxyUrl=`http://127.0.0.1:${(proxy.address() as {port:number}).port}`;
 const sql=postgres(url!,{max:1,onnotice:()=>{},socket:()=>tunnel(proxyUrl,target.hostname,Number(target.port)||5432)});
 try{
  assert.equal((await sql`SELECT 41+1 AS n`)[0].n,42);
  assert.deepEqual(seen,[`${target.hostname}:${Number(target.port)||5432}`]);
  await assert.rejects(tunnel(proxyUrl,'db.example',9),/HTTP 403/);
 }finally{await sql.end();proxy.close();}
});
