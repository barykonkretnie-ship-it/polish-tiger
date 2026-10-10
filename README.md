# Polish Tiger

Wdrożenie Vercel + Supabase: [instrukcja krok po kroku](DEPLOYMENT.md). PostgreSQL jest obsługiwany przez serwerowe `POLISH_TIGER_DATABASE_URL`; lokalnie bez tej zmiennej nadal działa SQLite. Na Vercel wymagane są baza PostgreSQL, hasło dostępu i sekret sesji.

Prywatny prototyp edukacyjnego atlasu TCM: dokładnie 20 ziół i 10 formuł. Wszystkie dane próbki są **demonstracyjne i niezweryfikowane**. Nie pobierano treści American Dragon, nie uruchamiano masowego importu ani AI. Odnośnik do strony głównej American Dragon oznacza źródło referencyjne projektu, nie cytowanie lub weryfikację konkretnego rekordu. Nie podano dawek ani porad leczenia.

## Warstwa źródłowa i importer (American Dragon)

Według dokumentu „Polish Tiger — pobieranie danych i dedykowana baza”. Dane źródłowe trafiają do osobnego schematu PostgreSQL `polish_tiger_source`, oddzielonego od tabel atlasu (`polish_tiger`), tłumaczeń i poprawek redakcyjnych. Aplikacja jeszcze z niego nie czyta (punkt 12.7).

- Migracje: `db/migrations/*.sql`, stosowane przez `npm run db:migrate` (`MIGRATION_DATABASE_URL`). Importer nie tworzy tabel.
- Importer: `npm run import -- discover | fetch [pilot|all] | parse [--force] | report <id> | read-files <katalog>`. Ustawienia są jawne, według wzoru `.env.import.example` (punkt 10). Brak którejkolwiek wartości blokuje start.
- Pobieranie: kolejne strony pojedynczo, z opóźnieniem, żądaniami warunkowymi (`ETag`/`Last-Modified`), ograniczonymi ponowieniami z `Retry-After` i limitem stron. Każda strona zapisuje się we własnej transakcji, więc przerwany import można wznowić.
- Pochodzenie: `field_evidence` przechowuje dla każdego pola wartość, URL, rewizję, cytowany fragment, datę pobrania, parser z wersją, status wartości (`source`…`human_approved`) i kompletność (`present`/`missing_in_source`/`unreadable`/`needs_review`).
- Niepewne odczyty, nieznane sekcje, rozbieżne nazwy i błędy pobrania trafiają do `review_queue`. Każdy przebieg ma raport w `import_runs`.
- Zakres pilota: `db/pilot-sample.json`, czyli dokładnie 20 + 10. Pełny import wymaga `IMPORT_ALLOW_FULL_IMPORT=true`. Tłumaczenie AI jest wyłączone i niewdrożone.
- Uruchomienie na Vercelu (gdy sesja nie ma dostępu do bazy): `GET /api/internal/source-import?stage=migrate|discover|fetch&batch=N|report` pod adresem konkretnego wdrożenia (chronionym Vercel Authentication). Działa tylko przy `IMPORT_TRIGGER_ENABLED=true`; na domenie produkcyjnej zawsze zwraca 404. Ustawienia importera są zmiennymi projektu, a połączenie z bazą zostaje na serwerze.
- Pobieranie wymaga `IMPORT_SOURCE_RIGHTS_CONFIRMED=true`; decyzję właściciela dla pilota opisuje `docs/source-audit.md`.

Nieuzgodniony import 50 + 50 z 2026-10-10 został wycofany. `lib/rollback.ts` jednorazowo usuwa go z istniejących baz (znacznik `rollback-americandragon-v1`) i zachowuje edycje rekordów próbki.

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
