import { NextRequest,NextResponse } from 'next/server';
import {createHmac} from 'node:crypto';
import { authorized,equal,token,configured,configurationIssues } from '../../../lib/auth';
import { updateRecord,updateTerm,createTerm,addTag,removeTag,deleteTag,setUserNote,recordById,products,saveProduct,deleteProduct,dictionary,dimensions } from '../../../lib/db';
export async function GET(){return NextResponse.json({authenticated:await authorized(),configured:configured(),configurationIssues:configurationIssues()});}
export async function POST(req:NextRequest){
 let sameOrigin=false;
 try {const origin=new URL(req.headers.get('origin')||'');sameOrigin=['http:','https:'].includes(origin.protocol)&&origin.host===req.headers.get('host');}catch{}
 if(!sameOrigin) return NextResponse.json({error:'Niedozwolone pochodzenie żądania'},{status:403});
 let data;try{data=await req.json();}catch{return NextResponse.json({error:'Nieprawidłowe dane'},{status:400});}
 if(data.action==='login'){
  const password=process.env.POLISH_TIGER_ADMIN_PASSWORD;
  if(configured()&&(process.env.VERCEL||process.env.POLISH_TIGER_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL)){
   try{
    const {allowLoginAttempt}=await import('../../../lib/db-postgres');
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
    const key=createHmac('sha256',process.env.POLISH_TIGER_SESSION_SECRET||password!).update(ip).digest('hex');
    if(!await allowLoginAttempt(key))return NextResponse.json({error:'Zbyt wiele prób. Spróbuj za 15 minut.'},{status:429});
   }catch{return NextResponse.json({error:'Logowanie jest chwilowo niedostępne.'},{status:503});}
  }
  if(!configured()||!password||typeof data.password!=='string'||!equal(data.password,password))return NextResponse.json({error:'Nieprawidłowe hasło lub panel nieskonfigurowany'},{status:401});
  const res=NextResponse.json({ok:true});res.cookies.set('pt_admin',token(password),{httpOnly:true,sameSite:'strict',secure:!!process.env.VERCEL||req.nextUrl.protocol==='https:',path:'/',maxAge:3600});return res;
 }
 if(!await authorized())return NextResponse.json({error:'Wymagane logowanie'},{status:401});
 if(data.action==='logout'){const res=NextResponse.json({ok:true});res.cookies.delete('pt_admin');return res;}
 try{
  if(data.action==='record'){
   if(typeof data.id!=='string'||typeof data.name!=='string'||!data.name.trim()||data.name.length>200||typeof data.translation!=='string'||data.translation.length>300||typeof data.notes!=='string'||data.notes.length>10000||!Array.isArray(data.termIds)||!data.termIds.every((v:unknown)=>Number.isInteger(v)))throw Error('Nieprawidłowe pola rekordu');
   await updateRecord(data.id,{name:data.name.trim(),translation:data.translation,notes:data.notes,termIds:data.termIds});
  }else if(data.action==='term'){
   if(!Number.isInteger(data.id)||typeof data.label!=='string'||!data.label.trim()||data.label.length>200||typeof data.synonyms!=='string'||data.synonyms.length>1000)throw Error('Nieprawidłowy termin');
   if(data.id===0){if(typeof data.dimension!=='string'||!Object.hasOwn(dimensions,data.dimension))throw Error('Nieprawidłowy wymiar');await createTerm(data.dimension,data.label.trim(),data.synonyms);}
   else await updateTerm(data.id,data.label.trim(),data.synonyms);
  }else if(data.action==='tag-add'){
   const dimension=data.dimension??'mine';
   if(typeof data.id!=='string'||typeof dimension!=='string'||!Object.hasOwn(dimensions,dimension)||typeof data.label!=='string'||!data.label.trim()||data.label.trim().length>200)throw Error('Nieprawidłowy znacznik');
   await addTag(data.id,dimension,data.label.trim().replace(/\s+/g,' '));
  }else if(data.action==='tag-remove'){
   if(typeof data.id!=='string'||!Number.isInteger(data.termId))throw Error('Nieprawidłowy znacznik');
   await removeTag(data.id,data.termId);
  }else if(data.action==='tag-delete'){
   if(!Number.isInteger(data.termId))throw Error('Nieprawidłowy znacznik');
   await deleteTag(data.termId);
  }else if(data.action==='note'){
   if(typeof data.id!=='string'||typeof data.text!=='string'||data.text.length>10000)throw Error('Nieprawidłowa uwaga');
   await setUserNote(data.id,data.text.trim());
  }else if(data.action==='product-save'){
   const ok=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
   if((data.id!==undefined&&!Number.isInteger(data.id))||!ok(data.name,200)||!data.name.trim()||!Array.isArray(data.tags)||data.tags.length>50||!data.tags.every((t:unknown)=>ok(t,100))||!ok(data.link,2000)||!ok(data.notes,10000))throw Error('Nieprawidłowy produkt');
   const link=data.link.trim();if(link&&!/^https?:\/\//i.test(link))throw Error('Link musi zaczynać się od http:// lub https://');
   await saveProduct({id:data.id,name:data.name.trim(),tags:[...new Set<string>(data.tags.map((t:string)=>t.trim().replace(/\s+/g,' ')).filter(Boolean))],link,notes:data.notes.trim()});
   return NextResponse.json({ok:true,products:await products()});
  }else if(data.action==='product-delete'){
   if(!Number.isInteger(data.id))throw Error('Nieprawidłowy produkt');
   await deleteProduct(data.id);return NextResponse.json({ok:true,products:await products()});
  }else throw Error('Nieznana operacja');
  // The whole atlas is too large for a function response; the client patches its copy from the changed record.
  return NextResponse.json({ok:true,record:typeof data.id==='string'?await recordById(data.id):null,dictionary:await dictionary()});
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.message.startsWith('Link')?e.message:'Nie udało się zapisać. Sprawdź pola i unikalność terminów.'},{status:400});}
}
