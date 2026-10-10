// HTML helpers shared by the American Dragon parsers.
import type {CheerioAPI} from 'cheerio';
import type {AnyNode,Element} from 'domhandler';

const BLOCK=new Set(['p','div','li','tr','td','th','table','tbody','thead','h1','h2','h3','h4','h5','h6','ul','ol','blockquote','body','center']);

export function clean(text:string){
 let s=text.replace(/ /g,' ').replace(/\s+/g,' ').trim();
 // The site splits words inside styled spans ("r egulates", "Y ang"); rejoin a lone letter with the lowercase rest of its word.
 s=s.replace(/\b([B-HJ-Zb-z]) (?=[a-z]{2,})/g,'$1');
 return s.replace(/\s+([.,;:])/g,'$1');
}

/** Text lines of a node, broken only at block elements and <br>, so inline spans stay on one line. */
export function lines(node:AnyNode):string[]{
 const out:string[]=[];let buffer='';
 const flush=()=>{const l=clean(buffer);buffer='';if(l)out.push(l);};
 const walk=(n:AnyNode)=>{
  for(const child of (n as Element).children||[]){
   if(child.type==='text'){buffer+=(child as unknown as {data:string}).data;continue;}
   if(child.type!=='tag')continue;
   const name=(child as Element).name;
   if(name==='script'||name==='style')continue;
   if(name==='br'){flush();continue;}
   if(BLOCK.has(name)){flush();walk(child);flush();}else walk(child);
  }
 };
 walk(node);flush();
 return out;
}

/** A table as a full grid: rowspan/colspan cells repeat in every slot they cover. */
export function grid($:CheerioAPI,table:Element):Element[][]{
 const rows=$(table).children('tbody').length?$(table).children('tbody').children('tr').toArray():$(table).children('tr').toArray();
 const out:Element[][]=[];
 rows.forEach((row,r)=>{
  out[r]??=[];
  let c=0;
  for(const cell of $(row).children('td,th').toArray()){
   while(out[r][c])c++;
   const rs=Math.max(1,Number($(cell).attr('rowspan'))||1),cs=Math.max(1,Number($(cell).attr('colspan'))||1);
   for(let i=0;i<rs;i++)for(let j=0;j<cs;j++){(out[r+i]??=[])[c+j]=cell;}
   c+=cs;
  }
 });
 return out;
}

export function cjk(text:string){return text.match(/[㐀-鿿]+/)?.[0]||'';}

/** Stable application id from a Pinyin name: "Bai Shao (Yao)" -> "bai-shao". */
export function slug(name:string){
 return name.replace(/\(.*?\)/g,'').replace(/[㐀-鿿].*$/,'').normalize('NFKD').replace(/[̀-ͯ]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
