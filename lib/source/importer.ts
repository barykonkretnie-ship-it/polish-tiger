// Import stages for the source layer (document sections 2, 3, 5, 9): discover -> fetch (+parse) -> parse again from
// retained HTML. Each page is written in its own transaction, so an interrupted run can simply be started again.
import type postgres from 'postgres';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import type {ImportConfig} from './config';
import {publicConfig} from './config';
import type {PoliteFetcher,FetchResult} from './fetcher';
import {parsePage,PARSER,PARSER_VERSION,type Parsed} from './parser';
import {slug} from './html';
import {INDEX_PAGES,canonicalUrl,discoverLinks} from './urls';

type Sql=postgres.Sql;type Tx=postgres.TransactionSql;
export type Scope='pilot'|'list'|'all';
export type PilotEntry={id:string;name:string;url:string};
export type Pilot={herbs:PilotEntry[];formulas:PilotEntry[]};
const S='polish_tiger_source';

// Paths resolve from the project root (npm scripts, tests and the deployed function all run there).
export function loadPilot(file=path.join(process.cwd(),'db','pilot-sample.json')):Pilot{
 const p=JSON.parse(readFileSync(file,'utf8')) as Pilot;
 if(p.herbs.length!==20||p.formulas.length!==10)throw new Error('Zakres pilota musi mieć dokładnie 20 ziół i 10 formuł.');
 return p;
}

/** A further batch approved by the project owner (db/batches/<name>.json): at most 100 herbs and 100 formulas, unique ids. */
export function loadBatch(name:string):Pilot{
 if(!/^[a-z0-9-]+$/.test(name))throw new Error('Nieprawidłowa nazwa partii.');
 const p=JSON.parse(readFileSync(path.join(process.cwd(),'db','batches',`${name}.json`),'utf8')) as Pilot;
 if(p.herbs.length>100||p.formulas.length>100)throw new Error('Partia może mieć najwyżej 100 ziół i 100 formuł.');
 const ids=[...p.herbs,...p.formulas].map(e=>e.id);
 if(new Set(ids).size!==ids.length)throw new Error('Identyfikatory w partii muszą być unikalne.');
 return p;
}

export class RightsNotConfirmed extends Error{constructor(){super('Pobieranie wstrzymane: dopuszczalność kopiowania i przechowywania treści American Dragon nie została potwierdzona (IMPORT_SOURCE_RIGHTS_CONFIRMED=false). Zobacz docs/source-audit.md.');}}

async function startRun(sql:Sql,stage:'discover'|'fetch'|'parse',scope:unknown,config:ImportConfig){
 const [run]=await sql`INSERT INTO ${sql(S)}.import_runs(stage,scope,config,parser_version) VALUES(${stage},${sql.json(scope as postgres.JSONValue)},${sql.json(publicConfig(config) as postgres.JSONValue)},${PARSER_VERSION}) RETURNING id`;
 return Number(run.id);
}
async function finishRun(sql:Sql,runId:number,status:'completed'|'failed'|'aborted',counters:Record<string,number>,error?:string){
 const report=await buildReport(sql,runId,counters);
 await sql`UPDATE ${sql(S)}.import_runs SET status=${status},finished_at=now(),counters=${sql.json(counters)},report=${sql.json(report as postgres.JSONValue)},error=${error||null} WHERE id=${runId}`;
 return report;
}
async function item(sql:Sql|Tx,runId:number,pageId:number|null,url:string,outcome:string,extra:{http?:number;attempts?:number;message?:string;ms?:number}={}){
 await sql`INSERT INTO ${sql(S)}.import_run_items(run_id,source_page_id,url,outcome,http_status,attempts,message,duration_ms) VALUES(${runId},${pageId},${url},${outcome},${extra.http??null},${extra.attempts??null},${extra.message??null},${extra.ms??null})`;
}
async function review(sql:Sql|Tx,runId:number,pageId:number|null,kind:string|null,recordId:string|null,issue:{field?:string;type:string;detail:string;excerpt?:string}){
 await sql`INSERT INTO ${sql(S)}.review_queue(run_id,source_page_id,record_kind,record_id,field,issue_type,detail,source_excerpt)
  VALUES(${runId},${pageId},${kind},${recordId},${issue.field??null},${issue.type},${issue.detail},${issue.excerpt??null})
  ON CONFLICT (coalesce(record_kind,''),coalesce(record_id,''),coalesce(field,''),issue_type,detail) WHERE status='open' DO NOTHING`;
}
const bump=(c:Record<string,number>,k:string,n=1)=>{c[k]=(c[k]||0)+n;};

/** Fetches the index pages and registers every card URL they list (document 3.1–3.2, 9.3). */
export async function discover(sql:Sql,config:ImportConfig,fetcher:PoliteFetcher){
 if(!config.sourceRightsConfirmed)throw new RightsNotConfirmed();
 if(INDEX_PAGES.length>config.maxPages)throw new Error(`Indeksów jest ${INDEX_PAGES.length}, a IMPORT_MAX_PAGES=${config.maxPages}.`);
 const runId=await startRun(sql,'discover',{indexes:INDEX_PAGES.map(i=>i.path)},config);
 const counters:Record<string,number>={};
 try{
  const seen=new Set<string>();
  for(const index of INDEX_PAGES){
   const url=canonicalUrl(index.path,config.sourceBaseUrl+'/');
   const [page]=await sql`INSERT INTO ${sql(S)}.source_pages(canonical_url,original_url,page_type,discovered_via,discovery_run_id)
    VALUES(${url},${index.path},'index','configured index',${runId}) ON CONFLICT(canonical_url) DO UPDATE SET canonical_url=EXCLUDED.canonical_url RETURNING id,etag,last_modified`;
   const started=Date.now();
   // Indexes are always read in full: a 304 would leave nothing to discover from.
   const res=await fetcher.get(url);
   if(!res.body){await failPage(sql,runId,Number(page.id),url,res,counters);continue;}
   await sql.begin(async tx=>{
    const rev=await storeRevision(tx,runId,Number(page.id),res,config);
    await tx`UPDATE ${tx(S)}.source_pages SET status='fetched',last_hash=${res.hash},etag=${res.headers.etag||null},last_modified=${res.headers['last-modified']||null},last_fetched_at=now(),last_checked_at=now(),last_error=null WHERE id=${page.id}`;
    await item(tx,runId,Number(page.id),url,'fetched',{http:res.status,attempts:res.attempts,ms:Date.now()-started,message:`rewizja ${rev}`});
    const {found,skipped}=discoverLinks(res.body!,url,index.type,index.folder,config.sourceBaseUrl);
    bump(counters,'skipped_links',skipped.length);
    const fresh=found.filter(link=>{if(seen.has(link.url)){bump(counters,'duplicate');return false;}seen.add(link.url);return true;});
    // One statement per index: thousands of links must not mean thousands of round trips.
    const inserted=fresh.length?await tx`INSERT INTO ${tx(S)}.source_pages(canonical_url,original_url,page_type,index_label,discovered_via,discovery_run_id)
     SELECT u.url,u.original,${index.type},u.label,${url},${runId} FROM unnest(${tx.array(fresh.map(l=>l.url))}::text[],${tx.array(fresh.map(l=>l.original))}::text[],${tx.array(fresh.map(l=>l.label))}::text[]) AS u(url,original,label)
     ON CONFLICT(canonical_url) DO NOTHING RETURNING id`:[];
    bump(counters,'new',inserted.length);bump(counters,'known',fresh.length-inserted.length);
   });
   bump(counters,'index_pages');
  }
  return {runId,report:await finishRun(sql,runId,'completed',counters)};
 }catch(error){return {runId,report:await finishRun(sql,runId,'failed',counters,String(error))};}
}

/** Fetches card pages in scope, one at a time, and parses each straight after a successful fetch (document 3.3–3.5, 9.4–9.6).
 * With options.batch only pages not yet parsed by the current parser are taken, at most that many, so a run can be split into short calls. */
export async function fetchAndParse(sql:Sql,config:ImportConfig,fetcher:PoliteFetcher,scope:Scope,pilot:Pilot=loadPilot(),options:{batch?:number}={}){
 if(!config.sourceRightsConfirmed)throw new RightsNotConfirmed();
 if(scope==='all'&&!config.allowFullImport)throw new Error('Pełny import wymaga IMPORT_ALLOW_FULL_IMPORT=true po osobnej akceptacji właściciela projektu.');
 const wanted=scope!=='all'?[...pilot.herbs.map(p=>({...p,kind:'herb' as const})),...pilot.formulas.map(p=>({...p,kind:'formula' as const}))]
  :(await sql`SELECT canonical_url AS url,page_type AS kind,index_label AS name FROM ${sql(S)}.source_pages WHERE page_type IN ('herb','formula') ORDER BY page_type,index_label`).map(r=>({url:r.url as string,kind:r.kind as 'herb'|'formula',name:r.name as string,id:slug(r.name as string)}));
 if(options.batch){
  const parsed=new Set((await sql`SELECT p.canonical_url FROM ${sql(S)}.source_pages p WHERE EXISTS(SELECT 1 FROM ${sql(S)}.herbs h WHERE h.source_page_id=p.id AND h.parser_version=${PARSER_VERSION}) OR EXISTS(SELECT 1 FROM ${sql(S)}.formulas f WHERE f.source_page_id=p.id AND f.parser_version=${PARSER_VERSION})`).map(r=>r.canonical_url as string));
  const pending=wanted.filter(w=>!parsed.has(w.url));
  if(pending.length>config.maxPages)throw new Error(`Zakres ma ${pending.length} stron do pobrania, a IMPORT_MAX_PAGES=${config.maxPages}. Zakres nie jest przycinany po cichu.`);
  wanted.splice(0,wanted.length,...pending.slice(0,options.batch));
 }
 if(wanted.length>config.maxPages)throw new Error(`Zakres ma ${wanted.length} stron, a IMPORT_MAX_PAGES=${config.maxPages}. Zakres nie jest przycinany po cichu.`);
 const before=await recordCounts(sql);
 const runId=await startRun(sql,'fetch',{scope,pages:wanted.length,batch:options.batch??null,before},config);
 const counters:Record<string,number>={};
 try{
  for(const entry of wanted){
   const [page]=await sql`SELECT id,etag,last_modified,last_hash FROM ${sql(S)}.source_pages WHERE canonical_url=${entry.url}`;
   if(!page){
    await item(sql,runId,null,entry.url,'skipped',{message:'Adres nie został odkryty w indeksach — uruchom najpierw discover.'});
    await review(sql,runId,null,entry.kind,entry.id,{type:'missing_field',field:'source_url',detail:`Brak adresu ${entry.url} w odkrytych stronach.`});
    bump(counters,'not_discovered');continue;
   }
   const pageId=Number(page.id),started=Date.now();
   const parsedBefore=(await sql`SELECT 1 FROM ${sql(S)}.${sql(entry.kind==='herb'?'herbs':'formulas')} WHERE source_page_id=${pageId} AND parser_version=${PARSER_VERSION}`).length>0;
   const res=await fetcher.get(entry.url,parsedBefore?{etag:page.etag,lastModified:page.last_modified}:{});
   if(res.status===304){
    await sql`UPDATE ${sql(S)}.source_pages SET last_checked_at=now() WHERE id=${pageId}`;
    await item(sql,runId,pageId,entry.url,'not_modified',{http:304,attempts:res.attempts,ms:Date.now()-started});bump(counters,'not_modified');continue;
   }
   if(!res.body){await failPage(sql,runId,pageId,entry.url,res,counters);continue;}
   if(res.hash===page.last_hash&&parsedBefore){
    await sql`UPDATE ${sql(S)}.source_pages SET last_checked_at=now(),etag=${res.headers.etag||null},last_modified=${res.headers['last-modified']||null} WHERE id=${pageId}`;
    await item(sql,runId,pageId,entry.url,'unchanged',{http:res.status,attempts:res.attempts,ms:Date.now()-started});bump(counters,'unchanged');continue;
   }
   const parsed=parsePage(entry.kind,res.body,entry.name);
   if(entry.kind==='herb'||entry.kind==='formula')parsed.id=entry.id;
   if(res.encoding!=='utf-8')parsed.issues.push({type:'unreadable',field:'encoding',detail:`Strona nie jest poprawnym UTF-8; odczytano jako ${res.encoding}. Sprawdź znaki specjalne.`});
   const outcome=await sql.begin(async tx=>{
    const revisionId=await storeRevision(tx,runId,pageId,res,config);
    const stored=await storeParsed(tx,runId,pageId,revisionId,entry.url,parsed);
    await tx`UPDATE ${tx(S)}.source_pages SET status='fetched',last_hash=${res.hash},etag=${res.headers.etag||null},last_modified=${res.headers['last-modified']||null},last_fetched_at=now(),last_checked_at=now(),last_error=null WHERE id=${pageId}`;
    await item(tx,runId,pageId,entry.url,stored,{http:res.status,attempts:res.attempts,ms:Date.now()-started,message:`${parsed.issues.length} uwag do przeglądu`});
    return stored;
   });
   bump(counters,outcome);bump(counters,'fetched');
  }
  await linkIngredients(sql);
  counters.after_herbs=(await recordCounts(sql)).herbs;counters.after_formulas=(await recordCounts(sql)).formulas;
  counters.before_herbs=before.herbs;counters.before_formulas=before.formulas;
  return {runId,report:await finishRun(sql,runId,'completed',counters)};
 }catch(error){return {runId,report:await finishRun(sql,runId,'failed',counters,String(error))};}
}

/** Re-parses retained HTML without fetching (document 5: parser changes do not require downloads). */
export async function reparse(sql:Sql,config:ImportConfig,force:boolean){
 const runId=await startRun(sql,'parse',{force},config);
 const counters:Record<string,number>={};
 try{
  const pages=await sql`SELECT p.id,p.canonical_url,p.page_type,p.index_label,r.id AS revision_id,r.raw_html,r.retention_policy,
    coalesce(h.id,f.id) AS record_id,coalesce(h.parser_version,f.parser_version) AS parser_version
   FROM ${sql(S)}.source_pages p JOIN LATERAL (SELECT * FROM ${sql(S)}.source_page_revisions r WHERE r.source_page_id=p.id ORDER BY r.fetched_at DESC,r.id DESC LIMIT 1) r ON true
   LEFT JOIN ${sql(S)}.herbs h ON h.source_page_id=p.id LEFT JOIN ${sql(S)}.formulas f ON f.source_page_id=p.id
   WHERE p.page_type IN ('herb','formula') AND coalesce(h.id,f.id) IS NOT NULL`;
  for(const p of pages){
   if(!force&&p.parser_version===PARSER_VERSION){bump(counters,'unchanged');continue;}
   if(!p.raw_html){
    await item(sql,runId,Number(p.id),p.canonical_url,'skipped',{message:'Polityka retencji excerpts_only: brak surowej treści; ponowne parsowanie wymaga pobrania strony.'});
    bump(counters,'no_raw_html');continue;
   }
   const parsed=parsePage(p.page_type,p.raw_html,p.index_label||undefined);parsed.id=p.record_id;
   const stored=await sql.begin(async tx=>{const o=await storeParsed(tx,runId,Number(p.id),Number(p.revision_id),p.canonical_url,parsed);await item(tx,runId,Number(p.id),p.canonical_url,o);return o;});
   bump(counters,stored);
  }
  await linkIngredients(sql);
  return {runId,report:await finishRun(sql,runId,'completed',counters)};
 }catch(error){return {runId,report:await finishRun(sql,runId,'failed',counters,String(error))};}
}

async function failPage(sql:Sql,runId:number,pageId:number,url:string,res:FetchResult,counters:Record<string,number>){
 // A transient error never deletes a record; it is logged, flagged for review and retried next run.
 await sql`UPDATE ${sql(S)}.source_pages SET status=${res.status===404||res.status===410?'gone':'error'},last_checked_at=now(),last_error=${res.error||`HTTP ${res.status}`} WHERE id=${pageId}`;
 await item(sql,runId,pageId,url,'error',{http:res.status||undefined,attempts:res.attempts,message:res.error});
 await review(sql,runId,pageId,null,null,{type:'fetch_error',detail:`${url}: ${res.error||`HTTP ${res.status}`} po ${res.attempts} próbach`});
 bump(counters,'error');
}

async function storeRevision(tx:Tx,runId:number,pageId:number,res:FetchResult,config:ImportConfig){
 const raw=config.retention==='raw_html'?res.body:null;
 const [rev]=await tx`INSERT INTO ${tx(S)}.source_page_revisions(source_page_id,run_id,http_status,final_url,attempts,content_hash,headers,retention_policy,raw_html)
  VALUES(${pageId},${runId},${res.status},${res.finalUrl},${res.attempts},${res.hash},${tx.json(res.headers)},${config.retention},${raw})
  ON CONFLICT(source_page_id,content_hash) DO UPDATE SET fetched_at=now(),run_id=EXCLUDED.run_id,attempts=EXCLUDED.attempts,headers=EXCLUDED.headers RETURNING id`;
 return Number(rev.id);
}

/** Writes one parsed page: record row, field evidence, tags, ingredients/modifications and review items. Returns the item outcome. */
async function storeParsed(tx:Tx,runId:number,pageId:number,revisionId:number,url:string,p:Parsed){
 const table=p.kind==='herb'?'herbs':'formulas';
 const [other]=await tx`SELECT source_page_id FROM ${tx(S)}.${tx(table)} WHERE id=${p.id}`;
 if(other&&Number(other.source_page_id)!==pageId){
  await review(tx,runId,pageId,p.kind,p.id,{type:'duplicate',detail:`Identyfikator ${p.id} należy już do innej strony źródłowej; ta strona nie została zapisana.`});
  return 'invalid';
 }
 const [rev]=await tx`SELECT fetched_at FROM ${tx(S)}.source_page_revisions WHERE id=${revisionId}`;
 if(p.kind==='herb')await tx`INSERT INTO ${tx(S)}.herbs(id,source_page_id,revision_id,pinyin,chinese,pharmaceutical_latin,english_names,parser_version)
  VALUES(${p.id},${pageId},${revisionId},${p.pinyin},${p.chinese||null},${p.latin||null},${tx.array(p.english)},${PARSER_VERSION})
  ON CONFLICT(id) DO UPDATE SET revision_id=EXCLUDED.revision_id,pinyin=EXCLUDED.pinyin,chinese=EXCLUDED.chinese,pharmaceutical_latin=EXCLUDED.pharmaceutical_latin,english_names=EXCLUDED.english_names,parser_version=EXCLUDED.parser_version,parsed_at=now()`;
 else{
  await tx`INSERT INTO ${tx(S)}.formulas(id,source_page_id,revision_id,pinyin,chinese,english_name,also_known_as,parser_version)
   VALUES(${p.id},${pageId},${revisionId},${p.pinyin},${p.chinese||null},${p.english||null},${tx.array(p.alsoKnownAs)},${PARSER_VERSION})
   ON CONFLICT(id) DO UPDATE SET revision_id=EXCLUDED.revision_id,pinyin=EXCLUDED.pinyin,chinese=EXCLUDED.chinese,english_name=EXCLUDED.english_name,also_known_as=EXCLUDED.also_known_as,parser_version=EXCLUDED.parser_version,parsed_at=now()`;
  // Composition is replaced as a whole inside this transaction, so it is never left half-written.
  await tx`DELETE FROM ${tx(S)}.formula_ingredients WHERE formula_id=${p.id}`;
  for(const i of p.ingredients)await tx`INSERT INTO ${tx(S)}.formula_ingredients(formula_id,position,pinyin_raw,latin_raw,dosage_raw,amount_min,amount_max,unit,is_optional,notes,revision_id)
   VALUES(${p.id},${i.position},${i.pinyin},${i.latin},${i.dosage},${i.amountMin},${i.amountMax},${i.unit},${i.optional},${tx.array(i.notes)},${revisionId})`;
  await tx`DELETE FROM ${tx(S)}.formula_modifications WHERE formula_id=${p.id}`;
  for(const m of p.modifications)await tx`INSERT INTO ${tx(S)}.formula_modifications(formula_id,position,condition,operation,ingredient_raw,source_excerpt,revision_id)
   VALUES(${p.id},${m.position},${m.condition},${m.operation},${m.ingredient},${m.excerpt},${revisionId})`;
 }
 const evidence=new Map<string,number>();
 for(const f of p.fields){
  const [row]=await tx`INSERT INTO ${tx(S)}.field_evidence(record_kind,record_id,field,value,source_url,revision_id,source_excerpt,fetched_at,parser,parser_version,value_status,completeness)
   VALUES(${p.kind},${p.id},${f.name},${f.value===null?null:tx.json(f.value as postgres.JSONValue)},${url},${revisionId},${f.excerpt||null},${rev.fetched_at},${PARSER},${PARSER_VERSION},'source',${f.completeness})
   ON CONFLICT(record_kind,record_id,field,revision_id) DO UPDATE SET value=EXCLUDED.value,source_excerpt=EXCLUDED.source_excerpt,parser_version=EXCLUDED.parser_version,completeness=EXCLUDED.completeness RETURNING id`;
  evidence.set(f.name,Number(row.id));
 }
 // Source tags are re-derived on every parse; normalized or approved tags are left alone.
 const tagTable=p.kind==='herb'?'herb_tags':'formula_tags',idColumn=p.kind==='herb'?'herb_id':'formula_id';
 await tx`DELETE FROM ${tx(S)}.${tx(tagTable)} WHERE ${tx(idColumn)}=${p.id} AND value_status='source'`;
 for(const t of p.tags){
  const [term]=await tx`INSERT INTO ${tx(S)}.taxonomy_terms(axis,label,language,status) VALUES(${t.axis},${t.label},'en','source') ON CONFLICT(axis,label,language) DO UPDATE SET label=EXCLUDED.label RETURNING id`;
  await tx`INSERT INTO ${tx(S)}.${tx(tagTable)}(${tx(idColumn)},term_id,qualifier,value_status,evidence_id) VALUES(${p.id},${term.id},${t.qualifier},'source',${evidence.get(t.field)??null}) ON CONFLICT DO NOTHING`;
 }
 // Parser findings that no longer occur are closed with a note; items raised by people or by fetching stay open.
 await tx`UPDATE ${tx(S)}.review_queue SET status='resolved',resolved_at=now(),resolution=${`Nie występuje po parsowaniu ${PARSER}@${PARSER_VERSION}.`}
  WHERE status='open' AND record_kind=${p.kind} AND record_id=${p.id}
  AND issue_type IN ('unknown_section','missing_field','unreadable','ambiguous_value','name_mismatch','template_variant')
  AND NOT (issue_type||'|'||detail = ANY(${tx.array(p.issues.map(i=>`${i.type}|${i.detail}`))}::text[]))`;
 for(const issue of p.issues)await review(tx,runId,pageId,p.kind,p.id,issue);
 return p.issues.some(i=>i.type==='missing_field'||i.type==='unreadable')?'incomplete':'parsed';
}

/** Links formula ingredients to herb cards by Pinyin; ingredients without a card stay unlinked by design. */
async function linkIngredients(sql:Sql){
 // A card is found by its id or by the Pinyin on its page (the "ban-xia" card is the Zhi Ban Xia page).
 // Optional ingredients are written in parentheses; processed forms such as Zhi Gan Cao stay separate from Gan Cao.
 const byName=new Map<string,string>();
 for(const h of await sql`SELECT id,pinyin FROM ${sql(S)}.herbs`){byName.set(h.id as string,h.id as string);byName.set(slug(h.pinyin as string),h.id as string);}
 const rows=await sql`SELECT formula_id,position,pinyin_raw,herb_id FROM ${sql(S)}.formula_ingredients`;
 for(const r of rows){
  const target=byName.get(slug((r.pinyin_raw as string).replace(/^\((.*)\)$/,'$1')))??null;
  if(target!==r.herb_id)await sql`UPDATE ${sql(S)}.formula_ingredients SET herb_id=${target} WHERE formula_id=${r.formula_id} AND position=${r.position}`;
 }
}

async function recordCounts(sql:Sql){
 const [c]=await sql`SELECT (SELECT count(*) FROM ${sql(S)}.herbs)::int AS herbs,(SELECT count(*) FROM ${sql(S)}.formulas)::int AS formulas`;
 return {herbs:c.herbs as number,formulas:c.formulas as number};
}

/** Run report (document 9.8 and 11): outcomes, completeness, open review items, record counts, time and cost. */
export async function buildReport(sql:Sql,runId:number,counters:Record<string,number>={}){
 const [run]=await sql`SELECT stage,scope,started_at,coalesce(finished_at,now()) AS finished_at FROM ${sql(S)}.import_runs WHERE id=${runId}`;
 const outcomes=await sql`SELECT outcome,count(*)::int AS n FROM ${sql(S)}.import_run_items WHERE run_id=${runId} GROUP BY outcome ORDER BY outcome`;
 const errors=await sql`SELECT url,http_status,attempts,message FROM ${sql(S)}.import_run_items WHERE run_id=${runId} AND outcome IN ('error','skipped','invalid') ORDER BY id`;
 const completeness=await sql`SELECT e.record_kind,e.field,e.completeness,count(*)::int AS n FROM ${sql(S)}.field_evidence e
  JOIN (SELECT id,revision_id FROM ${sql(S)}.herbs UNION ALL SELECT id,revision_id FROM ${sql(S)}.formulas) cur ON cur.id=e.record_id AND cur.revision_id=e.revision_id
  GROUP BY 1,2,3 ORDER BY 1,2,3`;
 const reviewOpen=await sql`SELECT issue_type,count(*)::int AS n FROM ${sql(S)}.review_queue WHERE status='open' GROUP BY 1 ORDER BY 2 DESC`;
 const unlinked=await sql`SELECT count(*)::int AS n FROM ${sql(S)}.formula_ingredients WHERE herb_id IS NULL`;
 return {
  run:runId,stage:run.stage,scope:run.scope,parser:`${PARSER}@${PARSER_VERSION}`,
  seconds:Math.round((new Date(run.finished_at).getTime()-new Date(run.started_at).getTime())/1000),
  counters,outcomes:Object.fromEntries(outcomes.map(o=>[o.outcome,o.n])),errors,
  records:await recordCounts(sql),completeness:completeness.map(c=>({kind:c.record_kind,field:c.field,completeness:c.completeness,n:c.n})),
  reviewOpen:Object.fromEntries(reviewOpen.map(r=>[r.issue_type,r.n])),unlinkedIngredients:unlinked[0].n,
  cost:{aiEur:0,note:'Bez modeli AI ani płatnych API.'},
 };
}
