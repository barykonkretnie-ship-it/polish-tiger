export type Term = {id:number; dimension:string; label:string; synonyms:string};
/** Current source-layer data for a record (polish_tiger_source), as read by the parser; English, unverified. */
export type SourceInfo = {url:string; fetchedAt:string; parserVersion:string; pinyin:string; chinese:string|null;
 fields:Record<string,{value:unknown; completeness:string}>;
 ingredients:{position:number; pinyin:string; latin:string; dosage:string; optional:boolean; notes:string[]; herbId:string|null}[];
 modifications:{position:number; condition:string; operation:string; ingredient:string}[];
 /** Polish translations by field (status ai_proposed or human_approved); missing fields fall back to the source. */
 pl?:Record<string,unknown>};
export type RecordData = {id:string; kind:string; name:string; latin:string; translation:string; status:string; verified_at:string|null; notes:string; terms:Term[]; ingredients:{id:string; name:string; quantity:string; role:string; preparation:string}[]; related:{id:string;name:string}[]; sources:{url:string; field:string; status:string; checked_at:string|null}[]; source?:SourceInfo|null; groups?:string[]};
export type RecordUpdate = {name:string;translation:string;notes:string;termIds:number[]};
