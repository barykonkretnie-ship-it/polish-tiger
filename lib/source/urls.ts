// URL discovery and canonicalization for American Dragon index pages.
import * as cheerio from 'cheerio';
import {clean} from './html';

export const INDEX_PAGES=[
 {path:'IndividualHerbsIndex2.html',type:'herb' as const,folder:'Individualherbsupdate/'},
 {path:'HerbFormulaIndexA-G.html',type:'formula' as const,folder:'Herb Formulas copy/'},
 {path:'HerbFormulaIndexH-N.html',type:'formula' as const,folder:'Herb Formulas copy/'},
 {path:'HerbFormulaIndexO-T.html',type:'formula' as const,folder:'Herb Formulas copy/'},
 {path:'HerbFormulaIndexU-Z.html',type:'formula' as const,folder:'Herb Formulas copy/'},
];

/** One spelling per page: absolute https URL on the source host, resolved path, spaces encoded, no query or fragment. */
export function canonicalUrl(href:string,base:string){
 const u=new URL(decodeURI(href.trim()).replace(/\\/g,'/'),base);
 u.protocol='https:';u.hash='';u.search='';
 if(u.hostname==='americandragon.com')u.hostname='www.americandragon.com';
 u.pathname=u.pathname.split('/').map(p=>encodeURIComponent(decodeURIComponent(p))).join('/');
 return u.toString();
}

export type Discovered={url:string;original:string;label:string;type:'herb'|'formula'};

/** Card links listed on an index page; anything outside the card folder is skipped. */
export function discoverLinks(html:string,indexUrl:string,type:'herb'|'formula',folder:string,sourceOrigin:string){
 const $=cheerio.load(html);
 const found:Discovered[]=[],skipped:string[]=[];
 const folderPath='/'+encodeURI(folder);
 $('a[href]').each((_,a)=>{
  const href=$(a).attr('href')!;
  let url:string;
  try{url=canonicalUrl(href,indexUrl);}catch{skipped.push(href);return;}
  if(new URL(url).origin!==sourceOrigin||!new URL(url).pathname.startsWith(folderPath)){skipped.push(href);return;}
  found.push({url,original:href,label:clean($(a).text()),type});
 });
 return {found,skipped};
}
