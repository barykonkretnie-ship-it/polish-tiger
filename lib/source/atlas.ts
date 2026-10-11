// Adds source records of an approved batch to the atlas (polish_tiger.records) and links formula compositions to the
// atlas herbs they use. Classification tags come later from the translations (publish stage); nothing is invented here.
import type postgres from 'postgres';
import type {Pilot} from './importer';
import {PUBLISHED_STATUS} from './publish';

const S='polish_tiger_source';

export async function addToAtlas(sql:postgres.Sql,batch:Pilot){
 const herbIds=batch.herbs.map(h=>h.id),formulaIds=batch.formulas.map(f=>f.id);
 const result={herbs:0,formulas:0,missingInSource:[] as string[],links:0};
 await sql.begin(async tx=>{
  const herbs=herbIds.length?await tx`SELECT id,pinyin,coalesce(pharmaceutical_latin,'') AS latin FROM ${tx(S)}.herbs WHERE id IN ${tx(herbIds)}`:[];
  const formulas=formulaIds.length?await tx`SELECT id,pinyin FROM ${tx(S)}.formulas WHERE id IN ${tx(formulaIds)}`:[];
  const found=new Set([...herbs,...formulas].map(r=>r.id as string));
  result.missingInSource=[...herbIds,...formulaIds].filter(id=>!found.has(id));
  for(const h of herbs){const r=await tx`INSERT INTO polish_tiger.records(id,kind,name,latin,status) VALUES(${h.id},'herb',${h.pinyin},${h.latin},${PUBLISHED_STATUS}) ON CONFLICT(id) DO NOTHING RETURNING id`;result.herbs+=r.length;}
  for(const f of formulas){const r=await tx`INSERT INTO polish_tiger.records(id,kind,name,status) VALUES(${f.id},'formula',${f.pinyin},${PUBLISHED_STATUS}) ON CONFLICT(id) DO NOTHING RETURNING id`;result.formulas+=r.length;}
  // Every source composition whose formula and herb are both in the atlas becomes an atlas link (pilot formulas gain new herbs too).
  const links=await tx`INSERT INTO polish_tiger.ingredients(formula_id,herb_id,quantity)
   SELECT DISTINCT ON (i.formula_id,i.herb_id) i.formula_id,i.herb_id,i.dosage_raw FROM ${tx(S)}.formula_ingredients i
   JOIN polish_tiger.records f ON f.id=i.formula_id JOIN polish_tiger.records h ON h.id=i.herb_id
   WHERE i.herb_id IS NOT NULL ORDER BY i.formula_id,i.herb_id,i.position
   ON CONFLICT DO NOTHING RETURNING formula_id`;
  result.links=links.length;
 });
 return result;
}
