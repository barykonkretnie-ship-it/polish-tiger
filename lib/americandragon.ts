// Records imported from americandragon.com by scripts/americandragon (parse.py, transform.py).
// Source text stays in English and is unverified; see each record's notes and source link.
import data from './americandragon.json';

export type ImportedRecord = {
 id:string; kind:'herb'|'formula'; name:string; latin:string; translation:string; notes:string; url:string;
 terms:Record<string,string[]>;
 ingredients?:{herb_id:string; quantity:string; role:string; preparation:string}[];
};
export const importMarker='import-americandragon-v1';
export const importedOn:string=data.imported;
export const importedStatus='zaimportowane — niezweryfikowane';
export const importedSourceField='Treść zaimportowana ze strony źródłowej — niezweryfikowana';
// Herbs first, so every formula ingredient already has a record to reference.
export const importedRecords=[...data.herbs,...data.formulas] as ImportedRecord[];
