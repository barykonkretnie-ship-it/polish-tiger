# Raport pilota 20 + 10 — 2026-10-10

Punkt 9 i 11 dokumentu „Polish Tiger — pobieranie danych i dedykowana baza”. Import uruchomiono po stronie serwera (Vercel, wewnętrzny endpoint) do schematu `polish_tiger_source` w bazie Neon projektu.

## Przebiegi

| # | Etap | Wynik | Czas |
|---|---|---|---|
| 1 | discover | 5 indeksów pobranych; 3431 unikalnych adresów kart, 152 duplikaty linków, 133 linki spoza kart | 8 s |
| 2–4 | fetch pilot (3 paczki po 10) | 30/30 stron pobranych i sparsowanych, 0 błędów HTTP, 0 ponowień | 18 + 18 + 26 s |
| 5 | parse (parser 1.1.0, z zachowanego HTML) | 30/30 sparsowanych bez pobierania | 31 s |
| 6 | parse --force | 30/30; zamknięto 2 nieaktualne zgłoszenia | 44 s |

Opóźnienie między żądaniami: 2 s, pobierane po jednym. Łącznie 35 żądań do źródła. Koszt AI: 0 EUR, bo nie użyto żadnych modeli ani płatnych API.

## Kryteria z punktu 11

- [x] Osobny schemat PostgreSQL `polish_tiger_source`, oddzielony od tabel atlasu.
- [x] Dokładnie 20 ziół i 10 formuł z próbki (`db/pilot-sample.json`).
- [x] Każda karta ma URL źródłowy, rewizję z datą pobrania i status kompletności każdego pola (`field_evidence`).
- [x] Składniki formuł są w kolejności źródła, z dawką i jednostką oraz dosłownym tekstem dawki.
- [x] Braki są jawne (`missing_in_source`), a nie uzupełniane domysłem. Żadne pole nie ma statusu `unreadable`.
- [x] Ponowne uruchomienie nie tworzy duplikatów: sprawdzone testem integracyjnym. Ponowne parsowanie na produkcji nie dodało rekordów.
- [x] Raporty przebiegów zapisane w `import_runs`.
- [x] Nie wykonano pełnego importu ani płatnych zadań.

## Kompletność (bieżące rewizje)

Zioła (20): pinyin, nazwa chińska, łacina, nazwy angielskie, kategoria, smak, termika, kanały, dawkowanie, działania, przeciwwskazania, kombinacje i notatki są obecne we wszystkich 20 kartach. Niezgodności są w 10 kartach, w pozostałych 10 brak w źródle. Interakcje z lekami są w 13 kartach, w 7 brak w źródle.

Formuły (10): pinyin, nazwa chińska, nazwa angielska, skład, działania, syndromy, objawy, język, puls i wskazania są obecne we wszystkich 10. Nalot jest w 9 (1 brak). Inne nazwy w 9 (1 brak). Przeciwwskazania w 8 (2 braki). Modyfikacje w 9 (1 brak). Interakcje w 3 (7 braków). Notatki w 1 (9 braków).

## Do decyzji (kolejka przeglądu: 17 otwartych)

1. **Nawiasy w właściwościach — 16 zgłoszeń.** Źródło pisze np. „Liver, Spleen, (Lung)” albo „Mildly Cold (Cool)”. Importer zapisuje je dosłownie i oznacza jako `secondary`. Trzeba ustalić, co nawias znaczy: kanał drugorzędny, alternatywną klasyfikację czy wartość z innego źródła. Przykłady: Gan Cao „(All twelve channels), (Yang Wei)”, Huang Qi „(Lukewarm)”, Fu Ling „(Warm)”.
2. **Ban Xia → Zhi Ban Xia — 1 zgłoszenie.** Indeks prowadzi do postaci przetworzonej. Karta atlasu „Ban Xia” jest więc w źródle kartą Zhi Ban Xia. Do decyzji: zostawić jako Zhi Ban Xia czy dodać osobną kartę surowca.

## Składniki bez karty zioła (10, zgodnie z założeniem)

- **Zhi Gan Cao (6×):** postać przetworzona. README zakazuje automatycznego utożsamiania jej z Gan Cao.
- **Dang Shen (3×, w nawiasie = zamiennik):** nie ma go w próbce 20 ziół.
- **Gan Jiang (1×, w nawiasie):** nie ma go w próbce.

## Poprawki wprowadzone po przeglądzie pilota

- Shan Zhu Yu: tytuł strony zaczyna się od „Fr. Corni”. Pinyin jest teraz brany z linii NAME (parser 1.1.0).
- Chai Hu: tabela kombinacji zawiera ozdobną tabelkę w jednej komórce. Teraz jest rozpoznawana, a kombinacje są obecne w 20/20 kart.
- Wiązanie składników po pinyin karty i bez nawiasów: Zhi Ban Xia i (Da Zao) są teraz połączone.

## Atlas

Nieuzgodniony import 50 + 50 został wycofany w bazie produkcyjnej: atlas ma znów 20 ziół i 10 formuł (znacznik `rollback-americandragon-v1`). Aplikacja jeszcze nie czyta z warstwy źródłowej, to krok 12.7.

## Co dalej (wymaga decyzji właściciela)

1. Rozstrzygnąć dwie sprawy z kolejki przeglądu powyżej.
2. Interfejs atlasu czytający z warstwy źródłowej (12.7).
3. Tłumaczenia i tagowanie z glosariuszem i limitem kosztów (punkt 7). To osobna zgoda.
4. Pełny import dopiero po ocenie pilota i wycenie (12.8).

Endpoint importu wyłączono po pilocie (`IMPORT_TRIGGER_ENABLED=false`).
