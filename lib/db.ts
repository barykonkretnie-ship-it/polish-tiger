import type {RecordUpdate,Product} from './types';
import {POLISH_NAMES} from './names-pl';
import {compareTerms} from './term-order';
import {protocolInfo} from './protocols';
import {categoryGroups} from './category-groups';
export type {Term,RecordData,Product} from './types';
export const dimensions:Record<string,string>={mine:'Moje znaczniki',category:'Kategoria',thermal:'Termika',taste:'Smak',channel:'Kanał',organ:'Narząd',action:'Działanie TCM',direction:'Kierunek działania',pattern:'Wzorzec TCM',symptom:'Objaw',indication:'Wskazanie',contraindication:'Przeciwwskazanie'};
async function backend(){
 if(process.env.POLISH_TIGER_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL)return import('./db-postgres');
 if(process.env.VERCEL)throw new Error('Vercel requires POLISH_TIGER_DATABASE_URL; SQLite is only supported locally.');
 return import('./db-sqlite');
}
/** Herbs without an edited Polish name get the built-in one, so it is shown and searchable. */
export async function records(){return (await (await backend()).records()).map(r=>({...r,translation:r.translation||(r.kind==='herb'?POLISH_NAMES[r.id]:r.kind==='formula'?protocolInfo(r.name)?.label:undefined)||r.translation,terms:[...r.terms].sort(compareTerms),groups:r.kind==='herb'?[...new Set(r.terms.filter(t=>t.dimension==='category').flatMap(t=>categoryGroups(t.label)))]:[]}));}
export async function dictionary(){return [...await (await backend()).dictionary()].sort(compareTerms);}
export async function updateRecord(id:string,data:RecordUpdate){return (await backend()).updateRecord(id,data);}
export async function updateTerm(id:number,label:string,synonyms:string){return (await backend()).updateTerm(id,label,synonyms);}
export async function createTerm(dimension:string,label:string,synonyms:string){return (await backend()).createTerm(dimension,label,synonyms);}
export async function addTag(id:string,dimension:string,label:string){return (await backend()).addTag(id,dimension,label);}
export async function removeTag(id:string,termId:number){return (await backend()).removeTag(id,termId);}
export async function deleteTag(termId:number){return (await backend()).deleteTag(termId);}
export async function setUserNote(id:string,text:string){return (await backend()).setUserNote(id,text);}
/** One record as records() shows it, so a save can answer with just the changed card. */
export async function recordById(id:string){return (await records()).find(r=>r.id===id)??null;}
export async function products(){return [...await (await backend()).products()];}
export async function saveProduct(p:Omit<Product,'id'>&{id?:number}){return (await backend()).saveProduct(p);}
export async function deleteProduct(id:number){return (await backend()).deleteProduct(id);}
