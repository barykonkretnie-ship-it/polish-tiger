import type {RecordUpdate} from './types';
import {POLISH_NAMES} from './names-pl';
import {compareTerms} from './term-order';
import {protocolInfo} from './protocols';
export type {Term,RecordData} from './types';
export const dimensions:Record<string,string>={category:'Kategoria',thermal:'Termika',taste:'Smak',channel:'Kanał',organ:'Narząd',action:'Działanie TCM',direction:'Kierunek działania',pattern:'Wzorzec TCM',symptom:'Objaw',indication:'Wskazanie',contraindication:'Przeciwwskazanie'};
async function backend(){
 if(process.env.POLISH_TIGER_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL)return import('./db-postgres');
 if(process.env.VERCEL)throw new Error('Vercel requires POLISH_TIGER_DATABASE_URL; SQLite is only supported locally.');
 return import('./db-sqlite');
}
/** Herbs without an edited Polish name get the built-in one, so it is shown and searchable. */
export async function records(){return (await (await backend()).records()).map(r=>({...r,translation:r.translation||(r.kind==='herb'?POLISH_NAMES[r.id]:r.kind==='formula'?protocolInfo(r.name)?.label:undefined)||r.translation,terms:[...r.terms].sort(compareTerms)}));}
export async function dictionary(){return [...await (await backend()).dictionary()].sort(compareTerms);}
export async function updateRecord(id:string,data:RecordUpdate){return (await backend()).updateRecord(id,data);}
export async function updateTerm(id:number,label:string,synonyms:string){return (await backend()).updateTerm(id,label,synonyms);}
export async function createTerm(dimension:string,label:string,synonyms:string){return (await backend()).createTerm(dimension,label,synonyms);}
