// Publishes translated source terms into the atlas classification (polish_tiger.terms / record_terms) for records
// with the same id, replacing the demo tags only in dimensions the source covers. Secondary values (in parentheses)
// stay out of the tags; they remain visible in the record details.
import type postgres from 'postgres';
import {herbs,formulas} from '../sample';
import {currentTranslations} from './translations';

export const PUBLISHED_STATUS='źródło + tłumaczenie AI — do przeglądu';
const HERB_DIMS:Record<string,string>={category:'category',temperature:'thermal',taste:'taste',channels:'channel'};
const FORMULA_DIMS:Record<string,string>={formula_actions:'action',syndromes:'pattern',manifestations:'symptom',treats:'indication'};

const sampleVocabulary=new Set([
 ...herbs.flatMap(([, , ,category,thermal,taste,channels,actions])=>[['category',category],['thermal',thermal],['taste',taste],['channel',channels],['action',actions]].flatMap(([d,v])=>v.split(',').filter(Boolean).map(l=>d+'|'+l))),
 ...formulas.flatMap(([, , ,category,actions,patterns,symptoms])=>[['category',category],['action',actions],['pattern',patterns],['symptom',symptoms]].flatMap(([d,v])=>v.split(',').filter(Boolean).map(l=>d+'|'+l))),
]);

const primary=(v:unknown)=>(Array.isArray(v)?v:typeof v==='string'&&v?[v]:[]).map(String).map(s=>s.trim()).filter(s=>s&&!/^\(.*\)$/.test(s));

/** Tags per atlas dimension for one record, from its Polish fields. */
export function tagsFor(kind:'herb'|'formula',pl:Record<string,unknown>){
 const tags:Record<string,string[]>={};
 const add=(dim:string,labels:string[])=>{for(const l of labels){const t=l.replace(/\.$/,'').slice(0,200);if(t&&!(tags[dim]??=[]).includes(t))tags[dim].push(t);}};
 for(const [field,dim] of Object.entries(kind==='herb'?HERB_DIMS:FORMULA_DIMS)){
  const values=primary(pl[field]);
  if(field==='temperature'){
   add('contraindication',values.filter(v=>/toksyczn/i.test(v)));
   // "neutralne (surowy) (Gan Cao)" / "ciepłe (prażony) (Zhi Gan Cao)": qualified values describe processed forms; only the first, bare one is a tag.
   const thermal=values.filter(v=>!/toksyczn/i.test(v));
   const qualified=thermal.some(v=>/\(/.test(v));
   add(dim,(qualified?thermal.slice(0,1):thermal).map(v=>v.replace(/\s*\(.*$/,'')));
  }
  else add(dim,values);
 }
 if(kind==='herb'&&Array.isArray(pl.actions))add('action',(pl.actions as {action:string}[]).map(a=>a.action));
 return tags;
}

export async function publishTranslatedTags(sql:postgres.Sql){
 const translations=await currentTranslations(sql);
 const result={records:0,tags:0,removedDemoTerms:0};
 await sql.begin(async tx=>{
  for(const [id,pl] of translations){
   const [rec]=await tx`SELECT kind FROM polish_tiger.records WHERE id=${id}`;
   if(!rec)continue;
   const tags=tagsFor(rec.kind,pl);
   for(const [dim,labels] of Object.entries(tags)){
    await tx`DELETE FROM polish_tiger.record_terms rt USING polish_tiger.terms t WHERE rt.record_id=${id} AND rt.term_id=t.id AND t.dimension=${dim}`;
    for(const label of labels){
     await tx`INSERT INTO polish_tiger.terms(dimension,label) VALUES(${dim},${label}) ON CONFLICT DO NOTHING`;
     await tx`INSERT INTO polish_tiger.record_terms(record_id,term_id) SELECT ${id},id FROM polish_tiger.terms WHERE dimension=${dim} AND label=${label} ON CONFLICT DO NOTHING`;
     result.tags++;
    }
   }
   await tx`UPDATE polish_tiger.records SET status=${PUBLISHED_STATUS} WHERE id=${id}`;
   result.records++;
  }
  // Demo vocabulary and thermal labels nothing uses any more would only clutter the filters and dictionary.
  const orphans=await tx`SELECT id,dimension,label FROM polish_tiger.terms t WHERE NOT EXISTS(SELECT 1 FROM polish_tiger.record_terms rt WHERE rt.term_id=t.id)`;
  for(const o of orphans)if(sampleVocabulary.has(o.dimension+'|'+o.label)||o.dimension==='thermal'){await tx`DELETE FROM polish_tiger.terms WHERE id=${o.id}`;result.removedDemoTerms++;}
 });
 return result;
}
