// Applies source-layer migrations. Usage: npm run db:migrate (reads MIGRATION_DATABASE_URL, falls back to DATABASE_URL).
import postgres from 'postgres';
import {migrate} from '../lib/source/migrate';

const url=process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL;
if(!url){console.error('Ustaw MIGRATION_DATABASE_URL (lub DATABASE_URL).');process.exit(1);}
const local=process.env.POLISH_TIGER_DATABASE_SSL==='local-test'&&['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname);
const sql=postgres(url,{ssl:local?false:{rejectUnauthorized:true},max:1,onnotice:()=>{}});
try{
 const applied=await migrate(sql);
 for(const f of applied)console.log('Zastosowano',f);
 console.log('Schemat polish_tiger_source jest aktualny.');
}catch(error){console.error('Migracja nie powiodła się:',error instanceof Error?error.message:error);process.exitCode=1;}
finally{await sql.end();}
