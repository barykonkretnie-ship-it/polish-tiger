// Polite sequential fetching: fixed delay between requests, conditional requests, bounded retries
// that honour Retry-After on 429/5xx. Never runs requests in parallel.
import {createHash} from 'node:crypto';

export type FetchResult={status:number; finalUrl:string; attempts:number; body:string|null; hash:string|null; headers:Record<string,string>; encoding?:string; error?:string};
export type FetchLike=(url:string,init:{headers:Record<string,string>;redirect:'follow';signal:AbortSignal})=>Promise<Response>;
const KEEP=['etag','last-modified','content-type','cache-control','retry-after','content-length'];

export class PoliteFetcher{
 private last=0;
 constructor(private options:{delaySeconds:number;maxRetries:number;userAgent:string;fetch?:FetchLike;sleep?:(ms:number)=>Promise<void>;timeoutMs?:number}){}
 private sleep(ms:number){return this.options.sleep?this.options.sleep(ms):new Promise<void>(r=>setTimeout(r,ms));}
 private async pace(){const wait=this.last+this.options.delaySeconds*1000-Date.now();if(wait>0)await this.sleep(wait);this.last=Date.now();}

 async get(url:string,conditional:{etag?:string|null;lastModified?:string|null}={}):Promise<FetchResult>{
  const doFetch=this.options.fetch||(fetch as unknown as FetchLike);
  const headers:Record<string,string>={'User-Agent':this.options.userAgent,'Accept':'text/html'};
  if(conditional.etag)headers['If-None-Match']=conditional.etag;
  if(conditional.lastModified)headers['If-Modified-Since']=conditional.lastModified;
  let attempts=0,lastError='';
  while(attempts<=this.options.maxRetries){
   attempts++;
   await this.pace();
   try{
    const response=await doFetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(this.options.timeoutMs??30000)});
    const kept=Object.fromEntries(KEEP.flatMap(k=>{const v=response.headers.get(k);return v?[[k,v]]:[];}));
    if(response.status===429||response.status>=500){
     lastError=`HTTP ${response.status}`;
     if(attempts>this.options.maxRetries)return {status:response.status,finalUrl:response.url||url,attempts,body:null,hash:null,headers:kept,error:lastError};
     await this.sleep(retryAfterMs(response.headers.get('retry-after'))??this.options.delaySeconds*1000*2**attempts);
     continue;
    }
    if(response.status===304)return {status:304,finalUrl:response.url||url,attempts,body:null,hash:null,headers:kept};
    const buffer=Buffer.from(await response.arrayBuffer());
    const {text,encoding}=decode(buffer);
    return {status:response.status,finalUrl:response.url||url,attempts,body:response.ok?text:null,hash:response.ok?createHash('sha256').update(buffer).digest('hex'):null,headers:kept,encoding,error:response.ok?undefined:`HTTP ${response.status}`};
   }catch(error){
    lastError=error instanceof Error?error.message:String(error);
    if(attempts>this.options.maxRetries)break;
    await this.sleep(this.options.delaySeconds*1000*2**attempts);
   }
  }
  return {status:0,finalUrl:url,attempts,body:null,hash:null,headers:{},error:lastError};
 }
}

export function retryAfterMs(value:string|null){
 if(!value)return null;
 if(/^\d+$/.test(value))return Math.min(Number(value),3600)*1000;
 const at=Date.parse(value);return Number.isNaN(at)?null:Math.max(0,Math.min(at-Date.now(),3600_000));
}

// Pages declare iso-8859-1 but are almost all UTF-8 (with Chinese characters); a few are not.
// Strict UTF-8 first, then Windows-1252; callers report the fallback for review.
export function decode(buffer:Uint8Array){
 try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(buffer),encoding:'utf-8'};}
 catch{return {text:new TextDecoder('windows-1252').decode(buffer),encoding:'windows-1252'};}
}
