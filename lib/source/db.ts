// Database connections for the importer and migrations. Where outbound traffic must go through an HTTP proxy
// (HTTPS_PROXY), Postgres runs through a CONNECT tunnel; TLS is still negotiated end to end with the database.
import postgres from 'postgres';
import http from 'node:http';
import type {Socket} from 'node:net';

const LOOPBACK=['127.0.0.1','localhost','[::1]','::1'];

function bypassed(host:string,noProxy=process.env.NO_PROXY||process.env.no_proxy||''){
 return LOOPBACK.includes(host)||noProxy.split(',').map(s=>s.trim()).filter(Boolean).some(rule=>rule==='*'||host===rule.replace(/^\*?\./,'')||host.endsWith(rule.startsWith('.')?rule:'.'+rule.replace(/^\*\./,'')));
}

/** Opens a raw TCP tunnel to host:port through an HTTP proxy. */
export function tunnel(proxy:string,host:string,port:number):Promise<Socket>{
 const p=new URL(proxy);
 return new Promise((resolve,reject)=>{
  const auth=p.username?{'Proxy-Authorization':'Basic '+Buffer.from(`${decodeURIComponent(p.username)}:${decodeURIComponent(p.password)}`).toString('base64')}:{};
  const req=http.request({host:p.hostname,port:Number(p.port)||80,method:'CONNECT',path:`${host}:${port}`,headers:{Host:`${host}:${port}`,...auth}});
  req.once('connect',(res,socket)=>{
   if(res.statusCode===200)resolve(socket);
   else{socket.destroy();reject(new Error(`Proxy odrzucił tunel do ${host}:${port} (HTTP ${res.statusCode}).`));}
  });
  req.once('error',reject);
  req.setTimeout(15000,()=>req.destroy(new Error('Przekroczono czas zestawiania tunelu przez proxy.')));
  req.end();
 });
}

/** Connection for scripts. Loopback test databases may skip TLS only with POLISH_TIGER_DATABASE_SSL=local-test. */
export function connect(url:string,env:Record<string,string|undefined>=process.env){
 const u=new URL(url),host=u.hostname.replace(/^\[|\]$/g,''),port=Number(u.port)||5432;
 const local=env.POLISH_TIGER_DATABASE_SSL==='local-test'&&LOOPBACK.includes(u.hostname);
 const proxy=env.HTTPS_PROXY||env.https_proxy;
 const viaProxy=!!proxy&&!bypassed(host,env.NO_PROXY||env.no_proxy||'');
 return postgres(url,{
  // Custom sockets give postgres.js no host for SNI, which Neon needs for routing; pass it explicitly.
  ssl:local?false:{rejectUnauthorized:true,servername:host},
  max:1,onnotice:()=>{},prepare:false,connect_timeout:30,
  ...(viaProxy?{socket:()=>tunnel(proxy!,host,port)}:{}),
 });
}
