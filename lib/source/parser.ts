// Parsers for American Dragon herb and formula pages. Each returns structured fields with the source
// excerpt behind every value, plus review issues for anything it could not read with certainty.
import * as cheerio from 'cheerio';
import type {CheerioAPI} from 'cheerio';
import type {Element} from 'domhandler';
import {clean,cjk,grid,lines,slug} from './html';

export const PARSER='americandragon';
export const PARSER_VERSION='1.1.0';

export type Completeness='present'|'missing_in_source'|'unreadable'|'needs_review';
export type Field={name:string; value:unknown; excerpt:string; completeness:Completeness};
export type Issue={field?:string; type:'unknown_section'|'missing_field'|'unreadable'|'ambiguous_value'|'name_mismatch'|'template_variant'; detail:string; excerpt?:string};
export type Tag={axis:'category'|'taste'|'temperature'|'toxicity'|'channel'|'action'|'pattern'|'symptom'|'indication'; label:string; qualifier:'primary'|'secondary'; field:string};
export type Ingredient={position:number; pinyin:string; latin:string; dosage:string; amountMin:number|null; amountMax:number|null; unit:string|null; optional:boolean; notes:string[]};
export type Modification={position:number; condition:string; operation:'add'|'remove'|'other'; ingredient:string; excerpt:string};
export type ParsedHerb={kind:'herb'; id:string; pinyin:string; chinese:string; latin:string; english:string[]; fields:Field[]; tags:Tag[]; issues:Issue[]};
export type ParsedFormula={kind:'formula'; id:string; pinyin:string; chinese:string; english:string; alsoKnownAs:string[]; ingredients:Ingredient[]; modifications:Modification[]; fields:Field[]; tags:Tag[]; issues:Issue[]};
export type Parsed=ParsedHerb|ParsedFormula;

const HERB_SECTIONS=['CATEGORY','PROPERTIES','ACTIONS AND INDICATIONS','CONTRAINDICATIONS, INCOMPATIBILITIES AND HERB/DRUG INTERACTIONS','CONTRAINDICATIONS','INCOMPATIBILITIES','HERB/DRUG INTERACTIONS','MAJOR COMBINATIONS','NOTES'];
const FORMULA_SECTIONS=['HERBS AND ACTIONS','FORMULA ACTIONS','SYNDROMES','CLINICAL MANIFESTATIONS','TREATS','CONTRAINDICATIONS AND HERB/DRUG INTERACTIONS','CONTRAINDICATIONS','HERB/DRUG INTERACTIONS','NOTES','MODIFICATIONS'];
const MAX_EXCERPT=4000;

const heading=(line:string)=>line.replace(/:\s*$/,'').trim();
const excerpt=(parts:string[])=>{const s=parts.join('\n');return s.length>MAX_EXCERPT?s.slice(0,MAX_EXCERPT)+' …':s;};

/** Body text lines between the page heading (INDIVIDUAL HERBS / HERB FORMULAS) and the copyright line. */
function body($:CheerioAPI,marker:string){
 const all=lines($('body')[0]||$.root()[0]);
 const start=all.indexOf(marker),end=all.findIndex(l=>l.startsWith('©'));
 return all.slice(start>=0?start+1:0,end>start?end:undefined);
}

/** Lines of a section: after its heading up to the next known heading. */
function section(text:string[],name:string,known:string[]){
 const i=text.findIndex(l=>heading(l)===name);
 if(i<0)return null;
 const out:string[]=[];
 for(let j=i+1;j<text.length&&!known.includes(heading(text[j]));j++)out.push(text[j]);
 return out;
}

// List sections whose items may be written in capitals (e.g. "COPD" under TREATS); free-text sections are still checked.
const LIST_SECTIONS=['CATEGORY','FORMULA ACTIONS','SYNDROMES','CLINICAL MANIFESTATIONS','TREATS'];
function unknownHeadings(text:string[],known:string[],skip:(l:string)=>boolean):Issue[]{
 const content=new Set(LIST_SECTIONS.flatMap(k=>section(text,k,known)||[]));
 return text.filter(l=>!content.has(l)&&/^[A-Z0-9 ,/&'()\-:]{4,70}$/.test(l)&&/[A-Z]{4}/.test(l)&&!known.includes(heading(l))&&!skip(l))
  .map(l=>({type:'unknown_section',detail:`Nieznany nagłówek sekcji: ${l}`,excerpt:l}));
}

function field(fields:Field[],issues:Issue[],name:string,value:unknown,source:string[]|null,options:{required?:boolean}={}){
 const empty=value==null||(Array.isArray(value)&&value.length===0)||value==='';
 const completeness:Completeness=source===null?'unreadable':empty?'missing_in_source':'present';
 fields.push({name,value:empty?null:value,excerpt:excerpt(source||[]),completeness});
 if(source===null)issues.push({field:name,type:'unreadable',detail:`Nie znaleziono sekcji pola ${name} w szablonie strony.`});
 else if(empty&&options.required)issues.push({field:name,type:'missing_field',detail:`Brak wymaganej wartości ${name}.`});
}

/** "(Acrid)" marks a secondary property on the site; the value is kept as written and tagged as secondary. */
function split(value:string){const secondary=/^\(.*\)$/.test(value.trim());return {label:value.trim().replace(/^\((.*)\)$/,'$1').trim(),qualifier:secondary?'secondary' as const:'primary' as const};}

const TOXIC=/toxic/i;

/** "9g", "4-21g", "(3-5g)", "22,5g", "3-12 Dates" -> numbers and unit; anything else stays unread (null). */
export function parseDosage(raw:string){
 const m=raw.trim().replace(/(\d),(\d)/g,'$1.$2').match(/^\(?\s*(\d+(?:\.\d+)?)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*([a-zA-Z]+)?\s*\)?$/);
 if(!m)return {min:null,max:null,unit:null};
 const min=Number(m[1]),max=m[2]?Number(m[2]):min;
 return {min,max,unit:m[3]?m[3].toLowerCase():null};
}

const titleCase=(s:string)=>s.toLowerCase().replace(/(^|[\s(])([a-z])/g,(_,a,b)=>a+b.toUpperCase());
function pageTitle($:CheerioAPI){return clean($('title').text()).split(' - ').map(s=>s.trim());}

export function parseHerb(html:string,expectedName?:string):ParsedHerb{
 const $=cheerio.load(html);
 const text=body($,'INDIVIDUAL HERBS'),title=pageTitle($);
 const fields:Field[]=[],issues:Issue[]=[],tags:Tag[]=[];
 const nameLine=text.find(l=>l.startsWith('NAME:'))||'';
 // The NAME line is the card's own Pinyin; some titles start with the Latin name instead ("Fr. Corni - …").
 const named=nameLine.replace(/^NAME:\s*/,'').split(/\s+-\s+/)[0].trim();
 const pinyin=!named||slug(named)===slug(title[0]||'')?title[0]||titleCase(named):titleCase(named);
 const chinese=cjk(title.join(' '))||cjk(nameLine);
 field(fields,issues,'pinyin',pinyin,[title.join(' - ')],{required:true});
 field(fields,issues,'chinese',chinese,[nameLine||title.join(' - ')]);
 const latinAt=text.findIndex(l=>l.startsWith('Pharmaceutical Latin'));
 const latin=latinAt>=0?text[latinAt+1]||'':'';
 field(fields,issues,'pharmaceutical_latin',latin,latinAt>=0?text.slice(latinAt,latinAt+2):null,{required:true});
 const englishAt=text.findIndex(l=>l.startsWith('Common English'));
 const english:string[]=[];
 if(englishAt>=0)for(let i=englishAt+1;i<text.length&&!HERB_SECTIONS.includes(heading(text[i]));i++)english.push(text[i]);
 field(fields,issues,'english_names',english,englishAt>=0?text.slice(englishAt,englishAt+1+english.length):null);

 const category=section(text,'CATEGORY',HERB_SECTIONS);
 field(fields,issues,'category',category?.join(' ')||'',category,{required:true});
 if(category?.length)tags.push({axis:'category',label:category.join(' '),qualifier:'primary',field:'category'});

 // Properties: header row (Taste | Temperature | Entering Meridians | Dosage) and one row of values.
 const props=$('table').toArray().find(t=>/Entering Meridians/.test($(t).text()));
 const propNames=['taste','temperature','channels','dosage'];
 if(props){
  const g=grid($,props as Element);
  const header=(g[0]||[]).map(c=>clean($(c).text()));
  if(header.join('|')!=='Taste|Temperature|Entering Meridians|Dosage')issues.push({field:'properties',type:'template_variant',detail:`Nietypowy nagłówek tabeli właściwości: ${header.join(' | ')}`});
  const values=(g[1]||[]).map(c=>lines(c));
  propNames.forEach((name,i)=>{
   const v=values[i]||[];
   field(fields,issues,name,v,[header[i]||name,...v],{required:name!=='dosage'});
   if(name==='dosage')return;
   for(const raw of v){
    const {label,qualifier}=split(raw);
    if(name==='temperature'&&TOXIC.test(label))tags.push({axis:'toxicity',label,qualifier,field:name});
    else tags.push({axis:name==='channels'?'channel':name as Tag['axis'],label,qualifier,field:name});
   }
   const secondary=v.filter(x=>split(x).qualifier==='secondary');
   if(secondary.length)issues.push({field:name,type:'ambiguous_value',detail:`Wartości w nawiasach zapisane jako drugorzędne (do potwierdzenia znaczenia nawiasów): ${secondary.join(', ')}`,excerpt:v.join(', ')});
  });
 }else for(const name of propNames)field(fields,issues,name,[],null,{required:name!=='dosage'});

 // Actions table: each row pairs one action with its indications.
 const actionsTable=$('table').toArray().find(t=>/Indications\/Syndromes/.test($(t).text()));
 const actions:{action:string;indications:string[]}[]=[];const actionExcerpt:string[]=[];
 if(actionsTable){
  for(const row of grid($,actionsTable as Element).slice(1)){
   const [a,b]=[row[0],row[1]];
   if(!a||a===b)continue;
   const action=lines(a).join(' '),indications=b?lines(b):[];
   if(!action&&!indications.length)continue;
   if(!action)issues.push({field:'actions',type:'unreadable',detail:'Wskazania bez działania w tabeli działań.',excerpt:indications.join('; ')});
   actions.push({action,indications});actionExcerpt.push(action,...indications.map(i=>'  '+i));
   if(action)tags.push({axis:'action',label:action.replace(/\.$/,''),qualifier:'primary',field:'actions'});
  }
 }
 field(fields,issues,'actions',actions,actionsTable?actionExcerpt:null,{required:true});

 for(const [name,heading_] of [['contraindications','CONTRAINDICATIONS'],['incompatibilities','INCOMPATIBILITIES'],['interactions','HERB/DRUG INTERACTIONS'],['notes','NOTES']] as const){
  const s=section(text,heading_,HERB_SECTIONS);
  field(fields,issues,name,s||[],s);
 }

 // Major combinations: a grid where a row of herbs is followed by a row of indications, one combination per column.
 const combos:{herbs:string[];indication:string}[]=[];const comboExcerpt:string[]=[];
 const comboHeading=text.findIndex(l=>heading(l)==='MAJOR COMBINATIONS');
 if(comboHeading>=0){
  // Layout tables that wrap the whole page contain section headings and are skipped; a stray inner table inside one cell is fine.
  const table=$('table').toArray().find(t=>{
   const g=grid($,t as Element);return g.length>=2&&g.some(r=>r.some(c=>/\b(Rx|Rz|Fr|Hb|Fol|Flos|Cx|Sm|Ram|Tub|Caulis)\.?\s/.test($(c).text())))&&!/Indications\/Syndromes|Entering Meridians|Pharmaceutical Latin/.test($(t).text())&&!HERB_SECTIONS.some(h=>$(t).text().includes(h));
  });
  if(table){
   const g=grid($,table as Element);
   for(let r=0;r+1<g.length;r+=2){
    const width=Math.max(g[r].length,g[r+1].length);
    for(let c=0;c<width;c++){
     const herbsCell=g[r][c],indCell=g[r+1][c];
     if(!herbsCell||(c>0&&herbsCell===g[r][c-1]))continue;
     const herbs=lines(herbsCell),indication=indCell?lines(indCell).join(' '):'';
     if(!herbs.length&&!indication)continue;
     combos.push({herbs,indication});comboExcerpt.push(herbs.join(' + ')+' → '+indication);
    }
   }
  }else if(section(text,'MAJOR COMBINATIONS',HERB_SECTIONS)?.length)issues.push({field:'combinations',type:'template_variant',detail:'Sekcja MAJOR COMBINATIONS ma treść, ale bez rozpoznawalnej tabeli.'});
 }
 field(fields,issues,'combinations',combos,comboHeading>=0?comboExcerpt:null);

 issues.push(...unknownHeadings(text,HERB_SECTIONS,l=>l.startsWith('NAME:')||l===nameLine));
 if(expectedName&&slug(expectedName)!==slug(pinyin))issues.push({field:'pinyin',type:'name_mismatch',detail:`Nazwa w indeksie „${expectedName}” różni się od nazwy strony „${pinyin}”.`});
 return {kind:'herb',id:slug(expectedName||pinyin),pinyin,chinese,latin,english,fields,tags,issues};
}

export function parseFormula(html:string,expectedName?:string):ParsedFormula{
 const $=cheerio.load(html);
 const text=body($,'HERB FORMULAS').filter(l=>!/^back to herb formulas index/i.test(l)),title=pageTitle($);
 const fields:Field[]=[],issues:Issue[]=[],tags:Tag[]=[];
 const pinyin=title[0]||'',chinese=cjk(title.join(' '));
 field(fields,issues,'pinyin',pinyin,[title.join(' - ')],{required:true});
 field(fields,issues,'chinese',chinese,[title.join(' - ')]);
 const labelled=(label:string)=>{const i=text.findIndex(l=>l.startsWith(label));if(i<0)return null;const out:string[]=[];for(let j=i+1;j<text.length&&!/^(English|Also Known As):/.test(text[j])&&!FORMULA_SECTIONS.includes(heading(text[j]));j++)out.push(text[j]);return out;};
 const english=labelled('English:'),aka=labelled('Also Known As:');
 field(fields,issues,'english_name',english?.join(' ')||'',english);
 field(fields,issues,'also_known_as',aka||[],aka);

 // Ingredients: Pharmaceutical Latin | Pin Yin | Dosage | Actions, in source order.
 const table=$('table').toArray().find(t=>{const s=$(t).text();return /Pharmaceutical Latin/.test(s)&&/Pin Yin/.test(s)&&/Dosage/.test(s)&&!$(t).find('table').length;});
 const ingredients:Ingredient[]=[];const ingExcerpt:string[]=[];
 if(table){
  const g=grid($,table as Element);
  const header=(g[0]||[]).map(c=>clean($(c).text()));
  if(header.slice(0,3).join('|')!=='Pharmaceutical Latin|Pin Yin|Dosage')issues.push({field:'ingredients',type:'template_variant',detail:`Nietypowy nagłówek tabeli składu: ${header.join(' | ')}`});
  g.slice(1).forEach((row,r)=>{
   const prev=g[r];// g.slice(1)[r] has its previous row at g[r]
   if(!row[1]||row[1]===prev?.[1])return;// continuation of a rowspan
   const latin=lines(row[0]).join(' '),pinyinRaw=lines(row[1]).join(' '),dosage=row[2]?lines(row[2]).join(' '):'';
   if(!latin&&!pinyinRaw)return;
   const optional=/^\(.*\)$/.test(pinyinRaw);
   const d=parseDosage(dosage);
   if(dosage&&d.min===null)issues.push({field:'ingredients',type:'unreadable',detail:`Nie odczytano dawki „${dosage}” dla ${pinyinRaw}; zachowano tekst źródłowy.`,excerpt:dosage});
   if(!dosage)issues.push({field:'ingredients',type:'missing_field',detail:`Brak dawki dla ${pinyinRaw} w źródle.`});
   ingredients.push({position:ingredients.length+1,pinyin:pinyinRaw,latin,dosage,amountMin:d.min,amountMax:d.max,unit:d.unit,optional,notes:row[3]&&row[3]!==row[2]?lines(row[3]):[]});
   ingExcerpt.push([latin,pinyinRaw,dosage].join(' | '));
  });
 }
 field(fields,issues,'ingredients',ingredients,table?ingExcerpt:null,{required:true});

 for(const [name,heading_,axis] of [['formula_actions','FORMULA ACTIONS','action'],['syndromes','SYNDROMES','pattern'],['treats','TREATS','indication']] as const){
  const s=section(text,heading_,FORMULA_SECTIONS);
  field(fields,issues,name,s||[],s,{required:name!=='treats'});
  for(const l of s||[])tags.push({axis,label:l.replace(/\.$/,''),qualifier:'primary',field:name});
 }
 // Clinical manifestations; "T:", "C:" and "P:" lines are tongue, coating and pulse.
 const cm=section(text,'CLINICAL MANIFESTATIONS',FORMULA_SECTIONS);
 const symptoms=(cm||[]).filter(l=>!/^[TCP]:/.test(l));
 field(fields,issues,'manifestations',symptoms,cm);
 for(const [name,prefix] of [['tongue','T:'],['coating','C:'],['pulse','P:']] as const){
  const l=(cm||[]).filter(x=>x.startsWith(prefix)).map(x=>x.slice(2).trim());
  field(fields,issues,name,l,cm?(cm.filter(x=>x.startsWith(prefix))):null);
 }
 for(const l of symptoms)tags.push({axis:'symptom',label:l.replace(/\.$/,''),qualifier:'primary',field:'manifestations'});
 for(const [name,heading_] of [['contraindications','CONTRAINDICATIONS'],['interactions','HERB/DRUG INTERACTIONS'],['notes','NOTES']] as const){
  const s=section(text,heading_,FORMULA_SECTIONS);field(fields,issues,name,s||[],s);
 }

 // Modifications: rows of "For …:" conditions (one per column group) followed by "+ Latin | Pinyin" rows under each.
 const modifications:Modification[]=[];
 const modHeading=text.findIndex(l=>heading(l)==='MODIFICATIONS');
 if(modHeading>=0){
  const modTable=$('table').toArray().filter(t=>!$(t).find('table').length).find(t=>/(^|\s)For\s/.test($(t).text())&&/(^|\s)[+−–-]\s*\S/.test($(t).text()));
  if(modTable){
   const g=grid($,modTable as Element);const current:string[]=[];
   g.forEach((row,r)=>{
    const seen=new Set<Element>();
    row.forEach((cell,c)=>{
     if(!cell||seen.has(cell))return;seen.add(cell);
     if(r>0&&g[r-1][c]===cell)return;// rowspan continuation
     const t=lines(cell).join(' ');
     if(/^For\s/i.test(t)||/:$/.test(t)){const span=Math.max(1,Number($(cell).attr('colspan'))||1);for(let k=0;k<span;k++)current[c+k]=t.replace(/:$/,'');return;}
     const op=/^\+/.test(t)?'add':/^[-−–]/.test(t)?'remove':null;
     if(!op)return;// Pinyin cell, read together with its Latin cell
     const pinyinCell=row[c+1]&&row[c+1]!==cell?lines(row[c+1]).join(' '):'';
     const ingredient=(pinyinCell||t.replace(/^[+\-−–]\s*/,'')).trim();
     const condition=current[c]||'';
     if(!condition)issues.push({field:'modifications',type:'ambiguous_value',detail:`Modyfikacja bez rozpoznanego warunku: ${t}`,excerpt:t});
     modifications.push({position:modifications.length+1,condition,operation:op,ingredient,excerpt:`${condition}: ${t}${pinyinCell?' | '+pinyinCell:''}`});
    });
   });
  }
  const s=section(text,'MODIFICATIONS',FORMULA_SECTIONS)||[];
  if(s.length&&!modifications.length)issues.push({field:'modifications',type:'unreadable',detail:'Sekcja MODIFICATIONS ma treść, ale nie odczytano żadnej modyfikacji.',excerpt:excerpt(s)});
 }
 field(fields,issues,'modifications',modifications,modHeading>=0?modifications.map(m=>m.excerpt):null);

 issues.push(...unknownHeadings(text,FORMULA_SECTIONS,l=>slug(l).startsWith(slug(pinyin))||clean(l).toUpperCase().startsWith(pinyin.toUpperCase())));
 if(expectedName&&slug(expectedName)!==slug(pinyin))issues.push({field:'pinyin',type:'name_mismatch',detail:`Nazwa w indeksie „${expectedName}” różni się od nazwy strony „${pinyin}”.`});
 return {kind:'formula',id:slug(expectedName||pinyin),pinyin,chinese,english:english?.join(' ')||'',alsoKnownAs:aka||[],ingredients,modifications,fields,tags,issues};
}

export function parsePage(kind:'herb'|'formula',html:string,expectedName?:string):Parsed{
 return kind==='herb'?parseHerb(html,expectedName):parseFormula(html,expectedName);
}
