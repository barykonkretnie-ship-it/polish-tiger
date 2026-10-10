import {initializePostgres,records,closeDatabase} from '../lib/db-postgres';
import {herbs as sampleHerbs,formulas as sampleFormulas} from '../lib/sample';
import {importedRecords} from '../lib/americandragon';
try{
 await initializePostgres();
 const all=await records();
 const herbs=all.filter(r=>r.kind==='herb').length,formulas=all.filter(r=>r.kind==='formula').length;
 const expected=(kind:string,sample:string[][])=>new Set([...sample.map(r=>r[0]),...importedRecords.filter(r=>r.kind===kind).map(r=>r.id)]).size;
 if(herbs!==expected('herb',sampleHerbs)||formulas!==expected('formula',sampleFormulas))throw new Error('Unexpected record counts');
 console.log(`PostgreSQL gotowy: ${herbs} ziół i ${formulas} formuł. Istniejące edycje zachowane.`);
}catch{console.error('Nie udało się przygotować PostgreSQL. Sprawdź połączenie, TLS, uprawnienia i stan schematu polish_tiger. Sekrety nie są wypisywane.');process.exitCode=1;}
finally{await closeDatabase();}
