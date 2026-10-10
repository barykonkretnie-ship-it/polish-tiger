// Removes the unreviewed 50 + 50 American Dragon import (marker import-americandragon-v1) from databases
// that received it. Source data now lives in the separate polish_tiger_source layer (db/migrations).
import manifest from '../db/rollback-americandragon-v1.json';
import {herbs,formulas} from './sample';

export const rollbackMarker='rollback-americandragon-v1';
export const importMarker=manifest.marker;
export const addedRecordIds:string[]=manifest.addedRecordIds;
export const mergedRecordIds:string[]=manifest.mergedRecordIds;
export const mergedTranslations:Record<string,string>=manifest.mergedTranslations;
export const notesSeparator:string=manifest.notesSeparator;
export const importedSourceField:string=manifest.sourceField;

// Terms the original sample attaches to each record; the import's additions are everything else it brought.
const sampleTerms=new Map<string,Set<string>>();
for(const [id,,,category,thermal,taste,channels,actions] of herbs)sampleTerms.set(id,pairs({category,thermal,taste,channel:channels,action:actions}));
for(const [id,,,category,actions,patterns,symptoms] of formulas)sampleTerms.set(id,pairs({category,action:actions,pattern:patterns,symptom:symptoms}));
function pairs(values:Record<string,string>){return new Set(Object.entries(values).flatMap(([dimension,labels])=>labels.split(',').filter(Boolean).map(label=>key(dimension,label))));}
export function key(dimension:string,label:string){return dimension+'\u0000'+label;}
const allSampleTerms=new Set([...sampleTerms.values()].flatMap(s=>[...s]));
const imported=manifest.importedTerms.map(([dimension,label])=>({dimension,label}));
/** Imported terms a merged record should lose: those the sample did not give it. */
export function importedTermsToDetach(recordId:string){const own=sampleTerms.get(recordId)||new Set();return imported.filter(t=>!own.has(key(t.dimension,t.label)));}
/** Imported terms to delete from the dictionary once nothing uses them; sample vocabulary always stays. */
export const importedOnlyTerms=imported.filter(t=>!allSampleTerms.has(key(t.dimension,t.label)));
