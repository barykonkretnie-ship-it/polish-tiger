import type { RecordData } from './db';
export function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/Ł/g,'l').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function matches(r:RecordData, query:string, filters:Record<string,string[]>, mode:'AND'|'OR') {
 const text=normalize([r.name,r.translation,r.latin,r.user_notes||'',...r.terms.flatMap(t=>[t.label,t.synonyms])].join(' '));
 if(!normalize(query).split(' ').every(word=>text.includes(word))) return false;
 // Every ticked value is one condition: AND needs all of them, OR any one.
 const has=(dimension:string,value:string)=>dimension==='ingredient'?r.ingredients.some(i=>i.id===value):dimension==='group'?!!r.groups?.includes(value):dimension==='agroup'?!!r.actionGroups?.includes(value):r.terms.some(t=>t.dimension===dimension&&String(t.id)===value);
 const conditions=Object.entries(filters).flatMap(([dimension,values])=>values.map(value=>has(dimension,value)));
 return !conditions.length || (mode==='AND'?conditions.every(Boolean):conditions.some(Boolean));
}
