// Polish translations of source fields (document section 7): stored next to the source text, never replacing it.
// Each translated field carries the hash of the source value it was made from; a changed source marks it as a conflict.
import type postgres from 'postgres';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';

const S='polish_tiger_source';
export const LANGUAGE='pl';

export function sourceHash(value:unknown){return createHash('sha256').update(JSON.stringify(value??null)).digest('hex');}

/** Polish values per field, in the shape of the source value; combinations hold only the translated indications. */
export type TranslationFile={glossaryVersion:string; model:string; promptVersion:string; records:{
 id:string; kind:'herb'|'formula'; fields:Record<string,unknown>;
}[]};

/** Current source values of the given records, with hashes, as the input for translating. */
export async function exportSource(sql:postgres.Sql,ids:string[]){
 const rows=await sql`SELECT e.record_kind,e.record_id,e.field,e.value,e.completeness FROM ${sql(S)}.field_evidence e
  JOIN (SELECT id,revision_id FROM ${sql(S)}.herbs UNION ALL SELECT id,revision_id FROM ${sql(S)}.formulas) c ON c.id=e.record_id AND c.revision_id=e.revision_id
  WHERE e.record_id IN ${sql(ids)} ORDER BY e.record_id,e.field`;
 const ingredients=await sql`SELECT formula_id,position,pinyin_raw,notes FROM ${sql(S)}.formula_ingredients WHERE formula_id IN ${sql(ids)} ORDER BY formula_id,position`;
 const mods=await sql`SELECT formula_id,position,condition,ingredient_raw FROM ${sql(S)}.formula_modifications WHERE formula_id IN ${sql(ids)} ORDER BY formula_id,position`;
 const out:Record<string,{kind:string;fields:Record<string,{value:unknown;completeness:string;sourceHash:string}>}>={};
 for(const r of rows){(out[r.record_id]??={kind:r.record_kind,fields:{}}).fields[r.field]={value:r.value,completeness:r.completeness,sourceHash:sourceHash(r.value)};}
 // Ingredient notes and modification conditions live in their own tables; they are exported as pseudo-fields.
 for(const id of Object.keys(out)){
  const ing=ingredients.filter(i=>i.formula_id===id).map(i=>({position:i.position,pinyin:i.pinyin_raw,notes:i.notes}));
  const mod=mods.filter(m=>m.formula_id===id).map(m=>({position:m.position,condition:m.condition,ingredient:m.ingredient_raw}));
  if(ing.length)out[id].fields.ingredient_notes={value:ing,completeness:'present',sourceHash:sourceHash(ing)};
  if(mod.length)out[id].fields.modification_conditions={value:mod,completeness:'present',sourceHash:sourceHash(mod)};
 }
 return out;
}

export function loadTranslationFile(file=path.join(process.cwd(),'db','translations','pilot-pl.json')):TranslationFile|null{
 return existsSync(file)?JSON.parse(readFileSync(file,'utf8')) as TranslationFile:null;
}

/** A translation must keep the source's structure item for item; combinations translate only the indications. */
export function shapeMismatch(field:string,source:unknown,pl:unknown):string|null{
 const len=(v:unknown)=>Array.isArray(v)?v.length:-1;
 if(field==='combinations')return len(pl)===len(source)?null:`kombinacji ${len(pl)} zamiast ${len(source)}`;
 if(Array.isArray(source)!==Array.isArray(pl))return 'inny typ wartości';
 if(!Array.isArray(source))return typeof pl==='string'?null:'oczekiwano tekstu';
 if(source.length!==(pl as unknown[]).length)return `pozycji ${(pl as unknown[]).length} zamiast ${source.length}`;
 if(field==='actions'){
  for(let i=0;i<source.length;i++){const a=(source as {indications:string[]}[])[i],b=(pl as {indications?:string[]}[])[i];if(!b||len(b.indications)!==a.indications.length)return `działanie ${i+1}: wskazań ${len(b?.indications)} zamiast ${a.indications.length}`;}
 }
 if(field==='ingredient_notes'||field==='modification_conditions'){
  for(let i=0;i<source.length;i++){const a=(source as {position:number;notes?:string[]}[])[i],b=(pl as {position:number;notes?:string[]}[])[i];if(a.position!==b?.position||(a.notes&&len(b.notes)!==a.notes.length))return `pozycja ${a.position} nie zgadza się`;}
 }
 return null;
}

/** Stores translations bound to the hash of the source value they were made from (the current one when loaded). */
export async function storeTranslations(sql:postgres.Sql,file:TranslationFile){
 const current=await exportSource(sql,file.records.map(r=>r.id));
 const counts={stored:0,updated:0,skipped:0};
 await sql.begin(async tx=>{
  for(const r of file.records)for(const [field,value] of Object.entries(r.fields)){
   const src=current[r.id]?.fields[field];
   if(!src||src.completeness!=='present'){counts.skipped++;continue;}
   const problem=shapeMismatch(field,src.value,value);
   if(problem){
    counts.skipped++;
    await tx`INSERT INTO ${tx(S)}.review_queue(record_kind,record_id,field,issue_type,detail) VALUES(${r.kind},${r.id},${field},'conflict',${'Tłumaczenie nie pasuje do tekstu źródłowego: '+problem})
     ON CONFLICT (coalesce(record_kind,''),coalesce(record_id,''),coalesce(field,''),issue_type,detail) WHERE status='open' DO NOTHING`;
    continue;
   }
   const res=await tx`INSERT INTO ${tx(S)}.translations(record_kind,record_id,field,language,source_text,source_hash,translated_text,glossary_version,model,prompt_version,status,cost_eur)
    VALUES(${r.kind},${r.id},${field},${LANGUAGE},${JSON.stringify(src.value)},${src.sourceHash},${JSON.stringify(value)},${file.glossaryVersion},${file.model},${file.promptVersion},'ai_proposed',0)
    ON CONFLICT(record_kind,record_id,field,language,source_hash,glossary_version) DO UPDATE SET translated_text=EXCLUDED.translated_text,model=EXCLUDED.model,prompt_version=EXCLUDED.prompt_version
    WHERE ${tx(S)}.translations.status<>'human_approved' RETURNING (xmax=0) AS inserted`;
   if(!res.length)counts.skipped++;else if(res[0].inserted)counts.stored++;else counts.updated++;
  }
 });
 return counts;
}

/** Latest usable Polish translation per record and field: approved before proposed, and only while the source text
 * it was made from is still the current one (a changed source hides it until it is translated again). */
export async function currentTranslations(sql:postgres.Sql){
 const out=new Map<string,Record<string,unknown>>();
 if(!(await sql`SELECT to_regclass('polish_tiger_source.translations') AS t`)[0].t)return out;
 const rows=await sql`SELECT DISTINCT ON (record_id,field,source_hash) record_id,field,source_hash,translated_text FROM ${sql(S)}.translations
  WHERE language=${LANGUAGE} AND status IN ('human_approved','ai_proposed') ORDER BY record_id,field,source_hash,(status='human_approved') DESC,created_at DESC`;
 if(!rows.length)return out;
 const current=await exportSource(sql,[...new Set(rows.map(r=>r.record_id as string))]);
 for(const r of rows){
  if(current[r.record_id]?.fields[r.field]?.sourceHash!==r.source_hash)continue;
  (out.get(r.record_id)??out.set(r.record_id,{}).get(r.record_id)!)[r.field]=JSON.parse(r.translated_text);
 }
 return out;
}
