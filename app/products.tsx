'use client';
import { useState } from 'react';
import type { Product } from '../lib/types';
import { normalize } from '../lib/search';
type Draft={id?:number;name:string;tags:string;link:string;notes:string};
const empty:Draft={name:'',tags:'',link:'',notes:''};
/** Tab "Moje": the user's own products with free tags, a link and notes. */
export default function Products({products,logged,save}:{products:Product[];logged:boolean;save:(data:object)=>Promise<boolean>}){
 const [query,setQuery]=useState(''),[tags,setTags]=useState<string[]>([]),[draft,setDraft]=useState<Draft|null>(null);
 const allTags=[...new Set(products.flatMap(p=>p.tags))].sort((a,b)=>a.localeCompare(b,'pl'));
 const words=normalize(query).split(' ').filter(Boolean);
 const shown=products.filter(p=>{const text=normalize([p.name,...p.tags,p.notes,p.link].join(' '));return words.every(w=>text.includes(w))&&tags.every(t=>p.tags.includes(t));});
 async function submit(e:React.FormEvent){e.preventDefault();if(!draft)return;
  if(await save({action:'product-save',...(draft.id?{id:draft.id}:{}),name:draft.name,tags:draft.tags.split(',').map(t=>t.trim()).filter(Boolean),link:draft.link,notes:draft.notes}))setDraft(null);}
 return <><div className="title-row"><div><p className="eyebrow">BIBLIOTEKA / MOJE</p><h1>Moje produkty</h1><p className="muted">Własne produkty z tagami, linkiem i uwagami.</p></div><span className="pill">{products.length} produktów</span></div>
 {logged&&!draft&&<div className="hero-actions"><button className="primary" onClick={()=>setDraft(empty)}>+ Dodaj produkt</button></div>}
 {draft&&<form className="panel product-form" onSubmit={submit}><h2>{draft.id?'Edytuj produkt':'Nowy produkt'}</h2>
  <label>Nazwa<input required maxLength={200} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} autoFocus/></label>
  <label>Tagi — na co jest (oddziel przecinkami)<input maxLength={2000} placeholder="np. sen, stres, trawienie" value={draft.tags} onChange={e=>setDraft({...draft,tags:e.target.value})}/></label>
  {allTags.length>0&&<p className="tag-suggest">{allTags.filter(t=>!draft.tags.split(',').map(x=>x.trim()).includes(t)).map(t=><button type="button" key={t} className="tag mine" onClick={()=>setDraft({...draft,tags:[...draft.tags.split(',').map(x=>x.trim()).filter(Boolean),t].join(', ')})}>+ {t}</button>)}</p>}
  <label>Link<input type="url" maxLength={2000} placeholder="https://…" value={draft.link} onChange={e=>setDraft({...draft,link:e.target.value})}/></label>
  <label>Uwagi<textarea maxLength={10000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
  <div className="hero-actions"><button className="primary">Zapisz produkt</button><button type="button" onClick={()=>setDraft(null)}>Anuluj</button></div></form>}
 <div className="searchbar"><label htmlFor="msearch">Szukaj w moich produktach</label><input id="msearch" placeholder="Nazwa, tag lub uwaga…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
 {allTags.length>0&&<div className="product-tag-filter">{allTags.map(t=><button key={t} type="button" className={`tag mine${tags.includes(t)?' on':''}`} aria-pressed={tags.includes(t)} onClick={()=>setTags(tags.includes(t)?tags.filter(x=>x!==t):[...tags,t])}>{t}</button>)}{tags.length>0&&<button type="button" className="link" onClick={()=>setTags([])}>Wyczyść</button>}</div>}
 <div className="cards">{shown.map(p=><article className="record-card product-card" key={p.id}><h2 className="card-title">{p.name}</h2>
  <div className="tags">{p.tags.map(t=><span className="tag mine" key={t}>{t}</span>)}</div>
  {p.link&&<p><a href={p.link} target="_blank" rel="noreferrer noopener">{p.link.replace(/^https?:\/\/(www\.)?/,'').slice(0,60)} ↗</a></p>}
  {p.notes&&<p className="user-note">{p.notes}</p>}
  {logged&&<div className="card-footer"><button onClick={()=>{setDraft({id:p.id,name:p.name,tags:p.tags.join(', '),link:p.link,notes:p.notes});window.scrollTo({top:0,behavior:'smooth'});}}>Edytuj</button><button onClick={()=>{if(confirm(`Usunąć produkt „${p.name}”?`))save({action:'product-delete',id:p.id});}}>Usuń</button></div>}
 </article>)}</div>
 {!shown.length&&<div className="panel"><h2>{products.length?'Brak dopasowań':'Brak produktów'}</h2><p>{products.length?'Zmień wyszukiwanie lub odznacz tagi.':'Dodaj pierwszy produkt przyciskiem powyżej.'}</p></div>}</>;
}
