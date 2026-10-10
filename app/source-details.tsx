'use client';
// Source data woven into the record page: composition with doses, actions, safety, combinations and notes,
// in Polish where a translation exists (falls back to the English source, marked "EN").
import type {RecordData,SourceInfo} from '../lib/types';

type Props={record:RecordData;source:SourceInfo;open:(id:string)=>void;known:Set<string>};
const MISSING:Record<string,string>={missing_in_source:'brak w źródle',unreadable:'nie odczytano — do przeglądu',needs_review:'do przeglądu'};

/** Polish value when translated, otherwise the source value; the flag tells the caller which one it got. */
function pick(source:SourceInfo,field:string):{value:unknown;en:boolean;missing?:string}{
 const f=source.fields[field];
 if(!f)return {value:null,en:false,missing:'brak danych'};
 if(f.completeness!=='present')return {value:null,en:false,missing:MISSING[f.completeness]||f.completeness};
 const pl=source.pl?.[field];
 return pl!==undefined?{value:pl,en:false}:{value:f.value,en:true};
}
const En=({on}:{on:boolean})=>on?<small className="en" title="Brak tłumaczenia — tekst źródłowy">EN</small>:null;
const list=(v:unknown)=>(Array.isArray(v)?v:v==null?[]:[v]).map(String);

function Field({label,source,field,inline}:{label:string;source:SourceInfo;field:string;inline?:boolean}){
 const {value,en,missing}=pick(source,field);
 const items=list(value);
 return <div className="src-field"><strong>{label}:</strong>{' '}{missing?<span className="missing">{missing}</span>:inline||items.length<2?<>{items.join(', ')} <En on={en}/></>:<><En on={en}/><ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul></>}</div>;
}

/** Combination cells list Latin and Pinyin alternately; the Pinyin names are what the reader needs. */
function pinyinOnly(lines:string[]){const out:string[]=[];for(let i=0;i<lines.length;i+=2)out.push(lines[i+1]||lines[i]);return out.join(' + ');}

export default function SourceDetails({record,source,open,known}:Props){
 const herb=record.kind==='herb';
 const notesPl=source.pl?.ingredient_notes as {position:number;notes:string[]}[]|undefined;
 const conditionsPl=source.pl?.modification_conditions as {position:number;condition:string}[]|undefined;
 const actions=pick(source,'actions'),combos=pick(source,'combinations'),notes=pick(source,'notes');
 const translated=!!source.pl&&Object.keys(source.pl).length>0;
 return <>
  {herb?<section className="panel"><h2>Powiązane formuły</h2>{record.related.length?record.related.map(i=><div className="relation" key={i.id}><button onClick={()=>open(i.id)}>{i.name} →</button></div>):<p className="missing">brak formuł w atlasie</p>}</section>
  :<section className="panel"><h2>Skład formuły</h2><p className="muted">Kolejność i dawki według źródła; nawias oznacza składnik opcjonalny lub zamiennik.</p>
   {source.ingredients.map(i=>{const pl=notesPl?.find(n=>n.position===i.position)?.notes;return <div className="relation" key={i.position}>
    {i.herbId&&known.has(i.herbId)?<button onClick={()=>open(i.herbId!)}>{i.pinyin} →</button>:<span className="ingredient">{i.pinyin}</span>}
    <small>{i.latin} · Dawka: {i.dosage||'brak w źródle'}{i.optional?' · opcjonalnie':''}</small>
    {(pl||i.notes).length>0&&<p className="src-note">{(pl||i.notes).join(' ')} <En on={!pl}/></p>}</div>;})}
  </section>}

  {herb?<section className="panel"><h2>Działania i wskazania</h2>{actions.missing?<p className="missing">{actions.missing}</p>:<><En on={actions.en}/><ul className="src-list">{(actions.value as {action:string;indications:string[]}[]).map((a,i)=><li key={i}><strong>{a.action}</strong>{a.indications.length>0&&<ul>{a.indications.map((x,j)=><li key={j}>{x}</li>)}</ul>}</li>)}</ul></>}</section>
  :<section className="panel"><h2>Objawy i diagnostyka</h2><Field label="Objawy kliniczne" source={source} field="manifestations"/><Field label="Język" source={source} field="tongue" inline/><Field label="Nalot" source={source} field="coating" inline/><Field label="Puls" source={source} field="pulse" inline/></section>}

  <section className="panel"><h2>Bezpieczeństwo i przygotowanie</h2>
   {herb?<><Field label="Dawkowanie" source={source} field="dosage" inline/><Field label="Surowiec (nazwa farmaceutyczna)" source={source} field="pharmaceutical_latin" inline/></>:null}
   <Field label="Przeciwwskazania" source={source} field="contraindications"/>
   {herb&&<Field label="Niezgodności" source={source} field="incompatibilities"/>}
   <Field label="Interakcje zioło–lek" source={source} field="interactions"/>
   {!herb&&<div className="src-field"><strong>Modyfikacje:</strong>{' '}{source.modifications.length?<ul>{[...source.modifications.reduce((m,x)=>{const c=conditionsPl?.find(p=>p.position===x.position)?.condition||x.condition;return m.set(c,[...(m.get(c)||[]),`${x.operation==='add'?'+':x.operation==='remove'?'−':'·'} ${x.ingredient}`]);},new Map<string,string[]>())].map(([c,items])=><li key={c}>{c}: {items.join(', ')}</li>)}</ul>:<span className="missing">brak w źródle</span>}</div>}
   <p className="muted">Brak informacji o przeciwwskazaniach nie oznacza bezpieczeństwa stosowania. Dane ze źródła, niezweryfikowane; to nie jest zalecenie leczenia.</p>
  </section>

  {herb&&<section className="panel"><h2>Główne kombinacje</h2>{combos.missing?<p className="missing">{combos.missing}</p>:<><En on={combos.en}/><ul className="src-list">{(combos.value as {herbs:string[];indication:string}[]).map((c,i)=><li key={i}><strong>{pinyinOnly(c.herbs)}</strong>{c.indication&&<> — {c.indication}</>}</li>)}</ul></>}</section>}

  <section className="panel"><h2>Pochodzenie i uwagi</h2>
   {notes.missing?null:<><En on={notes.en}/><ul className="src-list">{list(notes.value).map((x,i)=><li key={i}>{x}</li>)}</ul></>}
   <p><a href={source.url} target="_blank" rel="noreferrer">Karta {source.pinyin} w American Dragon ↗</a></p>
   <p className="muted">Źródło: American Dragon (dr Joel Penner), pobrano {new Date(source.fetchedAt).toLocaleDateString('pl-PL')} · parser {source.parserVersion}. {translated?'Tłumaczenie AI według glosariusza gl-1 — do przeglądu.':'Tekst źródłowy po angielsku.'} Rekord niezweryfikowany merytorycznie.</p>
  </section>
 </>;
}
