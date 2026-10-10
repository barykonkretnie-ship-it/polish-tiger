'use client';
// Source-layer data on a record page: every parsed field from American Dragon, its completeness and the page it came from.
import type {SourceInfo} from '../lib/types';

const HERB_FIELDS:[string,string][]=[['chinese','Nazwa chińska'],['pharmaceutical_latin','Nazwa farmaceutyczna (łac.)'],['english_names','Nazwy angielskie'],
 ['category','Kategoria'],['taste','Smak'],['temperature','Termika'],['channels','Kanały'],['dosage','Dawkowanie'],['actions','Działania i wskazania'],
 ['contraindications','Przeciwwskazania'],['incompatibilities','Niezgodności'],['interactions','Interakcje zioło–lek'],['combinations','Główne kombinacje'],['notes','Uwagi źródła']];
const FORMULA_FIELDS:[string,string][]=[['chinese','Nazwa chińska'],['english_name','Nazwa angielska'],['also_known_as','Inne nazwy'],['ingredients','Skład'],
 ['formula_actions','Działania formuły'],['syndromes','Syndromy'],['manifestations','Objawy kliniczne'],['tongue','Język'],['coating','Nalot'],['pulse','Puls'],
 ['treats','Wskazania'],['contraindications','Przeciwwskazania'],['interactions','Interakcje zioło–lek'],['modifications','Modyfikacje'],['notes','Uwagi źródła']];
const MISSING:Record<string,string>={missing_in_source:'brak w źródle',unreadable:'nie odczytano — do przeglądu',needs_review:'do przeglądu'};

/** Combination cells list Latin and Pinyin lines alternately; show them as "Pinyin (Latin)". */
function herbPairs(lines:string[]){const out:string[]=[];for(let i=0;i<lines.length;i+=2)out.push(lines[i+1]?`${lines[i+1]} (${lines[i]})`:lines[i]);return out.join(' + ');}

function Value({name,value,source,open,known}:{name:string;value:unknown;source:SourceInfo;open:(id:string)=>void;known:Set<string>}){
 if(name==='ingredients')return <table className="source-table"><thead><tr><th>#</th><th>Pinyin</th><th>Łacina</th><th>Dawka</th><th>Działanie w formule</th></tr></thead><tbody>
  {source.ingredients.map(i=><tr key={i.position}><td>{i.position}</td><td>{i.herbId&&known.has(i.herbId)?<button className="link" onClick={()=>open(i.herbId!)}>{i.pinyin} →</button>:i.pinyin}{i.optional&&<small> (opcjonalnie)</small>}</td><td>{i.latin}</td><td>{i.dosage||<span className="missing">brak</span>}</td><td>{i.notes.join(' ')}</td></tr>)}</tbody></table>;
 if(name==='modifications'){
  const groups=new Map<string,string[]>();
  for(const m of source.modifications)groups.set(m.condition||'(warunek nieodczytany)',[...(groups.get(m.condition||'(warunek nieodczytany)')||[]),`${m.operation==='add'?'+':m.operation==='remove'?'−':'·'} ${m.ingredient}`]);
  return <ul>{[...groups].map(([c,items])=><li key={c}>{c}: {items.join(', ')}</li>)}</ul>;
 }
 if(name==='actions')return <ul>{(value as {action:string;indications:string[]}[]).map((a,i)=><li key={i}><strong>{a.action}</strong>{a.indications.length>0&&<ul>{a.indications.map((x,j)=><li key={j}>{x}</li>)}</ul>}</li>)}</ul>;
 if(name==='combinations')return <ul>{(value as {herbs:string[];indication:string}[]).map((c,i)=><li key={i}><strong>{herbPairs(c.herbs)}</strong>{c.indication&&<> — {c.indication}</>}</li>)}</ul>;
 if(Array.isArray(value))return value.length>1?<ul>{value.map((v,i)=><li key={i}>{String(v)}</li>)}</ul>:<>{String(value[0])}</>;
 return <>{String(value)}</>;
}

export default function SourcePanel({source,open,known}:{source:SourceInfo;open:(id:string)=>void;known:Set<string>}){
 const isFormula='ingredients' in source.fields||source.ingredients.length>0;
 return <section className="panel source-panel" id="zrodlo">
  <h2>Dane ze źródła</h2>
  <p className="muted">Treść z American Dragon (dr Joel Penner) w oryginalnym brzmieniu (EN), niezweryfikowana merytorycznie. Pobrano {new Date(source.fetchedAt).toLocaleDateString('pl-PL')} · parser {source.parserVersion}. Nie jest to zalecenie leczenia.</p>
  <p><a href={source.url} target="_blank" rel="noreferrer">Otwórz tę kartę w American Dragon ↗</a></p>
  <dl className="source-fields">{(isFormula?FORMULA_FIELDS:HERB_FIELDS).map(([name,label])=>{
   const f=source.fields[name];
   return <div className="field" key={name}><dt>{label}</dt><dd>{!f?<span className="missing">brak danych</span>:f.completeness!=='present'?<span className="missing">{MISSING[f.completeness]||f.completeness}</span>:<Value name={name} value={f.value} source={source} open={open} known={known}/>}</dd></div>;
  })}</dl>
 </section>;
}
