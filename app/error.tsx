'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main><h1>Nie udało się otworzyć atlasu</h1><p>Wystąpił błąd odczytu danych. Spróbuj ponownie.</p><button onClick={reset}>Ponów próbę</button></main>;}
