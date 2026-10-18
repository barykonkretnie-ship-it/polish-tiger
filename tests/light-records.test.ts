import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import {migrate} from '../lib/source/migrate';
import {loadConfig} from '../lib/source/config';
import {PoliteFetcher} from '../lib/source/fetcher';
import {discover,fetchAndParse} from '../lib/source/importer';

// Own database: the other Postgres tests drop and recreate the shared schemas while running.
const base=process.env.POLISH_TIGER_TEST_DATABASE_URL,url=base?.replace(/\/[^/]*$/,'/pt_test_light');
const BASE='https://www.americandragon.com',HERB=`${BASE}/Individualherbsupdate/TestGen.html`,FORMULA=`${BASE}/Herb%20Formulas%20copy/TestTang.html`;
const fixture=(name:string)=>readFileSync(path.join(import.meta.dirname,'fixtures','source',name),'utf8');

test('Lista dostaje lekkie rekordy (tylko temperatura), karta pełne dane źródłowe',{skip:!base},async()=>{
 const admin=postgres(base!,{max:1,onnotice:()=>{}});
 await admin.unsafe('DROP DATABASE IF EXISTS pt_test_light');await admin.unsafe('CREATE DATABASE pt_test_light');await admin.end();
 process.env.POLISH_TIGER_DATABASE_URL=url;process.env.POLISH_TIGER_DATABASE_SSL='local-test';
 const pg=await import('../lib/db-postgres'),db=await import('../lib/db');
 const sql=postgres(url!,{max:1,onnotice:()=>{},prepare:false});
 try{
  await pg.initializePostgres();await migrate(sql);
  const pages=new Map([[`${BASE}/IndividualHerbsIndex2.html`,'<a href="Individualherbsupdate/TestGen.html">x</a>'],[`${BASE}/HerbFormulaIndexA-G.html`,'<a href="../Herb Formulas copy/TestTang.html">x</a>'],
   ...['H-N','O-T','U-Z'].map(p=>[`${BASE}/HerbFormulaIndex${p}.html`,'<p></p>'] as [string,string]),[HERB,fixture('herb.html')],[FORMULA,fixture('formula.html')]]);
  const fetcher=new PoliteFetcher({delaySeconds:1,maxRetries:1,userAgent:'test',sleep:async()=>{},fetch:async u=>pages.has(u)?new Response(pages.get(u),{status:200}):new Response('missing',{status:404})});
  const env=loadConfig({IMPORT_DATABASE_URL:url!,SOURCE_BASE_URL:BASE,IMPORT_MAX_PAGES:'30',IMPORT_CONCURRENCY:'1',IMPORT_DELAY_SECONDS:'1',IMPORT_MAX_RETRIES:'1',IMPORT_ALLOW_FULL_IMPORT:'false',
   IMPORT_SOURCE_RIGHTS_CONFIRMED:'true',IMPORT_RETENTION:'raw_html',IMPORT_USER_AGENT:'test',AI_TRANSLATION_ENABLED:'false',AI_MAX_RECORDS_PER_RUN:'0',AI_MAX_SPEND_EUR:'0'});
  // The sample's ren-shen and si-jun-zi-tang stand in for the two synthetic source cards.
  await discover(sql,env,fetcher);await fetchAndParse(sql,env,fetcher,'pilot',{herbs:[{id:'ren-shen',name:'Ren Shen',url:HERB}],formulas:[{id:'si-jun-zi-tang',name:'Si Jun Zi Tang',url:FORMULA}]});
  const {storeTranslations}=await import('../lib/source/translations');
  await storeTranslations(sql,{glossaryVersion:'g',model:'t',promptVersion:'p',records:[{id:'ren-shen',kind:'herb',fields:{taste:['słodki','(gorzki)'],temperature:['ciepłe','lekko toksyczne']}}]});
  const light=(await db.records({light:true})).find(r=>r.id==='ren-shen')!;
  assert.equal(light.source?.partial,true);assert.deepEqual(light.source?.pl,{temperature:['ciepłe','lekko toksyczne']});
  assert.deepEqual(Object.keys(light.source!.fields),['temperature']);
  const full=(await db.recordById('ren-shen'))!;
  assert.equal(full.source?.partial,undefined);assert.deepEqual(full.source?.pl?.taste,['słodki','(gorzki)']);assert.ok(Object.keys(full.source!.fields).length>1);
  assert.ok((await db.recordById('si-jun-zi-tang'))!.source!.ingredients.length>0);
  assert.equal(full.terms.length,(await db.records()).find(r=>r.id==='ren-shen')!.terms.length);
  assert.ok(full.related.length>0,'powiązania zwrotne działają przy filtrze id');
 }finally{await sql.end();await pg.closeDatabase();}
});
