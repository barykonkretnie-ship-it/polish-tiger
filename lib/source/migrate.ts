// Applies db/migrations/*.sql in order, once each, recording them in polish_tiger_source.schema_migrations.
import type postgres from 'postgres';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export async function migrate(sql:postgres.Sql,dir=path.join(import.meta.dirname,'..','..','db','migrations')){
 const applied:string[]=[];
 await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(71482027)`;
  await tx`CREATE SCHEMA IF NOT EXISTS polish_tiger_source`;
  await tx`CREATE TABLE IF NOT EXISTS polish_tiger_source.schema_migrations(name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  const done=new Map((await tx`SELECT name,checksum FROM polish_tiger_source.schema_migrations`).map(r=>[r.name as string,r.checksum as string]));
  for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){
   const text=readFileSync(path.join(dir,file),'utf8'),checksum=createHash('sha256').update(text).digest('hex');
   if(done.has(file)){
    if(done.get(file)!==checksum)throw new Error(`Migracja ${file} została zmieniona po zastosowaniu. Dodaj nową migrację zamiast edytować starą.`);
    continue;
   }
   await tx.unsafe(text);
   await tx`SET search_path TO DEFAULT`;
   await tx`INSERT INTO polish_tiger_source.schema_migrations(name,checksum) VALUES(${file},${checksum})`;
   applied.push(file);
  }
 });
 return applied;
}
