// Server-side trigger for the source importer, for hosts that cannot reach the database themselves.
// It answers only when IMPORT_TRIGGER_ENABLED=true and only on this deployment's own URL (VERCEL_URL), which
// Vercel Authentication protects; the public production domain always gets 404. Database credentials stay on the server.
// GET ?stage=migrate | discover | fetch[&batch=N] | report[&run=ID]
import {NextRequest,NextResponse} from 'next/server';
import {loadConfig,ConfigError} from '../../../../lib/source/config';
import {connect} from '../../../../lib/source/db';
import {migrate} from '../../../../lib/source/migrate';
import {PoliteFetcher} from '../../../../lib/source/fetcher';
import {discover,fetchAndParse,buildReport,RightsNotConfirmed} from '../../../../lib/source/importer';

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
  const config=loadConfig({...process.env,IMPORT_DATABASE_URL:dbUrl});
  const fetcher=new PoliteFetcher({delaySeconds:config.delaySeconds,maxRetries:config.maxRetries,userAgent:config.userAgent});
  if(stage==='discover')return NextResponse.json((await discover(sql,config,fetcher)).report);
  if(stage==='fetch'){
   const batch=Number(req.nextUrl.searchParams.get('batch')||'10');
   if(!Number.isInteger(batch)||batch<1||batch>config.maxPages)return NextResponse.json({error:'Nieprawidłowy batch.'},{status:400});
   return NextResponse.json((await fetchAndParse(sql,config,fetcher,'pilot',undefined,{batch})).report);
  }
  if(stage==='report'){
   const run=Number(req.nextUrl.searchParams.get('run'))||Number((await sql`SELECT max(id) AS id FROM polish_tiger_source.import_runs`)[0].id);
   return NextResponse.json(await buildReport(sql,run));
  }
  return NextResponse.json({error:'stage: migrate | discover | fetch | report'},{status:400});
 }catch(error){
  const message=error instanceof ConfigError||error instanceof RightsNotConfirmed||error instanceof Error?error.message:String(error);
  return NextResponse.json({error:message},{status:500});
 }finally{await sql.end();}
}
