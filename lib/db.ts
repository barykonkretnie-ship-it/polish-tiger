import type {RecordUpdate} from './types';
export type {Term,RecordData} from './types';
export const dimensions:Record<string,string>={category:'Kategoria',thermal:'Termika',taste:'Smak',channel:'Kanał',organ:'Narząd',action:'Działanie TCM',direction:'Kierunek działania',pattern:'Wzorzec TCM',symptom:'Objaw',indication:'Wskazanie',contraindication:'Przeciwwskazanie'};
async function backend(){
 if(process.env.POLISH_TIGER_DATABASE_URL)return import('./db-postgres');
 if(process.env.VERCEL)throw new Error('Vercel requires POLISH_TIGER_DATABASE_URL; SQLite is only supported locally.');
 return import('./db-sqlite');
}
export async function records(){return (await backend()).records();}
export async function dictionary(){return (await backend()).dictionary();}
export async function updateRecord(id:string,data:RecordUpdate){return (await backend()).updateRecord(id,data);}
export async function updateTerm(id:number,label:string,synonyms:string){return (await backend()).updateTerm(id,label,synonyms);}
export async function createTerm(dimension:string,label:string,synonyms:string){return (await backend()).createTerm(dimension,label,synonyms);}
