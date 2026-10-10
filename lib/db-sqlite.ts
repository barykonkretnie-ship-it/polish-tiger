import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { herbs, formulas } from './sample';

import type { Term, RecordData } from './types';
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
function attach(id:string, dimension:string, labels:string) {
 for(const label of labels.split(',').filter(Boolean)) {
  db.prepare('INSERT OR IGNORE INTO terms(dimension,label) VALUES(?,?)').run(dimension,label);
  db.prepare('INSERT OR IGNORE INTO record_terms VALUES(?,(SELECT id FROM terms WHERE dimension=? AND label=?))').run(id,dimension,label);
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
export function dictionary():Term[] {return db.prepare('SELECT * FROM terms ORDER BY dimension,label').all() as Term[];}
export function records():RecordData[] {
 return (db.prepare('SELECT * FROM records ORDER BY name').all() as Omit<RecordData,'terms'|'ingredients'|'related'|'sources'>[]).map(r=>({...r,
  terms:db.prepare('SELECT t.* FROM terms t JOIN record_terms rt ON rt.term_id=t.id WHERE rt.record_id=? ORDER BY t.label').all(r.id) as Term[],
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
  db.prepare('DELETE FROM record_terms WHERE record_id=?').run(id);
  for(const termId of new Set(data.termIds)) db.prepare('INSERT INTO record_terms VALUES(?,?)').run(id,termId);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function updateTerm(id:number,label:string,synonyms:string){db.prepare('UPDATE terms SET label=?,synonyms=? WHERE id=?').run(label,synonyms,id);}
export function createTerm(dimension:string,label:string,synonyms:string){db.prepare('INSERT INTO terms(dimension,label,synonyms) VALUES(?,?,?)').run(dimension,label,synonyms);}
export const dimensions:Record<string,string>={category:'Kategoria',thermal:'Termika',taste:'Smak',channel:'Kanał',organ:'Narząd',action:'Działanie TCM',direction:'Kierunek działania',pattern:'Wzorzec TCM',symptom:'Objaw',indication:'Wskazanie',contraindication:'Przeciwwskazanie'};
