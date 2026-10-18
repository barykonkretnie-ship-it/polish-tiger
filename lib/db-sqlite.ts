import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { herbs, formulas } from './sample';
import * as rollback from './rollback';

import type { Term, RecordData, Product } from './types';
const directory = process.env.POLISH_TIGER_DATA_DIR || path.join(process.cwd(), 'data');
mkdirSync(directory,{recursive:true});
const db = new DatabaseSync(path.join(directory,'polish-tiger.sqlite'));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('herb','formula')), name TEXT NOT NULL, latin TEXT NOT NULL DEFAULT '', translation TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'demonstracyjne', verified_at TEXT, notes TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS terms(id INTEGER PRIMARY KEY, dimension TEXT NOT NULL, label TEXT NOT NULL, synonyms TEXT NOT NULL DEFAULT '', UNIQUE(dimension,label));
CREATE TABLE IF NOT EXISTS record_terms(record_id TEXT REFERENCES records(id), term_id INTEGER REFERENCES terms(id), PRIMARY KEY(record_id,term_id));
CREATE TABLE IF NOT EXISTS ingredients(formula_id TEXT REFERENCES records(id), herb_id TEXT REFERENCES records(id), quantity TEXT NOT NULL DEFAULT 'brak danych', role TEXT NOT NULL DEFAULT 'do weryfikacji', preparation TEXT NOT NULL DEFAULT 'do weryfikacji', PRIMARY KEY(formula_id,herb_id));
CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY, record_id TEXT REFERENCES records(id), field TEXT NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL, checked_at TEXT);
CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
if(!(db.prepare('PRAGMA table_info(record_terms)').all() as {name:string}[]).some(c=>c.name==='by_user'))db.exec('ALTER TABLE record_terms ADD COLUMN by_user INTEGER NOT NULL DEFAULT 0');
if(!(db.prepare('PRAGMA table_info(records)').all() as {name:string}[]).some(c=>c.name==='user_notes'))db.exec("ALTER TABLE records ADD COLUMN user_notes TEXT NOT NULL DEFAULT ''");
db.exec("CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', link TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
function attach(id:string, dimension:string, labels:string) {
 for(const label of labels.split(',').filter(Boolean)) {
  db.prepare('INSERT OR IGNORE INTO terms(dimension,label) VALUES(?,?)').run(dimension,label);
  db.prepare('INSERT OR IGNORE INTO record_terms(record_id,term_id) VALUES(?,(SELECT id FROM terms WHERE dimension=? AND label=?))').run(id,dimension,label);
 }
}
if (!db.prepare("SELECT value FROM metadata WHERE key='seed-v1'").get()) {
 db.exec('BEGIN');
 try {
  const insert = db.prepare('INSERT INTO records(id,kind,name,latin,translation,notes) VALUES(?,?,?,?,?,?)');
  const note='Próbka demonstracyjna do testowania interfejsu. Klasyfikacje i skład wymagają weryfikacji, w tym postaci przetworzenia surowców. Nie jest to receptura ani zalecenie leczenia.';
  for(const [id,name,latin,category,thermal,taste,channels,actions] of herbs) {
   insert.run(id,'herb',name,latin,'',note);
   for(const [dim,values] of Object.entries({category,thermal,taste,channel:channels,action:actions})) attach(id,dim,values);
  }
  for(const [id,name,translation,category,actions,patterns,symptoms,composition] of formulas) {
   insert.run(id,'formula',name,'',translation,note);
   for(const [dim,values] of Object.entries({category,action:actions,pattern:patterns,symptom:symptoms})) attach(id,dim,values);
   for(const herb of composition.split(',')) db.prepare('INSERT INTO ingredients(formula_id,herb_id) VALUES(?,?)').run(id,herb);
  }
  for(const [id] of [...herbs,...formulas]) db.prepare('INSERT INTO sources(record_id,field,url,status) VALUES(?,?,?,?)').run(id,'Źródło referencyjne projektu — nie potwierdzenie danych rekordu','https://www.americandragon.com/','niezweryfikowane');
  db.prepare("INSERT INTO metadata VALUES('seed-v1',?)").run(new Date().toISOString());
  db.exec('COMMIT');
 } catch(e) { db.exec('ROLLBACK'); throw e; }
}
// Undoes the unreviewed American Dragon import once, keeping the sample records and their edits.
if (db.prepare('SELECT 1 FROM metadata WHERE key=?').get(rollback.importMarker) && !db.prepare('SELECT 1 FROM metadata WHERE key=?').get(rollback.rollbackMarker)) {
 db.exec('BEGIN');
 try {
  const added=JSON.stringify(rollback.addedRecordIds),merged=JSON.stringify(rollback.mergedRecordIds);
  db.prepare('DELETE FROM ingredients WHERE formula_id IN (SELECT value FROM json_each(?)) OR herb_id IN (SELECT value FROM json_each(?))').run(added,added);
  db.prepare('DELETE FROM record_terms WHERE record_id IN (SELECT value FROM json_each(?))').run(added);
  db.prepare('DELETE FROM sources WHERE record_id IN (SELECT value FROM json_each(?)) OR (record_id IN (SELECT value FROM json_each(?)) AND field=?)').run(added,merged,rollback.importedSourceField);
  db.prepare('DELETE FROM records WHERE id IN (SELECT value FROM json_each(?))').run(added);
  for(const id of rollback.mergedRecordIds){
   const row=db.prepare('SELECT notes,translation FROM records WHERE id=?').get(id) as {notes:string;translation:string}|undefined;
   if(row) db.prepare("UPDATE records SET status='demonstracyjne',notes=?,translation=? WHERE id=?").run(row.notes.split(rollback.notesSeparator)[0],row.translation===(rollback.mergedTranslations[id]||'')?'':row.translation,id);
   for(const t of rollback.importedTermsToDetach(id)) db.prepare('DELETE FROM record_terms WHERE record_id=? AND term_id=(SELECT id FROM terms WHERE dimension=? AND label=?)').run(id,t.dimension,t.label);
  }
  for(const t of rollback.importedOnlyTerms) db.prepare('DELETE FROM terms WHERE dimension=? AND label=? AND NOT EXISTS(SELECT 1 FROM record_terms WHERE term_id=terms.id)').run(t.dimension,t.label);
  db.prepare('INSERT INTO metadata VALUES(?,?)').run(rollback.rollbackMarker,new Date().toISOString());
  db.exec('COMMIT');
 } catch(e) { db.exec('ROLLBACK'); throw e; }
}
export function dictionary():Term[] {return db.prepare('SELECT * FROM terms ORDER BY dimension,label').all() as unknown as Term[];}
export function records({ids}:{light?:boolean;ids?:string[]}={}):RecordData[] {
 return (db.prepare('SELECT * FROM records ORDER BY name').all() as unknown as Omit<RecordData,'terms'|'ingredients'|'related'|'sources'|'source'>[]).filter(r=>!ids||ids.includes(r.id)).map(r=>({...r,
  terms:(db.prepare('SELECT t.*,rt.by_user FROM terms t JOIN record_terms rt ON rt.term_id=t.id WHERE rt.record_id=? ORDER BY t.label').all(r.id) as unknown as (Term&{by_user:number})[]).map(({by_user,...t})=>({...t,byUser:!!by_user})),
  ingredients:db.prepare('SELECT r.id,r.name,i.quantity,i.role,i.preparation FROM ingredients i JOIN records r ON r.id=i.herb_id WHERE formula_id=? ORDER BY r.name').all(r.id) as RecordData['ingredients'],
  related:db.prepare('SELECT r.id,r.name FROM ingredients i JOIN records r ON r.id=i.formula_id WHERE herb_id=? ORDER BY r.name').all(r.id) as RecordData['related'],
  sources:db.prepare('SELECT url,field,status,checked_at FROM sources WHERE record_id=?').all(r.id) as RecordData['sources'],
 }));
}
export function updateRecord(id:string, data:{name:string;translation:string;notes:string;termIds:number[]}) {
 if(!db.prepare('SELECT id FROM records WHERE id=?').get(id)) throw new Error('Brak rekordu');
 db.exec('BEGIN');
 try {
  db.prepare('UPDATE records SET name=?,translation=?,notes=? WHERE id=?').run(data.name,data.translation,data.notes,id);
  db.prepare('DELETE FROM record_terms WHERE record_id=? AND by_user=1').run(id);
  for(const termId of new Set(data.termIds)) db.prepare('INSERT OR IGNORE INTO record_terms(record_id,term_id,by_user) VALUES(?,?,1)').run(id,termId);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function updateTerm(id:number,label:string,synonyms:string){db.prepare('UPDATE terms SET label=?,synonyms=? WHERE id=?').run(label,synonyms,id);}
export function createTerm(dimension:string,label:string,synonyms:string){db.prepare('INSERT INTO terms(dimension,label,synonyms) VALUES(?,?,?)').run(dimension,label,synonyms);}
function transaction(fn:()=>void){db.exec('BEGIN');try{fn();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
export function addTag(id:string,dimension:string,label:string){if(!db.prepare('SELECT id FROM records WHERE id=?').get(id))throw new Error('Brak rekordu');transaction(()=>{db.prepare('INSERT OR IGNORE INTO terms(dimension,label) VALUES(?,?)').run(dimension,label);db.prepare('INSERT OR IGNORE INTO record_terms(record_id,term_id,by_user) VALUES(?,(SELECT id FROM terms WHERE dimension=? AND label=?),1)').run(id,dimension,label);});}
export function removeTag(id:string,termId:number){transaction(()=>{db.prepare('DELETE FROM record_terms WHERE record_id=? AND term_id=? AND by_user=1').run(id,termId);db.prepare("DELETE FROM terms WHERE id=? AND dimension='mine' AND NOT EXISTS(SELECT 1 FROM record_terms WHERE term_id=terms.id)").run(termId);});}
export function setUserNote(id:string,text:string){if(!db.prepare('UPDATE records SET user_notes=? WHERE id=?').run(text,id).changes)throw new Error('Brak rekordu');}
export function products():Product[]{return (db.prepare('SELECT id,name,tags,link,notes FROM products ORDER BY lower(name),id').all() as unknown as (Omit<Product,'tags'>&{tags:string})[]).map(p=>({...p,tags:JSON.parse(p.tags)}));}
export function saveProduct(p:Omit<Product,'id'>&{id?:number}){const tags=JSON.stringify(p.tags);if(p.id){if(!db.prepare('UPDATE products SET name=?,tags=?,link=?,notes=? WHERE id=?').run(p.name,tags,p.link,p.notes,p.id).changes)throw new Error('Brak produktu');}else db.prepare('INSERT INTO products(name,tags,link,notes) VALUES(?,?,?,?)').run(p.name,tags,p.link,p.notes);}
export function deleteProduct(id:number){db.prepare('DELETE FROM products WHERE id=?').run(id);}
export function deleteTag(termId:number){transaction(()=>{db.prepare("DELETE FROM record_terms WHERE term_id=(SELECT id FROM terms WHERE id=? AND dimension='mine')").run(termId);db.prepare("DELETE FROM terms WHERE id=? AND dimension='mine'").run(termId);});}
export const dimensions:Record<string,string>={category:'Kategoria',thermal:'Termika',taste:'Smak',channel:'Kanał',organ:'Narząd',action:'Działanie TCM',direction:'Kierunek działania',pattern:'Wzorzec TCM',symptom:'Objaw',indication:'Wskazanie',contraindication:'Przeciwwskazanie'};
