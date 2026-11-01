import type { RecordData } from './db';
import { FACET_IDS, facetLabel, OTHER } from './facets';
// Search words with the same meaning: "stagnacja" finds "Zastój", "deficyt" finds "Niedobór".
const SYNONYMS:[RegExp,string[]][]=[[/^stagnac|^zastoin/,['zastoj','stagnac']],[/^deficyt|^pustk|^niedostat/,['niedobor']],[/^sluz/,['flegm','sluz']],[/^goraco|^upal/,['goraco','goraca','gorac']]];
const alternatives=(word:string)=>{for(const [re,alts] of SYNONYMS)if(re.test(word))return [word,...alts];return [word];};
export function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/Ł/g,'l').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function matches(r:RecordData, query:string, filters:Record<string,string[]>, mode:'AND'|'OR') {
 const text=normalize([r.name,r.translation,r.latin,r.user_notes||'',...r.terms.flatMap(t=>[t.label,t.synonyms]),...Object.entries(r.facets||{}).flatMap(([f,ids])=>ids.filter(i=>i!==OTHER).map(i=>facetLabel(f,i)))].join(' '));
 if(!normalize(query).split(' ').filter(Boolean).every(word=>alternatives(word).some(w=>text.includes(w)))) return false;
 // Every ticked value is one condition: AND needs all of them, OR any one.
 const has=(dimension:string,value:string)=>dimension==='ingredient'?r.ingredients.some(i=>i.id===value):FACET_IDS.has(dimension)?!!r.facets?.[dimension]?.includes(value):r.terms.some(t=>t.dimension===dimension&&String(t.id)===value);
 const conditions=Object.entries(filters).flatMap(([dimension,values])=>values.map(value=>has(dimension,value)));
 return !conditions.length || (mode==='AND'?conditions.every(Boolean):conditions.some(Boolean));
}
