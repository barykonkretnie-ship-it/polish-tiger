# Vercel + Supabase — Polish Tiger

Kod jest przygotowany do wdrożenia. Konto Vercel, projekt Supabase i prawdziwe połączenie nie zostały jeszcze utworzone lub sprawdzone. Nie ma obecnie publicznego adresu aplikacji.

## 1. Konta i projekt bazy

1. Utwórz konto na https://supabase.com/ i projekt `polish-tiger`. Wybierz dogodny region europejski i aktualny plan odpowiedni do swoich potrzeb. Sprawdź limity i cennik w panelu; nie włączaj płatnych dodatków bez potrzeby.
2. Zapisz hasło bazy w menedżerze haseł. W oknie **Connect** wybierz PostgreSQL **Transaction pooler**, skopiuj URI połączenia i uzupełnij hasło. Zwykle pooler korzysta z portu 6543; stosuj adres i parametry podane przez panel, nie adres z przykładu. Hasło w URI musi być zakodowane zgodnie z formatem URL.
3. Utwórz konto na https://vercel.com/ przez GitHub. Import projektu będzie wymagał, aby kod znajdował się w repozytorium GitHub. Przed importem repozytorium musi zawierać aktualną wersję kodu aplikacji.

## 2. Konfiguracja serwera

W Vercel dodaj w ustawieniach projektu **Environment Variables** trzy wartości dla wybranego środowiska wdrożenia:

| Nazwa | Wartość |
| --- | --- |
| `POLISH_TIGER_DATABASE_URL` | Pełny URI PostgreSQL z Supabase Transaction pooler |
| `POLISH_TIGER_ADMIN_PASSWORD` | Własne, unikalne hasło dostępu do atlasu, co najmniej 16 znaków |
| `POLISH_TIGER_SESSION_SECRET` | Niezależny losowy sekret podpisu sesji, co najmniej 32 znaki |

Wszystkie wartości są poufne i wyłącznie serwerowe. Nie dodawaj prefiksu `NEXT_PUBLIC_`, nie wklejaj ich do czatu i nie zapisuj w Git. Zmiana hasła lub sekretu unieważnia istniejące sesje.

Do przygotowania bazy lokalnie użyj ignorowanego `.env.local` zgodnego z `.env.example`. Nie kopiuj wartości do poleceń udostępnianych publicznie. Użyj terminala swojego komputera lub zaufanego środowiska obsługującego bezpośrednie połączenie PostgreSQL; połączenie TCP nie korzysta z proxy sekretów HTTPS.

```bash
npm ci
npm run db:setup
```

`db:setup` tworzy prywatny schemat `polish_tiger`, relacje, tabelę ograniczania prób logowania i próbkę 20 + 10. Operacja jest transakcyjna i zabezpieczona przed równoległym inicjalizowaniem. Ponowne uruchomienie zachowuje edycje. To inicjalizacja próbki, **nie migracja istniejących edycji SQLite**. Lokalny plik SQLite pozostaje nienaruszony; przed przeniesieniem własnych zmian wykonaj eksport i osobną migrację.

Połączenie produkcyjne używa TLS z weryfikacją certyfikatu. Jeśli Supabase wymaga dodatkowego certyfikatu CA, pobierz go z oficjalnych ustawień projektu i skonfiguruj zaufanie w środowisku. Nie wyłączaj weryfikacji. Opcja `POLISH_TIGER_DATABASE_SSL=local-test` służy wyłącznie testowej bazie na loopback i jest ignorowana na Vercel.

Schemat nie powinien być dodawany do listy schematów wystawianych przez Supabase Data API. Tabele mają włączone RLS bez polityk publicznego dostępu; serwer używa połączenia właściciela bazy. Nie umieszczaj danych uwierzytelniających bazy w przeglądarce. W dalszym etapie warto oddzielić konto migracyjne od konta aplikacji o ograniczonych uprawnieniach.

## Szybka ścieżka: Neon z Vercel Marketplace

Zamiast Supabase można w projekcie Vercel wybrać **Storage → Create Database → Neon** i połączyć bazę z projektem. Integracja sama dodaje `DATABASE_URL`/`POSTGRES_URL`, które aplikacja przyjmuje, gdy brak `POLISH_TIGER_DATABASE_URL`. Schemat i próbka 20 + 10 tworzą się automatycznie przy pierwszym zapytaniu (ta sama idempotentna operacja co `db:setup`), więc ręczna inicjalizacja nie jest wymagana.

## 3. Import i wdrożenie

W Vercel wybierz **Add New → Project**, repozytorium `barykonkretnie-ship-it/polish-tiger`, framework Next.js i katalog główny repozytorium. Wybierz Node.js 24.x. `vercel.json` określa `npm ci` i `npm run build`. Dodaj trzy powyższe zmienne przed wdrożeniem. Nie inicjalizuj bazy przy każdym buildzie — użyj osobno `db:setup`.

Możliwe jest również wdrożenie lokalnego checkout przez zalogowaną CLI Vercel; nie wymaga wtedy wcześniejszego push do GitHub. Automatyczne wdrożenia po push wymagają połączenia repozytorium.

Vercel zawsze wymusza logowanie przed odczytem atlasu. Bez poprawnej konfiguracji hasła i sekretu aplikacja pozostaje zablokowana. Edycja wymaga ważnej sesji, która wygasa po godzinie. Formularze zapisują przez żądania z tego samego origin; ciasteczko jest HttpOnly/SameSite i Secure na HTTPS. Przy PostgreSQL próby logowania są ograniczone do 10 na 15 minut na identyfikator klienta. Włącz także dostępne zabezpieczenia wdrożeń w panelu Vercel zgodnie ze swoim planem.

## 4. Kontrola po wdrożeniu

- Otwórz adres przyznany przez Vercel: bez logowania widoczny jest wyłącznie formularz.
- Zaloguj się i sprawdź dokładnie 20 ziół, 10 formuł oraz powiązania Ren Shen ↔ Si Jun Zi Tang.
- Zmień uwagi testowego rekordu, odśwież stronę, potem przywróć wartość. Sprawdź, czy zmiana jest zachowana po ponownym wdrożeniu.
- Wyloguj się: atlas musi ponownie wymagać logowania.
- Potwierdź w przeglądarce, że sekrety bazy nie trafiają do odpowiedzi ani kodu klienta.

Bez kont i skonfigurowanej bazy te kroki pozostają niewykonane. Testy lokalne potwierdzają obsługę PostgreSQL, ale nie zastępują sprawdzenia prawdziwego Supabase i Vercel.

## Testy lokalne

`npm test` sprawdza logikę i sesje. Test PostgreSQL jest pomijany, jeśli nie podano `POLISH_TIGER_TEST_DATABASE_URL`. Podawaj wyłącznie URI osobnej, lokalnej bazy testowej — test zapisuje dane. `npm run test:e2e` domyślnie używa izolowanego SQLite; z testowym URI używa PostgreSQL. `npm run test:private` sprawdza przekierowanie bez sesji, logowanie i wylogowanie. Testowe serwery korzystają z portów 3001 i 3002 oraz jawnie testowych haseł, które nie są konfiguracją produkcyjną.

Pełny import i AI nadal nie są uruchomione. Wszystkie rekordy próbki pozostają demonstracyjne i niezweryfikowane.
