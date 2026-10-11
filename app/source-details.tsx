'use client';
// Source data woven into the record page: composition with doses, actions, safety, combinations and notes,
// in Polish where a translation exists (falls back to the English source, marked "EN").
import type {RecordData,SourceInfo} from '../lib/types';

type Props={record:RecordData;source:SourceInfo;open:(id:string)=>void;known:Set<string>;tone:(id:string)=>string};
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

function Field({label,source,field,inline,latin}:{label:string;source:SourceInfo;field:string;inline?:boolean;latin?:boolean}){
 const picked=pick(source,field),{value,missing}=picked,en=picked.en&&!latin;
 const items=list(value);
 if(missing)return null;
 return <div className="src-field"><strong>{label}:</strong>{' '}{inline||items.length<2?<>{items.join(', ')} <En on={en}/></>:<><En on={en}/><ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul></>}</div>;
}

/** Combination cells list Latin and Pinyin alternately; the Pinyin names are what the reader needs. */
function pinyinOnly(lines:string[]){const out:string[]=[];for(let i=0;i<lines.length;i+=2)out.push(lines[i+1]||lines[i]);return out.join(' + ');}

export default function SourceDetails({record,source,open,known,tone}:Props){
 const herb=record.kind==='herb';
 const notesPl=source.pl?.ingredient_notes as {position:number;notes:string[]}[]|undefined;
 const conditionsPl=source.pl?.modification_conditions as {position:number;condition:string}[]|undefined;
 const actions=pick(source,'actions'),combos=pick(source,'combinations'),notes=pick(source,'notes');
 return <>
  {herb?record.related.length>0&&<section className="panel"><h2>Powiązane formuły</h2>{record.related.map(i=><div className="relation" key={i.id}><button onClick={()=>open(i.id)}>{i.name} →</button></div>)}</section>
  :<section className="panel"><h2>Skład formuły</h2>
   {source.ingredients.map(i=>{const pl=notesPl?.find(n=>n.position===i.position)?.notes;return <div className="relation" key={i.position}>
    {i.herbId&&known.has(i.herbId)?<button className={`tone ${tone(i.herbId!)}`} onClick={()=>open(i.herbId!)}>{i.pinyin} →</button>:<span className="ingredient">{i.pinyin}</span>}
    <small>{[i.latin,i.dosage&&`Dawka: ${i.dosage}`,i.optional&&'opcjonalnie'].filter(Boolean).join(' · ')}</small>
    {(pl||i.notes).length>0&&<p className="src-note">{(pl||i.notes).join(' ')} <En on={!pl}/></p>}</div>;})}
  </section>}

  {herb?!actions.missing&&<section className="panel"><h2>Działania i wskazania</h2>{<><En on={actions.en}/><ul className="src-list">{(actions.value as {action:string;indications:string[]}[]).map((a,i)=><li key={i}><strong>{a.action}</strong>{a.indications.length>0&&<ul>{a.indications.map((x,j)=><li key={j}>{x}</li>)}</ul>}</li>)}</ul></>}</section>
  :<section className="panel"><h2>Objawy i diagnostyka</h2><Field label="Objawy kliniczne" source={source} field="manifestations"/><Field label="Język" source={source} field="tongue" inline/><Field label="Nalot" source={source} field="coating" inline/><Field label="Puls" source={source} field="pulse" inline/></section>}

  <section className="panel"><h2>Bezpieczeństwo i przygotowanie</h2>
   {herb?<><Field label="Dawkowanie" source={source} field="dosage" inline/><Field label="Surowiec (nazwa farmaceutyczna)" source={source} field="pharmaceutical_latin" inline latin/></>:null}
   <Field label="Przeciwwskazania" source={source} field="contraindications"/>
   {herb&&<Field label="Niezgodności" source={source} field="incompatibilities"/>}
   <Field label="Interakcje zioło–lek" source={source} field="interactions"/>
   {!herb&&source.modifications.length>0&&<div className="src-field"><strong>Modyfikacje:</strong>{' '}{<ul>{[...source.modifications.reduce((m,x)=>{const c=conditionsPl?.find(p=>p.position===x.position)?.condition||x.condition;return m.set(c,[...(m.get(c)||[]),`${x.operation==='add'?'+':x.operation==='remove'?'−':'·'} ${x.ingredient}`]);},new Map<string,string[]>())].map(([c,items])=><li key={c}>{c}: {items.join(', ')}</li>)}</ul>}</div>}
     </section>

  {herb&&!combos.missing&&<section className="panel"><h2>Główne kombinacje</h2>{<><En on={combos.en}/><ul className="src-list">{(source.fields.combinations.value as {herbs:string[];indication:string}[]).map((c,i)=>{const pl=combos.en?null:(combos.value as string[])[i];return <li key={i}><strong>{pinyinOnly(c.herbs)}</strong>{(pl??c.indication)&&<> — {pl??c.indication}</>}</li>;})}</ul></>}</section>}

  <section className="panel"><h2>{notes.missing?'Źródło':'Uwagi'}</h2>
   {notes.missing?null:<><En on={notes.en}/><ul className="src-list">{list(notes.value).map((x,i)=><li key={i}>{x}</li>)}</ul></>}
   <p className="muted">Źródło: <a href={source.url} target="_blank" rel="noreferrer">American Dragon — {source.pinyin} ↗</a> (dr Joel Penner)</p>
  </section>
 </>;
}
