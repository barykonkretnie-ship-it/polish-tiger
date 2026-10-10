// Polish Tiger source importer. Stages run independently (document section 2):
//   npm run import -- discover          index pages -> source_pages
//   npm run import -- fetch [pilot|all] card pages -> revisions -> parsed records (pilot = exactly 20 + 10)
//   npm run import -- parse [--force]   re-parse retained HTML without downloading
//   npm run import -- report <runId>    print a stored run report
//   npm run import -- read-files <dir>  offline parser read report for saved pages (no database, no network)
// Settings come from the environment; see .env.import.example. Nothing has a hidden default.
import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {loadConfig,ConfigError} from '../lib/source/config';
import {connect} from '../lib/source/db';
import {PoliteFetcher} from '../lib/source/fetcher';
import {discover,fetchAndParse,reparse,buildReport,RightsNotConfirmed} from '../lib/source/importer';
import {parsePage,PARSER_VERSION} from '../lib/source/parser';
import {decode} from '../lib/source/fetcher';

const [command,arg]=process.argv.slice(2);

function markdown(r:Awaited<ReturnType<typeof buildReport>>){
 const out=[`# Raport importu #${r.run} (${r.stage})`,'',`Parser: ${r.parser} · czas: ${r.seconds} s · koszt AI: ${r.cost.aiEur} EUR (${r.cost.note})`,'',
  `Zakres: \`${JSON.stringify(r.scope)}\``,'','## Wyniki stron','',...Object.entries(r.outcomes).map(([k,v])=>`- ${k}: ${v}`),
  '',`Liczniki: \`${JSON.stringify(r.counters)}\``,'',`Rekordy w warstwie źródłowej: ${r.records.herbs} ziół, ${r.records.formulas} formuł. Składniki bez karty zioła: ${r.unlinkedIngredients}.`];
 if(r.errors.length)out.push('','## Błędy i pominięcia','',...r.errors.map(e=>`- ${e.url} — HTTP ${e.http_status??'-'}, próby ${e.attempts??'-'}: ${e.message??''}`));
 out.push('','## Kompletność pól (bieżące rewizje)','','| typ | pole | present | missing_in_source | unreadable | needs_review |','|---|---|---|---|---|---|');
 const rows=new Map<string,Record<string,number>>();
 for(const c of r.completeness){const k=`${c.kind}|${c.field}`;rows.set(k,{...(rows.get(k)||{}),[c.completeness]:c.n});}
 for(const [k,v] of rows){const [kind,field]=k.split('|');out.push(`| ${kind} | ${field} | ${v.present||0} | ${v.missing_in_source||0} | ${v.unreadable||0} | ${v.needs_review||0} |`);}
 out.push('','## Otwarta kolejka przeglądu','',...(Object.keys(r.reviewOpen).length?Object.entries(r.reviewOpen).map(([k,v])=>`- ${k}: ${v}`):['- brak']));
 return out.join('\n')+'\n';
}

function save(report:Awaited<ReturnType<typeof buildReport>>){
 const text=markdown(report);
 const dir=process.env.IMPORT_REPORT_DIR;
 if(dir){mkdirSync(dir,{recursive:true});const file=path.join(dir,`import-${report.run}-${report.stage}.md`);writeFileSync(file,text);console.log(`Raport zapisany: ${file}`);}
 console.log(text);
}

if(command==='read-files'){
 // Offline check of the parser on saved pages (document 12.4). Subfolders herbs/ and formulas/.
 if(!arg){console.error('Podaj katalog z podkatalogami herbs/ i formulas/.');process.exit(1);}
 const stats:Record<string,Record<string,number>>={},issues:Record<string,number>={};let pages=0;
 for(const [kind,sub] of [['herb','herbs'],['formula','formulas']] as const){
  let files:string[]=[];try{files=readdirSync(path.join(arg,sub));}catch{continue;}
  for(const f of files){
   const p=parsePage(kind,decode(readFileSync(path.join(arg,sub,f))).text);pages++;
   for(const fl of p.fields){(stats[`${kind}.${fl.name}`]??={})[fl.completeness]=(stats[`${kind}.${fl.name}`]?.[fl.completeness]||0)+1;}
   for(const i of p.issues)issues[`${kind}.${i.type}.${i.field||'-'}`]=(issues[`${kind}.${i.type}.${i.field||'-'}`]||0)+1;
  }
 }
 console.log(`# Raport odczytu parsera ${PARSER_VERSION} — ${pages} stron\n\n| pole | present | missing_in_source | unreadable | needs_review |\n|---|---|---|---|---|`);
 for(const [k,v] of Object.entries(stats))console.log(`| ${k} | ${v.present||0} | ${v.missing_in_source||0} | ${v.unreadable||0} | ${v.needs_review||0} |`);
 console.log('\n## Uwagi do przeglądu\n');for(const [k,v] of Object.entries(issues).sort())console.log(`- ${k}: ${v}`);
 process.exit(0);
}

let config;
try{config=loadConfig();}catch(e){console.error(e instanceof ConfigError?e.message:e);process.exit(1);}
const sql=connect(config.databaseUrl);
const fetcher=new PoliteFetcher({delaySeconds:config.delaySeconds,maxRetries:config.maxRetries,userAgent:config.userAgent});
try{
 const migrated=await sql`SELECT to_regclass('polish_tiger_source.import_runs') AS t`;
 if(!migrated[0].t)throw new Error('Brak schematu polish_tiger_source. Uruchom najpierw: npm run db:migrate');
 if(command==='discover')save((await discover(sql,config,fetcher)).report);
 else if(command==='fetch')save((await fetchAndParse(sql,config,fetcher,arg==='all'?'all':'pilot')).report);
 else if(command==='parse')save((await reparse(sql,config,arg==='--force')).report);
 else if(command==='report'&&arg)save(await buildReport(sql,Number(arg)));
 else{console.error('Polecenia: discover | fetch [pilot|all] | parse [--force] | report <runId> | read-files <katalog>');process.exitCode=1;}
}catch(e){console.error(e instanceof RightsNotConfirmed?e.message:`Import przerwany: ${e instanceof Error?e.message:e}`);process.exitCode=1;}
finally{await sql.end();}
