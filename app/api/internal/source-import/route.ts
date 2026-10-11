// Server-side trigger for the source importer, for hosts that cannot reach the database themselves.
// It answers only when IMPORT_TRIGGER_ENABLED=true and only on this deployment's own URL (VERCEL_URL), which
// Vercel Authentication protects; the public production domain always gets 404. Database credentials stay on the server.
// GET ?stage=migrate | export&ids=a,b (max 25) | translations[&file=NAME] | publish | discover | candidates | fetch[&batch=N][&list=NAME] | atlas-add&list=NAME
//     | parse[&force=true] | report[&run=ID] | review | atlas
import path from 'node:path';
import {NextRequest,NextResponse} from 'next/server';
import {loadConfig,ConfigError} from '../../../../lib/source/config';
import {connect} from '../../../../lib/source/db';
import {migrate} from '../../../../lib/source/migrate';
import {PoliteFetcher} from '../../../../lib/source/fetcher';
import {discover,fetchAndParse,reparse,buildReport,RightsNotConfirmed,loadBatch} from '../../../../lib/source/importer';
import {addToAtlas} from '../../../../lib/source/atlas';
import {records} from '../../../../lib/db';
import {exportSource,loadTranslationFile,storeTranslations} from '../../../../lib/source/translations';
import {publishTranslatedTags} from '../../../../lib/source/publish';

export const dynamic='force-dynamic';
export const maxDuration=300;

export async function GET(req:NextRequest){
 const host=req.headers.get('host');
 if(process.env.IMPORT_TRIGGER_ENABLED!=='true'||!process.env.VERCEL_URL||host!==process.env.VERCEL_URL)return new NextResponse('Not found',{status:404});
 const stage=req.nextUrl.searchParams.get('stage');
 const dbUrl=process.env.DATABASE_URL||process.env.POSTGRES_URL;
 if(!dbUrl)return NextResponse.json({error:'Brak DATABASE_URL w tym wdrożeniu.'},{status:500});
 // Direct connection (no proxy on Vercel); the loopback no-TLS switch only applies outside Vercel.
 const sql=connect(dbUrl,{POLISH_TIGER_DATABASE_SSL:process.env.POLISH_TIGER_DATABASE_SSL,VERCEL:process.env.VERCEL});
 try{
  if(stage==='migrate')return NextResponse.json({applied:await migrate(sql)});
  // Translation workflow (document section 7): export source text, load reviewed-to-be translations, publish tags.
  if(stage==='export'){
   const ids=(req.nextUrl.searchParams.get('ids')||'').split(',').filter(Boolean);
   if(!ids.length||ids.length>25)return NextResponse.json({error:'Podaj 1–25 identyfikatorów w ids.'},{status:400});
   return NextResponse.json(await exportSource(sql,ids));
  }
  if(stage==='translations'){
   const name=req.nextUrl.searchParams.get('file')||'pilot-pl';
   if(!/^[a-z0-9-]+$/.test(name))return NextResponse.json({error:'Nieprawidłowa nazwa pliku.'},{status:400});
   const file=loadTranslationFile(path.join(process.cwd(),'db','translations',`${name}.json`));
   if(!file)return NextResponse.json({error:`Brak db/translations/${name}.json w tym wdrożeniu.`},{status:404});
   return NextResponse.json(await storeTranslations(sql,file));
  }
  if(stage==='publish'){await records();return NextResponse.json(await publishTranslatedTags(sql));}
  // Discovered card pages, to choose the next batch from (ids are the importer's slugs).
  if(stage==='candidates'){
   const pages=await sql`SELECT page_type AS kind,index_label AS name,canonical_url AS url,status FROM polish_tiger_source.source_pages WHERE page_type IN ('herb','formula') ORDER BY page_type,index_label`;
   return NextResponse.json(pages);
  }
  if(stage==='atlas-add'){await records();return NextResponse.json(await addToAtlas(sql,loadBatch(req.nextUrl.searchParams.get('list')||'')));}
  const config=loadConfig({...process.env,IMPORT_DATABASE_URL:dbUrl});
  const fetcher=new PoliteFetcher({delaySeconds:config.delaySeconds,maxRetries:config.maxRetries,userAgent:config.userAgent});
  if(stage==='discover')return NextResponse.json((await discover(sql,config,fetcher)).report);
  if(stage==='fetch'){
   const batch=Number(req.nextUrl.searchParams.get('batch')||'10');
   if(!Number.isInteger(batch)||batch<1||batch>config.maxPages)return NextResponse.json({error:'Nieprawidłowy batch.'},{status:400});
   const list=req.nextUrl.searchParams.get('list');
   return NextResponse.json((await fetchAndParse(sql,config,fetcher,list?'list':'pilot',list?loadBatch(list):undefined,{batch})).report);
  }
  if(stage==='parse')return NextResponse.json((await reparse(sql,config,req.nextUrl.searchParams.get('force')==='true')).report);
  if(stage==='atlas'){
   // Runs the atlas's own initialization (including the one-time rollback) and returns its record counts.
   const all=await records();
   return NextResponse.json({herbs:all.filter(r=>r.kind==='herb').length,formulas:all.filter(r=>r.kind==='formula').length});
  }
  if(stage==='report'){
   const run=Number(req.nextUrl.searchParams.get('run'))||Number((await sql`SELECT max(id) AS id FROM polish_tiger_source.import_runs`)[0].id);
   return NextResponse.json(await buildReport(sql,run));
  }
  if(stage==='review'){
   // Read-only overview for the quality check after the pilot (document 9.9).
   const open=await sql`SELECT record_kind,record_id,field,issue_type,detail FROM polish_tiger_source.review_queue WHERE status='open' ORDER BY issue_type,record_kind,record_id`;
   const unlinked=await sql`SELECT formula_id,position,pinyin_raw,dosage_raw FROM polish_tiger_source.formula_ingredients WHERE herb_id IS NULL ORDER BY formula_id,position`;
   const records=await sql`SELECT 'herb' AS kind,id,pinyin,chinese,pharmaceutical_latin AS latin FROM polish_tiger_source.herbs UNION ALL SELECT 'formula',id,pinyin,chinese,english_name FROM polish_tiger_source.formulas ORDER BY 1,2`;
   const atlas=await sql`SELECT kind,count(*)::int AS n FROM polish_tiger.records GROUP BY kind`.catch(()=>[]);
   const markers=await sql`SELECT key FROM polish_tiger.metadata ORDER BY key`.catch(()=>[]);
   return NextResponse.json({records,open,unlinked,atlas,atlasMarkers:markers.map(m=>m.key)});
  }
  return NextResponse.json({error:'stage: migrate | discover | candidates | fetch | atlas-add | parse | report | review | atlas'},{status:400});
 }catch(error){
  const message=error instanceof ConfigError||error instanceof RightsNotConfirmed||error instanceof Error?error.message:String(error);
  return NextResponse.json({error:message},{status:500});
 }finally{await sql.end();}
}
