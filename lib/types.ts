export type Term = {id:number; dimension:string; label:string; synonyms:string};
export type RecordData = {id:string; kind:string; name:string; latin:string; translation:string; status:string; verified_at:string|null; notes:string; terms:Term[]; ingredients:{id:string; name:string; quantity:string; role:string; preparation:string}[]; related:{id:string;name:string}[]; sources:{url:string; field:string; status:string; checked_at:string|null}[]};
export type RecordUpdate = {name:string;translation:string;notes:string;termIds:number[]};
