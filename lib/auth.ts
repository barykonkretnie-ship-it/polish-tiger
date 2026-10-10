import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
function secret(password:string){return process.env.POLISH_TIGER_SESSION_SECRET||password;}
export function privateAccess(){return !!process.env.VERCEL||process.env.POLISH_TIGER_PRIVATE_ACCESS==='true';}
export function configurationIssues(){
 const issues:string[]=[];
 const password=process.env.POLISH_TIGER_ADMIN_PASSWORD,sessionSecret=process.env.POLISH_TIGER_SESSION_SECRET;
 if(!password)issues.push('Brakuje zmiennej POLISH_TIGER_ADMIN_PASSWORD w tym wdrożeniu.');
 else if(process.env.VERCEL&&password.length<16)issues.push('POLISH_TIGER_ADMIN_PASSWORD ma mniej niż wymagane 16 znaków.');
 if(process.env.VERCEL){
  if(!sessionSecret)issues.push('Brakuje zmiennej POLISH_TIGER_SESSION_SECRET w tym wdrożeniu.');
  else if(sessionSecret.length<32)issues.push('POLISH_TIGER_SESSION_SECRET ma mniej niż wymagane 32 znaki.');
 }
 return issues;
}
export function configured(){return configurationIssues().length===0;}
export function token(password:string){const expires=String(Math.floor(Date.now()/1000)+3600);return expires+'.'+createHmac('sha256',secret(password)).update('polish-tiger-admin-v2:'+expires).digest('hex');}
export function verifyToken(value:string,password:string){const [expires,signature,...extra]=value.split('.');if(extra.length||!/^\d+$/.test(expires)||Number(expires)<=Date.now()/1000||Number(expires)>Date.now()/1000+3601)return false;const expected=createHmac('sha256',secret(password)).update('polish-tiger-admin-v2:'+expires).digest('hex');return equal(signature||'',expected);}
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function authorized(){const password=process.env.POLISH_TIGER_ADMIN_PASSWORD;return configured()&&!!password&&verifyToken((await cookies()).get('pt_admin')?.value||'',password);}
