import type { RecordData } from './db';
export function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/Ł/g,'l').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function matches(r:RecordData, query:string, filters:Record<string,string[]>, mode:'AND'|'OR') {
 const text=normalize([r.name,r.translation,r.latin,r.user_notes||'',...r.terms.flatMap(t=>[t.label,t.synonyms])].join(' '));
 if(!normalize(query).split(' ').every(word=>text.includes(word))) return false;
 const groups=Object.entries(filters).filter(([,values])=>values.length).map(([dimension,values])=>dimension==='ingredient'?r.ingredients.some(i=>values.includes(i.id)):dimension==='group'?!!r.groups?.some(g=>values.includes(g)):r.terms.some(t=>t.dimension===dimension&&values.includes(String(t.id))));
 return !groups.length || (mode==='AND'?groups.every(Boolean):groups.some(Boolean));
}
