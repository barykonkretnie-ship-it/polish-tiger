# Polish Tiger

Wdrożenie Vercel + Supabase: [instrukcja krok po kroku](DEPLOYMENT.md). PostgreSQL jest obsługiwany przez serwerowe `POLISH_TIGER_DATABASE_URL`; lokalnie bez tej zmiennej nadal działa SQLite. Na Vercel wymagane są baza PostgreSQL, hasło dostępu i sekret sesji.

Prywatny prototyp edukacyjnego atlasu TCM: 68 ziół i 60 formuł. Pierwotna próbka 20 + 10 jest **demonstracyjna i niezweryfikowana**.

## Import American Dragon

Za zgodą właściciela projektu zaimportowano z https://www.americandragon.com/ (Dr Joel Penner) pierwsze 50 ziół ze spisu Pinyin i pierwsze 50 klasycznych formuł ze spisu A–G (alfabetycznie; ponumerowane protokoły chorobowe typu „Acne #5” pominięto). Bai Shao i Bai Zhu były już w próbce, więc zostały uzupełnione, a nie zdublowane.

- `scripts/americandragon/parse.py` czyta pobrane strony HTML, a `transform.py` buduje `lib/americandragon.json`.
- Termika, smak, kanały i kategorie są mapowane na polskie słowniki atlasu. Działania, wzorce, objawy i wskazania pozostają po angielsku, jak w źródle.
- Dawkowanie, przeciwwskazania, niezgodności, interakcje zioło–lek, kombinacje i modyfikacje są w uwagach rekordu, z linkiem i datą pobrania.
- Skład formuł łączy się z kartami ziół istniejącymi w atlasie; pozostałe składniki są wymienione w uwagach.
- Import wykonuje się raz (znacznik `import-americandragon-v1`) i zachowuje wcześniejsze edycje.

Treść źródłowa jest chroniona prawem autorskim i niezweryfikowana; atlas jest prywatny (za logowaniem) i służy wyłącznie nauce. Nie jest to zalecenie leczenia.

## Architektura

Next.js 16, React 19, TypeScript, SQLite przez `node:sqlite` (Node.js 24). Lokalna relacyjna baza jest tańszym, samodzielnym zamiennikiem Supabase na etapie prototypu. SQL zawiera rekordy, słowniki, relacje rekord–termin, składniki formuł i źródła z pochodzeniem na poziomie pola. Kanał i narząd to odrębne wymiary; próbka nie domyśla się narządów z kanałów. Formuły nie dziedziczą działań składników. Puste wymiary pozostają widoczne jako braki.

Schemat i próbka: `lib/db.ts`, `lib/sample.ts`. Listę 20 ziół i 10 formuł zawiera `lib/sample.ts`. Relacje składników są demonstracyjne: warianty, kompletność składu, gatunki i postacie przetworzone wymagają sprawdzenia. Gan Cao jest jednym rekordem surowca; nie należy utożsamiać go automatycznie z Zhi Gan Cao.

## Uruchomienie

```bash
cd /workspace/polish-tiger
npm ci --cache /workspace/.npm-cache
npm run dev
```

Baza tworzy się automatycznie w ignorowanym `data/polish-tiger.sqlite`. Ponowne uruchomienie nie nadpisuje edycji. `POLISH_TIGER_DATA_DIR` pozwala wskazać osobny katalog trwałych danych. Backup powinien uwzględniać SQLite i WAL; najbezpieczniej wykonywać go po zatrzymaniu serwera.

Panel jest domyślnie zablokowany. Ustaw własne `POLISH_TIGER_ADMIN_PASSWORD` po stronie serwera, np. w lokalnym ignorowanym `.env.local`, i uruchom serwer ponownie. Nie zapisuj hasła w repozytorium. Logowanie ustawia godzinne ciasteczko HttpOnly/SameSite. Na Vercel odczyt wymaga tej samej sesji co edycja. Wymagany jest dodatkowo POLISH_TIGER_SESSION_SECRET. PostgreSQL przechowuje limit prób logowania. To jednoużytkownikowy prototyp; konta i role wielu użytkowników wymagają kolejnego etapu.

```bash
npm run test
npm run build
npm run typecheck
npm run start
```

Testy przeglądarkowe: `npm run test:e2e` uruchamia własny serwer na porcie 3001, z izolowaną bazą i wyłącznie testowym hasłem. Używa `/usr/bin/chromium`; inny plik wykonywalny wskaż przez `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. W chmurze cache npm może wymagać jawnego wskazania zapisywalnego katalogu jak powyżej.

## Przewodnik testowy

1. Zioła: wyszukaj `Panax` lub `Ren Shen` — jedna karta. `sledziona` ma działać bez polskich znaków.
2. Termika `neutralne` — Fu Ling, Gan Cao, Shan Yao. Dodaj działanie `tonizuje Qi` przy AND — Gan Cao i Shan Yao. OR poszerza wynik.
3. Otwórz Ren Shen → Si Jun Zi Tang → Ren Shen. Skład i powiązanie zwrotne prowadzą do kart.
4. Formuły: wyszukaj `niedobor Qi`, następnie przetestuj filtr składnika Ren Shen. Filtry termiki ziół nie przechodzą do formuł.
5. Nieistniejące zapytanie pokazuje brak wyników. Wyczyść filtry.
6. Zaloguj się do panelu, zmień uwagi lub polską nazwę, odśwież stronę i sprawdź trwały zapis. Przywróć wartość.
7. Edytuj synonim słownikowy i wyszukaj go. Eksport JSON obejmuje rekordy i słowniki.

## Zakres akceptacji

- [x] Polski interfejs, dokładnie 20 + 10, relacyjny zapis.
- [x] Oddzielne listy i filtry, wyszukiwanie Pinyin/łacińskie/polskie, powiązania w obie strony.
- [x] Oddzielne działania, kanały, narządy, wzorce i objawy; jawne braki.
- [x] Edycja nazw, uwag, klasyfikacji i terminów oraz dodawanie terminów za logowaniem; eksport JSON.
- [ ] Weryfikacja merytoryczna próbki względem uprawnionych źródeł.
- [ ] Pełna edycja składów, zatwierdzanie źródłowe i importer.
- [x] Porównanie maksymalnie trzech rekordów według oddzielnych wymiarów.
- [ ] Pełna obsługa polskich odmian i transliteracji (obecnie normalizacja znaków, wyszukiwanie słów i edytowalne synonimy).
- [ ] Utworzenie kont, sprawdzenie rzeczywistego Supabase i wdrożenie Vercel.

SQLite wymaga trwałego dysku i jest opcją lokalną. Vercel korzysta z dodanego backendu PostgreSQL/Supabase; konfigurację opisuje DEPLOYMENT.md. Etap 2 (import) i etap 3 (AI) wymagają osobnej zgody; prototyp niczego nie pobiera automatycznie.
