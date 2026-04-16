§§§§§§§§§§§§§§§§§§§§§§§§§§§§# My Life Manager — Analiza Projektu

## Spis treści

1. [Architektura](#1-architektura)
2. [Stos technologiczny](#2-stos-technologiczny)
3. [Lista funkcjonalności](#3-lista-funkcjonalności)
   - [Autentykacja i zarządzanie użytkownikiem](#31-autentykacja-i-zarządzanie-użytkownikiem)
   - [Zadania (Tasks)](#32-zadania-tasks)
   - [Wydarzenia (Events)](#33-wydarzenia-events)
   - [Kalendarz](#34-kalendarz)
   - [Kategorie](#35-kategorie)
   - [Wyszukiwarka](#36-wyszukiwarka)
   - [Załączniki](#37-załączniki)
   - [Powiadomienia push](#38-powiadomienia-push)
   - [Przypomnienia (Cron)](#39-przypomnienia-cron)
   - [Upload obrazów (legacy)](#310-upload-obrazów-legacy)
4. [Model danych](#4-model-danych)
5. [Frontend — widoki i komponenty](#5-frontend--widoki-i-komponenty)
6. [Pakiet współdzielony (shared)](#6-pakiet-współdzielony-shared)
7. [Infrastruktura i deployment](#7-infrastruktura-i-deployment)
8. [Uwagi i potencjalne luki](#8-uwagi-i-potencjalne-luki)

---

## 1. Architektura

Projekt jest **monorepo** zarządzanym przez Yarn Workspaces. Składa się z trzech pakietów:

| Pakiet   | Ścieżka    | Rola                                      |
|----------|------------|--------------------------------------------|
| `api`    | `api/`     | Backend — REST API                         |
| `web`    | `web/`     | Frontend — SPA                             |
| `shared` | `shared/`  | Współdzielone typy, walidatory, stałe      |
| `mobile` | *(zadeklarowany w workspaces, ale katalog nie istnieje)* | Planowana aplikacja mobilna |

Główna idea produktowa: aplikacja typu **time-blocking** — skrzynka odbiorcza zadań + kalendarz, przeciąganie zadań na kalendarz, kategorie, priorytety, cykliczność (RRULE), deadliny.

---

## 2. Stos technologiczny

### Backend (api)
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Baza danych**: PostgreSQL 16
- **Autentykacja**: Passport.js (Local + JWT)
- **Walidacja**: Zod
- **Upload plików**: Multer
- **Powiadomienia**: web-push (VAPID)
- **Zadania cykliczne**: node-cron
- **Cykliczność wydarzeń**: rrule

### Frontend (web)
- **Framework**: React 18
- **Build tool**: Vite
- **Stylowanie**: Tailwind CSS
- **Kalendarz**: FullCalendar (month/week/day + drag & drop)
- **Stan globalny**: Zustand (auth)
- **Fetching danych**: TanStack Query (React Query)
- **PWA**: Service Worker dla powiadomień push

### Infrastruktura
- **Konteneryzacja**: Docker + Docker Compose (dev i prod)
- **Reverse proxy**: Caddy (prod)
- **Backup**: Skrypt bash z pg_dump (deploy/backup.sh)

---

## 3. Lista funkcjonalności

### 3.1 Autentykacja i zarządzanie użytkownikiem

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/auth/register` | POST | Rejestracja nowego użytkownika. Walidacja Zod, hashowanie hasła bcrypt. Automatycznie tworzy dwie domyślne kategorie: **Dom** i **Firma**. Zwraca token JWT + dane użytkownika. |
| `/api/auth/login` | POST | Logowanie email + hasło przez Passport Local. Zwraca token JWT + dane użytkownika. |
| `/api/auth/me` | GET | Pobranie danych aktualnie zalogowanego użytkownika (wymaga JWT). |
| `/api/auth/me` | PATCH | Aktualizacja profilu użytkownika (name, avatarUrl). Endpoint istnieje w API, ale **nie jest wykorzystywany** przez frontend. |

**Mechanizm JWT**: Token w `Authorization: Bearer`, payload `{ sub: userId }`, domyślny czas życia 7 dni. Frontend przechowuje token w `localStorage`, automatyczny logout przy 401.

**Autoryzacja**: Brak systemu ról — dane filtrowane po `userId` we wszystkich zapytaniach Prisma.

---

### 3.2 Zadania (Tasks)

Główna jednostka pracy użytkownika. Zadania mogą być w "skrzynce odbiorczej" (niezaplanowane) lub zaplanowane na konkretny czas w kalendarzu.

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/tasks` | GET | Lista zadań z filtrami: `categoryId`, `isCompleted`, `scheduled` (boolean), `startDate`/`endDate`. Złożona logika filtrowania — zadania zaplanowane, zadania ze skrzynki, zadania z deadlinem w zakresie dat. |
| `/api/tasks/inbox` | GET | Zadania ze skrzynki: niezakończone **lub** zakończone w ciągu ostatnich 7 dni. Opcjonalny filtr `categoryId`. |
| `/api/tasks/:id` | GET | Szczegóły pojedynczego zadania (z kategorią i załącznikami). |
| `/api/tasks` | POST | Tworzenie zadania. Obsługuje: tytuł, opis, priorytet (1–4), kategorię, harmonogram (`scheduledStart`/`scheduledEnd`/`scheduledAllDay`), deadline, regułę cykliczności, przypomnienie (`reminderMinutes`). |
| `/api/tasks/:id` | PATCH | Aktualizacja zadania. Oznaczenie jako ukończone ustawia `completedAt`. Zmiana harmonogramu/deadline/przypomnienia resetuje flagę `reminderSent`. |
| `/api/tasks/:id/schedule` | PATCH | Zaplanowanie zadania na konkretny termin (scheduledStart + scheduledEnd). Używane przy drag & drop z inbox na kalendarz. |
| `/api/tasks/:id/unschedule` | PATCH | Usunięcie zaplanowania — przeniesienie zadania z powrotem do skrzynki. |
| `/api/tasks/:id` | DELETE | Usunięcie zadania. |

**Cechy zadań**:
- **Priorytety**: 4 poziomy (1–4) z kolorowymi oznaczeniami
- **Cykliczność**: Reguły RRULE do definiowania powtarzających się zadań
- **Deadline**: Opcjonalny termin ostateczny z wizualnym podkreśleniem
- **Przypomnienia**: Konfigurowalny czas przed terminem (w minutach)
- **Całodniowe**: Flaga `scheduledAllDay` do planowania zadań na cały dzień
- **Załączniki**: Możliwość dodawania plików (obrazy, PDF)

---

### 3.3 Wydarzenia (Events)

Osobny byt od zadań — reprezentuje zdarzenia kalendarzowe (spotkania, eventy).

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/events` | GET | Lista wydarzeń w zakresie dat (`startDate`/`endDate` — wymagane). Dla wydarzeń cyklicznych generuje **syntetyczne instancje** przy użyciu biblioteki `rrule` — każda instancja ma ID w formacie `originalId_index` i flagę `isRecurringInstance`. |
| `/api/events/:id` | GET | Szczegóły pojedynczego wydarzenia (prawdziwe ID z bazy, nie syntetyczne). |
| `/api/events` | POST | Tworzenie wydarzenia. Walidacja reguły RRULE przez `RRule.fromString`. Pola: tytuł, opis, lokalizacja, czas start/end, flaga całodniowe, reguła cykliczności, kategoria, przypomnienie. |
| `/api/events/:id` | PATCH | Aktualizacja wydarzenia. Reset przypomnienia przy zmianie czasu/konfiguracji przypomnienia. |
| `/api/events/:id` | DELETE | Usunięcie wydarzenia. |

**Cechy wydarzeń**:
- **Lokalizacja**: Dodatkowe pole `location`, którego nie mają zadania
- **Cykliczność z syntetycznymi instancjami**: API rozszerza cykliczne wydarzenia na konkretne wystąpienia w żądanym zakresie dat
- **Przypomnienia**: Analogicznie do zadań

---

### 3.4 Kalendarz

Główny widok aplikacji — komponent `CalendarView` oparty na **FullCalendar**.

**Funkcjonalności kalendarza**:
- **Widoki**: Miesiąc, Tydzień, Dzień
- **Drag & Drop z Inbox**: Przeciąganie zadań ze skrzynki odbiorczej bezpośrednio na kalendarz (biblioteka `@fullcalendar/interaction` + Draggable)
- **Drag & Drop w kalendarzu**: Przenoszenie już zaplanowanych zadań/wydarzeń między terminami
- **Resize**: Zmiana długości trwania zadania/wydarzenia przez przeciąganie krawędzi
- **Scalanie danych**: Kalendarz wyświetla jednocześnie zaplanowane zadania i wydarzenia, wizualnie je rozróżniając
- **Optymistyczne oznaczanie ukończenia**: Szybkie toggle "zakończone" bezpośrednio z widoku kalendarza
- **Modale tworzenia/edycji**: Kliknięcie na slot otwiera modal tworzenia; kliknięcie na element otwiera modal edycji
- **Filtrowanie po kategorii**: Stan filtra współdzielony między inbox a kalendarzem

---

### 3.5 Kategorie

System organizacji zadań i wydarzeń w grupy tematyczne.

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/categories` | GET | Lista wszystkich kategorii użytkownika. |
| `/api/categories` | POST | Tworzenie nowej kategorii (nazwa, kolor, ikona, kolejność). |
| `/api/categories/:id` | PATCH | Aktualizacja kategorii. |
| `/api/categories/:id` | DELETE | Usunięcie kategorii. **Zablokowane** dla kategorii domyślnych (`isDefault`). |

**Cechy kategorii**:
- **Domyślne**: Przy rejestracji tworzone są automatycznie **Dom** i **Firma** (nieusuwalne)
- **Personalizacja**: Nazwa, kolor, ikona
- **Kolejność**: Pole `order` umożliwia sortowanie
- **Unikalność**: Para (`userId`, `name`) jest unikalna — użytkownik nie może mieć dwóch kategorii o tej samej nazwie
- **Manager kategorii**: Dedykowany modal na froncie do zarządzania (dostępny z inbox)

---

### 3.6 Wyszukiwarka

Globalna wyszukiwarka z poziomu nagłówka aplikacji.

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/search` | GET | Wyszukiwanie po parametrze `q`. Case-insensitive `contains` na tytule i opisie. Przeszukuje zadania (max 10) i wydarzenia (max 10), scala wyniki, sortuje po dacie, zwraca **top 10**. |

**Cechy wyszukiwarki**:
- **Skrót klawiaturowy**: Ctrl/Cmd+K otwiera wyszukiwarkę
- **Debounce**: Opóźnione zapytanie, by nie obciążać API przy każdym naciśnięciu klawisza
- **Integracja z modalami**: Kliknięcie wyniku otwiera modal edycji zadania lub wydarzenia (ładuje pełne dane przez `getById`)
- **Ograniczenie**: Wyszukuje tylko po tytule i opisie — nie przeszukuje kategorii ani lokalizacji

---

### 3.7 Załączniki

System plików powiązanych z zadaniami lub wydarzeniami.

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/attachments/upload` | POST | Upload pliku (multipart `file`). Wymagany body: `taskId` **lub** `eventId`. Obsługiwane formaty: obrazy + PDF. Plik zapisywany w katalogu `uploads/`, tworzony rekord w bazie z URL. |
| `/api/attachments/:id` | DELETE | Usunięcie załącznika. Weryfikacja przynależności przez zadanie/wydarzenie użytkownika. |

**Cechy załączników**:
- **Panel załączników**: Komponent `AttachmentPanel` w modalach zadań i wydarzeń
- **Typy plików**: Obrazy (JPEG, PNG, GIF, WebP) i PDF
- **Limity**: Zdefiniowane w shared/constants (rozmiar pliku i dozwolone typy MIME)
- **Pending uploads**: Schema bazy danych obsługuje załączniki "oczekujące" (`userId` + `expiresAt`), ale **ta ścieżka nie jest w pełni zaimplementowana**

---

### 3.8 Powiadomienia push

System powiadomień Web Push oparty na VAPID.

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/notifications/vapidPublicKey` | GET | Pobranie klucza publicznego VAPID (bez autentykacji). Zwraca 503 jeśli VAPID nie jest skonfigurowany. |
| `/api/notifications/subscribe` | POST | Zapis subskrypcji push. Upsert po `endpoint` — aktualizacja jeśli już istnieje, utworzenie nowej jeśli nie. |
| `/api/notifications/unsubscribe` | DELETE | Usunięcie subskrypcji push po `endpoint`. |

**Cechy powiadomień**:
- **Service Worker**: `sw.js` w katalogu `public/` frontlendu obsługuje odbieranie i wyświetlanie powiadomień
- **Hook React**: `usePushNotifications` zarządza cyklem subskrypcji
- **Przycisk toggle**: W nagłówku aplikacji, umożliwia włączenie/wyłączenie powiadomień
- **Opcjonalność**: Cała funkcja wymaga konfiguracji zmiennych `PUBLIC_VAPID_KEY` i `PRIVATE_VAPID_KEY`

---

### 3.9 Przypomnienia (Cron)

Automatyczny system przypomnień działający w tle.

**Mechanizm**:
- **Harmonogram**: `node-cron` uruchamiany co minutę (`'* * * * *'`)
- **Logika**: Wyszukuje zadania i wydarzenia z ustawionym `reminderMinutes` i niezaznaczonym `reminderSent`. Oblicza czas przypomnienia (start/deadline minus minuty). Jeśli aktualny czas mieści się w ±30s od czasu przypomnienia, wysyła powiadomienie web-push
- **Oznaczanie**: Po wysłaniu ustawia `reminderSent: true`
- **Czyszczenie**: Automatycznie usuwa martwe subskrypcje (status 410/404)
- **Warunek**: Działa tylko gdy skonfigurowane są klucze VAPID

---

### 3.10 Upload obrazów (legacy)

Starszy mechanizm uploadu, prawdopodobnie poprzedzający system załączników.

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/upload` | POST | Upload obrazu (multipart `image`). Plik zapisywany w podkatalogu per-user w `UPLOAD_DIR`. Zwraca publiczny URL na bazie `API_URL`. |
| `/api/upload/:filename` | DELETE | Usunięcie pliku z katalogu aktualnego użytkownika. |

---

## 4. Model danych

### User
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| email | String (unique) | Adres email |
| password | String | Hash bcrypt |
| name | String? | Imię/nazwa |
| avatarUrl | String? | URL avatara |
| createdAt / updatedAt | DateTime | Znaczniki czasu |

### Category
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| name | String | Nazwa kategorii |
| color | String | Kolor (hex) |
| icon | String? | Ikona |
| isDefault | Boolean | Czy domyślna (nieusuwalna) |
| order | Int | Kolejność wyświetlania |
| userId | String | FK do User |

### Task
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| title | String | Tytuł zadania |
| description | String? | Opis |
| isCompleted | Boolean | Czy ukończone |
| completedAt | DateTime? | Data ukończenia |
| scheduledStart | DateTime? | Zaplanowany start |
| scheduledEnd | DateTime? | Zaplanowany koniec |
| scheduledAllDay | Boolean | Czy całodniowe |
| deadline | DateTime? | Termin ostateczny |
| priority | Int (1–4) | Priorytet |
| recurrenceRule | String? | Reguła RRULE |
| imageUrl | String? | URL obrazu (legacy) |
| reminderMinutes | Int? | Minuty przed przypomnieniem |
| reminderSent | Boolean | Czy przypomnienie wysłane |
| userId | String | FK do User |
| categoryId | String? | FK do Category |

### Event
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| title | String | Tytuł wydarzenia |
| description | String? | Opis |
| location | String? | Lokalizacja |
| startTime | DateTime | Czas rozpoczęcia |
| endTime | DateTime | Czas zakończenia |
| isAllDay | Boolean | Czy całodniowe |
| recurrenceRule | String? | Reguła RRULE |
| reminderMinutes | Int? | Minuty przed przypomnieniem |
| reminderSent | Boolean | Czy przypomnienie wysłane |
| userId | String | FK do User |
| categoryId | String? | FK do Category |

### Attachment
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| filename | String | Nazwa pliku na serwerze |
| originalName | String | Oryginalna nazwa pliku |
| mimetype | String | Typ MIME |
| size | Int | Rozmiar w bajtach |
| url | String | Publiczny URL |
| taskId | String? | FK do Task |
| eventId | String? | FK do Event |
| userId | String? | FK do User (pending) |
| expiresAt | DateTime? | Czas wygaśnięcia (pending) |

### PushSubscription
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| endpoint | String (unique) | Endpoint subskrypcji |
| p256dh | String | Klucz publiczny |
| auth | String | Token autoryzacji |
| userId | String | FK do User |

---

## 5. Frontend — widoki i komponenty

### Routing

| Ścieżka | Komponent | Opis |
|----------|-----------|------|
| `/` | `Dashboard` (w `Layout`) | Główny widok — chroniony, wymaga zalogowania |
| `/login` | `Login` | Strona logowania (redirect do `/` jeśli zalogowany) |
| `/register` | `Register` | Strona rejestracji (redirect do `/` jeśli zalogowany) |
| `*` | Redirect do `/` | Fallback |

### Główne komponenty

- **`Dashboard`** — Kontener główny, zarządza stanem filtra kategorii współdzielonym między inbox a kalendarzem
- **`TaskInbox`** — Skrzynka odbiorcza z sekcjami: dzisiaj, zaległe, jutro, później; zakładki kategorii; CRUD zadań; modal managera kategorii; tworzenie wydarzeń z menu kontekstowego
- **`CalendarView`** — Komponent FullCalendar z widokami miesiąc/tydzień/dzień; scalanie zadań i wydarzeń; drag & drop; resize; modale tworzenia/edycji
- **`TaskModal`** — Pełna edycja zadania: cykliczność, przypomnienia (ReminderPicker), załączniki (AttachmentPanel), priorytety, kategorie
- **`EventModal`** — Pełna edycja wydarzenia: lokalizacja, cykliczność, przypomnienia, załączniki
- **`Layout`** — Nagłówek z SearchBar, toggle powiadomień push, przełącznik motywu, logout
- **`SearchBar`** — Globalna wyszukiwarka z debounce, skrót Ctrl/Cmd+K, integracja z modalami

### Zarządzanie stanem

- **Zustand** (`authStore`) — token w localStorage, login/register/logout, `checkAuth()` przy starcie
- **TanStack Query** — cache z `staleTime` 5 minut; fetching kalendarza, inboxu, kategorii, wyszukiwania
- **ThemeContext** — light/dark/system

### Klient API

Axios z `baseURL: '/api'`, automatyczny Bearer token, obsługa `FormData` (usunięcie Content-Type), automatyczny logout i redirect do `/login` przy 401.

---

## 6. Pakiet współdzielony (shared)

| Moduł | Opis |
|-------|------|
| `types.ts` | Typy TypeScript: User, Category, Task, Event, CalendarItem, ApiResponse, AuthResponse, PaginatedResponse |
| `validators.ts` | Schematy Zod: auth, kategorie, zadania, wydarzenia, zakres dat, query parametry |
| `constants.ts` | Stałe: priorytety (etykiety, kolory), domyślne kategorie (seed), etykiety cykliczności, nazwy widoków FullCalendar, domyślne sloty czasowe, limity uploadu |

**Uwaga**: Typy w shared są częściowo niezsynchronizowane z aktualnym API (brakuje m.in. `scheduledAllDay`, `reminderMinutes` w typie Task). Walidatory Zod w shared są koncepcyjnie podobne do tych w API, ale nie identyczne.

---

## 7. Infrastruktura i deployment

### Docker — Środowisko deweloperskie (`docker-compose.yml`)
- PostgreSQL 16 na porcie 5433
- API z hot-reload, `prisma migrate deploy` + `dev`
- Web z Vite dev server
- Volumy: kod źródłowy + uploads

### Docker — Produkcja (`docker-compose.prod.yml`)
- PostgreSQL 16
- API — multi-stage build, migracje Prisma, `node dist/index.js`
- Web — statyczny build serwowany przez Caddy
- Caddy jako reverse proxy:
  - `/api` i `/uploads` → API
  - Reszta → SPA z `try_files`
  - Nagłówki bezpieczeństwa
  - Kompresja gzip/zstd
- Volume dla uploadsów (persystentny)

### Backup
- Skrypt `deploy/backup.sh` — `pg_dump` przez Docker Compose prod, gzip, retencja 30 dni
- Przeznaczony do uruchomienia jako cron na serwerze

### Health check
- `GET /api/health` → `{ status: 'ok', timestamp }` — używany przez Docker healthcheck w produkcji

---

## 8. Uwagi i potencjalne luki

1. **Mobile workspace**: Zadeklarowany w `package.json`, ale katalog `mobile/` nie istnieje — komendy `yarn mobile:*` nie zadziałają
2. **Pending attachments**: Schema bazy obsługuje załączniki "oczekujące" z `expiresAt`, ale brak implementacji uploadu pending i crona czyszczącego wygasłe rekordy
3. **PATCH /auth/me**: Endpoint istnieje w API, ale frontend go nie wykorzystuje — brak UI do edycji profilu
4. **Wyszukiwarka**: Przeszukuje tylko tytuł i opis — nie uwzględnia kategorii, lokalizacji ani załączników
5. **Paginacja**: Typ `PaginatedResponse` istnieje w shared, ale żaden endpoint API nie implementuje paginacji
6. **Desynchronizacja typów shared ↔ API**: Typy w pakiecie shared nie pokrywają wszystkich pól z Prisma schema (np. `scheduledAllDay`, `reminderMinutes`)
7. **README**: Dokumentacja API w README jest niekompletna — brakuje wielu endpointów (attachments, search, notifications, health, PATCH /auth/me)
8. **Cykliczne zadania**: W przeciwieństwie do wydarzeń, zadania z `recurrenceRule` nie generują syntetycznych instancji — pole jest w modelu, ale logika rozwijania cykliczności nie jest w pełni zaimplementowana dla zadań
