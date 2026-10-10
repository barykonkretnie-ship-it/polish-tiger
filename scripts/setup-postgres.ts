import {initializePostgres,records,closeDatabase} from '../lib/db-postgres';
try{
 await initializePostgres();
 const all=await records();
 const herbs=all.filter(r=>r.kind==='herb').length,formulas=all.filter(r=>r.kind==='formula').length;
 if(herbs!==20||formulas!==10)throw new Error('Unexpected prototype record counts');
 console.log(`PostgreSQL gotowy: ${herbs} ziół i ${formulas} formuł. Istniejące edycje zachowane.`);
}catch{console.error('Nie udało się przygotować PostgreSQL. Sprawdź połączenie, TLS, uprawnienia i stan schematu polish_tiger. Sekrety nie są wypisywane.');process.exitCode=1;}
finally{await closeDatabase();}
