'use client';
import {useState} from 'react';
export default function Login({configured}:{configured:boolean}){
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <main><p className="eyebrow">POLISH TIGER · PRYWATNY ATLAS</p><h1>Twoja przestrzeń wiedzy</h1><p>Zaloguj się, aby przeglądać zioła, formuły i powiązania.</p><form className="panel login" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',password})});if(!response.ok)throw Error('Nie udało się zalogować. Sprawdź hasło lub spróbuj później.');window.location.assign('/');}catch(e){setError(e instanceof Error?e.message:'Błąd połączenia');}finally{setBusy(false);}}}>
 <h2>Zaloguj się</h2>{!configured&&<p>Dostęp nie został jeszcze skonfigurowany przez właściciela aplikacji.</p>}<label>Hasło dostępu<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={!configured||busy}>{busy?'Logowanie…':'Otwórz atlas'}</button>{error&&<p role="alert">{error}</p>}</form><p className="muted">Prototyp edukacyjny. Próbka demonstracyjna, bez pełnego importu i AI.</p></main>;
}
