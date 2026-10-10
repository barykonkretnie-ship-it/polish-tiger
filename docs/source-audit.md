# Audyt źródła American Dragon

Data: 2026-10-10. Etap 1 z dokumentu „Polish Tiger — pobieranie danych i dedykowana baza” (punkty 1, 3.1 i 12.1).

## Warunki korzystania

| Sprawdzenie | Wynik |
|---|---|
| `robots.txt` | brak (HTTP 404), więc nie ma reguł dla robotów |
| `sitemap.xml` | brak (HTTP 404) |
| Regulamin lub licencja | nie znaleziono na stronie głównej, w indeksach, na kartach ani na stronie kontaktowej |
| Informacja o prawach | „© 2010-17 American Dragon” w stopce każdej strony |
| Kontekst | Autor, dr Joel Penner, nie żyje. Rodzina utrzymuje stronę z darowizn i pisze, że „ojciec chętnie udostępniał swoją pracę społeczności za darmo”. Kontakt: joel@AmericanDragon.com, lonewolf@americandragon.com |
| Logowanie, blokady, limity | brak; strony są publiczne, a importer niczego nie obchodzi |
| Cache HTTP | serwer zwraca `ETag` i `Last-Modified`, więc żądania warunkowe są możliwe |

**Wniosek:** przeglądanie jest publiczne i bezpłatne, ale prawa do kopiowania, przechowywania i tłumaczenia treści nie zostały udzielone wprost. Zgodnie z punktem 1 dokumentu pobieranie jest wstrzymane: importer odmawia pracy, dopóki `IMPORT_SOURCE_RIGHTS_CONFIRMED=false`.

**Wymagany krok:** decyzja właściciela projektu, najlepiej po kontakcie z rodziną autora (adresy powyżej), czy i w jakim zakresie wolno:
1. pobrać i przechowywać próbkę 20 + 10 w prywatnej bazie;
2. przechowywać pełny HTML (`IMPORT_RETENTION=raw_html`, umożliwia ponowne parsowanie bez pobierania), czy tylko skróty i cytowane fragmenty (`excerpts_only`);
3. tłumaczyć treść (osobny etap, punkt 7).

Import 50 ziół i 50 formuł z 2026-10-10 wykonano bez tego kroku. Wycofano go z aplikacji i bazy (`lib/rollback.ts`), a strony pobrane wtedy posłużyły tylko do offline'owego testu parsera.

## Decyzja właściciela (2026-10-10)

- Pobieranie i przechowywanie pilota 20 + 10 w prywatnej bazie: **zatwierdzone przez właściciela projektu** na jego odpowiedzialność. Nie było kontaktu z rodziną autora. `IMPORT_SOURCE_RIGHTS_CONFIRMED=true` wolno ustawić tylko dla zakresu pilota.
- Retencja: **`raw_html`**, czyli pełny HTML w `source_page_revisions`, żeby poprawki parsera nie wymagały ponownego pobierania.
- Baza: istniejąca baza Neon projektu (integracja Vercel). Pełny import i tłumaczenia nadal wymagają osobnej zgody.

## Struktura źródła

- Indeks ziół (Pinyin): `IndividualHerbsIndex2.html`, 715 linków do kart w `Individualherbsupdate/`. Jeden link jest martwy: `Bai(Ci)JiLi.html` zwraca 404 (dublet `BaiJiLi.html`).
- Indeksy formuł: `HerbFormulaIndexA-G.html`, `H-N`, `O-T`, `U-Z`; karty w `Herb Formulas copy/`. Indeks miesza formuły klasyczne z ponumerowanymi protokołami chorobowymi (np. „Acne #5”).
- Ta sama karta jest linkowana na kilka sposobów (`../Herb Formulas copy/`, `/Herb%20Formulas%20copy/`, `Herb Formulas copy/`), więc importer normalizuje adresy do jednej postaci kanonicznej.
- Rozszerzenia `.html` i `.htm` występują obok siebie (np. `ZhiBanXia.htm`, `BiChengQie.htm`).
- Kodowanie: strony deklarują `iso-8859-1`, ale 99 na 100 sprawdzonych to UTF-8 (z chińskimi znakami). Jedna strona (`BaJiaoHuiXiang.html`) nie jest poprawnym UTF-8. Importer czyta ściśle UTF-8, a w razie błędu Windows-1252 i zgłasza to do przeglądu.

## Szablony kart (100 stron sprawdzonych offline)

- **Zioła:** NAME, Pharmaceutical Latin, Common English, CATEGORY, PROPERTIES (tabela: Taste | Temperature | Entering Meridians | Dosage), ACTIONS AND INDICATIONS (tabela działanie → wskazania), CONTRAINDICATIONS / INCOMPATIBILITIES / HERB/DRUG INTERACTIONS, MAJOR COMBINATIONS (siatka: wiersz ziół, pod nim wiersz wskazań; kolumna = kombinacja), NOTES. Warianty to tylko dwukropki w nagłówkach.
- **Formuły:** English, Also Known As, HERBS AND ACTIONS (tabela: Latin | Pin Yin | Dosage | Actions; nawias = składnik opcjonalny), FORMULA ACTIONS, SYNDROMES, CLINICAL MANIFESTATIONS (T:/C:/P: = język, nalot, puls), TREATS, CONTRAINDICATIONS, HERB/DRUG INTERACTIONS, NOTES, MODIFICATIONS (siatka z `colspan`/`rowspan`: warunek „For …” nad kolumną, pod nim „+/- składnik”).
- Wartości w nawiasach („(Lung)”, „(Cool)”) oznaczają prawdopodobnie właściwości drugorzędne. Importer zapisuje je dosłownie i z kwalifikatorem `secondary`, a znaczenie nawiasów trafia do kolejki przeglądu.

## Próbka pilota

Dokładnie 20 ziół i 10 formuł z próbki demonstracyjnej atlasu (`db/pilot-sample.json`); wszystkie mają karty w źródle. Uwaga: „Ban Xia” prowadzi do `ZhiBanXia.htm`, czyli postaci przetworzonej. Importer zgłosi rozbieżność nazw do przeglądu.

## Raport odczytu parsera

`npm run import -- read-files <katalog>` na 100 stronach pobranych 2026-10-10 (50 ziół, 50 formuł):

- wszystkie pola wymagane mają status `present`, a żadne nie ma statusu `unreadable`;
- braki w źródle (`missing_in_source`), m.in. niezgodności 38/50 i interakcje 37/50 u ziół, są pokazywane jako braki, a nie uzupełniane;
- do przeglądu: 4 składniki formuł bez dawki w źródle oraz wartości w nawiasach (kanały 20, smak 13, termika 19 kart).
