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
   - [Zespoły i Obszary robocze (Workspaces)](#311-zespoły-i-obszary-robocze-workspaces)
   - [Przypisywanie osób (Assignee / cowork)](#31110-przypisywanie-osób-assignee--cowork)
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

Globalna, **cross-workspace** wyszukiwarka z poziomu nagłówka aplikacji — jednocześnie przeszukuje konto osobiste użytkownika oraz wszystkie zespoły, w których jest członkiem.

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/search` | GET | Wyszukiwanie po parametrze `q`. Case-insensitive `contains` na tytule i opisie. Filtr workspace: `(userId = me AND teamId IS NULL) OR teamId IN (moje zespoły)`. Zwraca zadania (max 10) i wydarzenia (max 10) z polami `teamId` i `teamName`, scala wyniki, sortuje po dacie, zwraca **top 10**. |

**Cechy wyszukiwarki**:
- **Cross-workspace**: Wyniki obejmują jednocześnie workspace osobisty i wszystkie zespoły użytkownika, niezależnie od aktywnego workspace'a — ułatwia szybkie wyszukanie elementu bez ręcznego przełączania kontekstu
- **Workspace badge**: Każdy wynik oznaczony etykietą z ikoną (User dla osobistych, Building2 dla zespołów) i nazwą workspace'a. Elementy z obcego workspace'a (innego niż aktywny) mają dodatkowy akcent amber i obramowanie sygnalizujące zmianę kontekstu po kliknięciu
- **Auto-switch kontekstu**: Kliknięcie wyniku z innego workspace'a automatycznie przełącza `activeWorkspaceId` w `useWorkspaceStore` (z toastem "Przełączono na: …") — dzięki temu modal edycji i wszystkie zależne hooki React Query dostają poprawny `teamId` w query keys
- **Skrót klawiaturowy**: Ctrl/Cmd+K otwiera wyszukiwarkę
- **Debounce**: Opóźnione zapytanie, by nie obciążać API przy każdym naciśnięciu klawisza
- **Integracja z modalami**: Kliknięcie wyniku otwiera modal edycji zadania lub wydarzenia (ładuje pełne dane przez `getById`)
- **Ograniczenie**: Wyszukuje tylko po tytule i opisie — nie przeszukuje kategorii ani lokalizacji

---

### 3.7 Załączniki

System plików powiązanych z zadaniami lub wydarzeniami.

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/attachments/upload` | POST | Upload pliku (multipart `file`). Wymagany body: `taskId` **lub** `eventId`. Obsługiwane formaty: obrazy + PDF. Plik zapisywany w katalogu `uploads/`, tworzony rekord w bazie z URL. Autoryzacja workspace-aware: osobiste → `userId`, zespołowe → membership weryfikowany przez `verifyTeamAccess`. |
| `/api/attachments/:id` | DELETE | Usunięcie załącznika. Weryfikacja przynależności przez zadanie/wydarzenie i workspace (osobisty = userId, zespołowy = membership). |

**Cechy załączników**:
- **Panel załączników**: Komponent `AttachmentPanel` w modalach zadań i wydarzeń
- **Typy plików**: Obrazy (JPEG, PNG, GIF, WebP) i PDF
- **Limity**: Zdefiniowane w shared/constants (rozmiar pliku i dozwolone typy MIME)
- **Autoryzacja workspace-aware**: Helper `assertResourceAccess(resource, userId)` — dla zadania/wydarzenia z `teamId === null` wymaga zgodności `userId`, dla `teamId !== null` deleguje do `verifyTeamAccess`. Zapobiega cross-workspace dostępowi do załączników zespołowych
- **Cleanup on failure**: Plik fizyczny jest usuwany (`safeUnlink`) z dysku jeśli walidacja / DB insert się nie powiodły — zapobiega zalewaniu uploadsów osieroconymi plikami
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
- **Routing do przypisanego** (zadania i wydarzenia): Jeśli `assigneeId` jest ustawione, powiadomienie trafia do przypisanego użytkownika. Fallback na twórcę (`userId`) jeśli brak przypisania. Selekcja Prisma obejmuje `assigneeId` i `teamId` w zapytaniu
- **Izolacja błędów**: Każde zadanie/wydarzenie przetwarzane w osobnym `try/catch` — błąd wysyłki dla jednego elementu nie przerywa przetwarzania pozostałych
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

### 3.11 Zespoły i Obszary robocze (Workspaces)

Funkcjonalność wielokontekstowej pracy — użytkownik może operować w swoim osobistym workspace'ie (jak dotychczas) lub przełączyć się na wspólny workspace zespołu. Wszystkie dane (zadania, wydarzenia, kategorie) są scopowane do aktywnego workspace'a.

#### 3.11.1 Koncepcja workspace'ów

Workspace jest abstrakcją widoku danych, nie osobnym modelem DB. Rozróżnienie odbywa się przez kolumnę `teamId`:
- **Workspace osobisty**: `teamId IS NULL` — dane filtrowane po `userId`
- **Workspace zespołowy**: `teamId = <teamId>` — dane filtrowane po `teamId`, dostępne dla wszystkich członków zespołu

Dzięki temu istniejąca logika CRUD pozostaje, a jedyną zmianą jest dodanie warunku workspace'a do zapytań Prisma.

#### 3.11.2 Backend — Zespoły (Teams API)

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/teams` | POST | Tworzenie nowego zespołu. W transakcji: tworzy `Team`, dodaje twórcę jako `OWNER` w `TeamMember`, tworzy domyślną kategorię "Ogólne" dla zespołu. Walidacja body przez `createTeamSchema` z shared. |
| `/api/teams` | GET | Lista zespołów użytkownika. Zwraca zespoły z dołączonymi polami `myRole` (rola użytkownika) i `memberSince` (data dołączenia). |
| `/api/teams/:id/members` | GET | Lista członków zespołu. Wymaga członkostwa (verifyTeamAccess). Zwraca dane użytkowników (id, email, name, avatarUrl) z rolą i datą dołączenia. |
| `/api/teams/:id/invites` | POST | Generowanie zaproszeń. **Tylko OWNER** może wywoływać. Przyjmuje tablicę emaili, deduplikuje, generuje 8-znakowy hex code (`randomBytes(4)`). Upsert z retry (do 8 prób przy kolizji kodu P2002). Zaproszenie ważne 7 dni. |
| `/api/teams/join` | POST | Dołączanie do zespołu kodem. Weryfikuje: kod istnieje, status PENDING, nie wygasł. Tworzy `TeamMember` z rolą MEMBER, zmienia status zaproszenia na ACCEPTED. Blokuje ponowne dołączanie. |

**Mechanizm autoryzacji zespołów**:
- `verifyTeamAccess(userId, teamId)` — utility sprawdzający istnienie `TeamMember` dla pary (teamId, userId). Rzuca `ApiError(403)` przy braku dostępu.
- `ensureCategoryMatchesWorkspace(userId, categoryId, teamId)` — utility weryfikujący, że kategoria przypisana do zadania/wydarzenia należy do tego samego workspace'a. Zapobiega cross-workspace przypisywaniu kategorii.

#### 3.11.3 Backend — Refaktoryzacja kontrolerów

W ramach tego feature'a nastąpił istotny refactoring architektury backendu:
- **Wydzielenie kontrolerów**: Logika z inline route handlerów (`routes/tasks.ts`, `routes/events.ts`, `routes/categories.ts`) przeniesiona do dedykowanych plików kontrolerów (`controllers/taskController.ts`, `controllers/eventController.ts`, `controllers/categoryController.ts`)
- **Routery jako czyste deklaracje**: Pliki route'ów zawierają teraz wyłącznie deklarację ścieżek → kontrolerów
- **Nowy middleware**: `validateRequest.ts` — generyczny middleware walidacji `req.body` schematem Zod, zastępujący powtarzalną walidację wewnątrz handlerów
- **Wspólne walidatory z shared**: Kontrolery importują schematy Zod z pakietu `shared` zamiast definiować lokalne duplikaty (`taskQuerySchema`, `getCategoriesQuerySchema`, `getEventsQuerySchema`, `createTeamSchema`, etc.)

**Wzorzec autoryzacji w kontrolerach** — każdy kontroler implementuje helper `findXForUser(id, userId)`:
1. Pobiera rekord z DB
2. Jeśli `teamId` jest ustawione → sprawdza membership użytkownika w `TeamMember`
3. Jeśli `teamId` jest null → sprawdza `userId` i `teamId === null`
4. Zwraca rekord lub null (404)

#### 3.11.4 Backend — Zmiany w modelu danych

**Nowe modele Prisma**:

| Model | Opis |
|-------|------|
| `Team` | Zespół: id, name, timestamps. Relacje: members, invitations, tasks, events, categories. |
| `TeamMember` | Członkostwo: teamId + userId (unique compound), role (OWNER/MEMBER), joinedAt. Cascade delete z Team i User. |
| `TeamInvitation` | Zaproszenie: teamId, email, code (unique), status (PENDING/ACCEPTED), expiresAt. Cascade delete z Team. |

**Nowe enumy**: `TeamRole` (OWNER, MEMBER), `InvitationStatus` (PENDING, ACCEPTED).

**Nowe kolumny w istniejących modelach**:

| Model | Kolumna | Typ | Opis |
|-------|---------|-----|------|
| Category | teamId | String? | FK do Team, nullable. NULL = kategoria osobista. |
| Task | teamId | String? | FK do Team, nullable. NULL = zadanie osobiste. |
| Event | teamId | String? | FK do Team, nullable. NULL = wydarzenie osobiste. |

**Zmienione constrainty**:
- `categories` unique: `(userId, name)` → `(userId, name, teamId)` — ta sama nazwa kategorii może istnieć w różnych workspace'ach
- Nowe indeksy: `(userId, teamId)` na categories, tasks, events — przyspieszenie zapytań workspace-scoped

**Migracja**: `20260416160000_add_teams_workspaces/migration.sql`

#### 3.11.5 Frontend — Workspace Switcher

Nowy komponent `WorkspaceSwitcher` w nagłówku (`Layout`):

- **Popover z listą workspace'ów**: Konto osobiste + lista zespołów z GET `/api/teams`
- **Ikony**: User (osobiste), Building2 (zespół), z wizualnym oznaczeniem aktywnego workspace'a (check icon)
- **Akcje z popover'a**: "Utwórz nowy zespół" (→ `CreateTeamModal`), "Dołącz z kodem" (→ `JoinTeamModal`)
- **Przycisk ustawień**: Widoczny tylko przy aktywnym workspace zespołowym → otwiera `TeamManagerModal`
- **Label "Obszar"**: Nad switcherem, widoczny od breakpointu `sm`

#### 3.11.6 Frontend — Modale zespołów

| Modal | Plik | Opis |
|-------|------|------|
| `CreateTeamModal` | `components/teams/CreateTeamModal.tsx` | Formularz tworzenia zespołu (pole "Nazwa zespołu"). Po sukcesie: refetch listy zespołów, automatyczne przełączenie na nowy workspace. |
| `JoinTeamModal` | `components/teams/JoinTeamModal.tsx` | Formularz dołączania kodem zaproszenia (pole monospace). Po sukcesie: refetch zespołów, przełączenie na dołączony workspace. |
| `TeamManagerModal` | `components/teams/TeamManagerModal.tsx` | Panel zarządzania aktywnym zespołem: lista członków z rolami, sekcja generowania zaproszeń (tylko OWNER). Pole textarea na emaile (separator: przecinek, średnik, whitespace), generowanie kodów z możliwością kopiowania do schowka. |

#### 3.11.7 Frontend — Warstwa danych (hooks i query keys)

**Nowy store**: `useWorkspaceStore` (Zustand + `persist` middleware):
- Stan: `activeWorkspaceId: string | null` (null = workspace osobisty)
- Persystencja w `localStorage` pod kluczem `mlm-workspace-context`
- Czyszczony przy logout/login/register przez `clearClientSession()`

**Centralizacja query keys** (`lib/queryKeys.ts`):
- Wszystkie klucze zapytań zawierają `teamId` jako drugi segment: `['tasks', teamId, 'inbox']`, `['events', teamId, startDate, endDate]`, `['categories', teamId]`
- Zmiana workspace'a automatycznie tworzy nowe wpisy w cache (nie kolidują z danymi innego workspace'a)

**Auto-inwalidacja** (`WorkspaceQueryInvalidation` w `App.tsx`):
- Renderless component nasłuchujący zmiany `activeWorkspaceId`
- Przy zmianie: inwaliduje `['tasks']`, `['events']`, `['categories']` (refetch danych nowego workspace'a)
- Ignoruje pierwszy render (ref `previousWorkspaceId`)

**Nowe hooki**:

| Hook | Plik | Opis |
|------|------|------|
| `useTeams` | `hooks/useTeams.ts` | Pobieranie listy zespołów użytkownika |
| `useTeamMembers` | `hooks/useTeams.ts` | Pobieranie członków konkretnego zespołu |
| `useCreateTeamMutation` | `hooks/useTeams.ts` | Mutacja tworzenia zespołu z auto-refetch |
| `useJoinTeamMutation` | `hooks/useTeams.ts` | Mutacja dołączania kodem z auto-refetch |
| `useInviteMembersMutation` | `hooks/useTeams.ts` | Mutacja generowania zaproszeń |
| `useCategories` | `hooks/useCategories.ts` | Pobieranie kategorii scopowanych do aktywnego workspace'a |
| `useTasks` | `hooks/useTasks.ts` | Pobieranie zadań (inbox lub scheduled) scopowanych do workspace'a |
| `useEvents` | `hooks/useEvents.ts` | Pobieranie wydarzeń scopowanych do workspace'a |

**Ekstrakcja QueryClient** (`lib/queryClient.ts`):
- Singleton `QueryClient` wyekstrahowany z `main.tsx` do osobnego modułu — umożliwia import w `clearClientSession` i w store'ach bez cyklicznych zależności

**Optymistyczne aktualizacje cache** (`lib/workspaceTaskCache.ts`):
- `snapshotTaskCaches(queryClient, teamId)` — snapshot inbox + scheduled caches dla danego workspace'a
- `restoreTaskCaches(queryClient, snapshot)` — rollback przy błędzie mutacji
- `patchTaskInTaskCaches(queryClient, teamId, taskId, patch)` — optymistyczny patch zadania we wszystkich cache'ach workspace'a
- Zastępuje ręczne `setQueriesData` rozrzucone po TaskInbox, CalendarView, TaskModal

**Centralizacja obsługi błędów API** (`lib/apiErrors.ts`):
- `getApiErrorMessage(error)` — ekstrakcja czytelnego komunikatu z odpowiedzi Axios, Zod validation errors, i nested error obiektów
- Używane w modalach zespołów zamiast surowego `error.message`

#### 3.11.8 Frontend — Zmiany w istniejących komponentach

**CalendarView**:
- Dane pobierane przez hooki `useTasks({ scope: 'scheduled' })` i `useEvents()` zamiast monolitycznego `useQuery(['calendar-items'])`
- Budowanie `calendarData` przeniesione do `useMemo` (zamiast w `queryFn`)
- Dodana logika kolapsowania all-day eventów w widoku tygodniowym: domyślnie max 2 widoczne, przycisk "+N więcej" / "Zwiń całodniowe"
- Kolory zadań na kalendarzu: niebieski (oczekujące) / zielony (ukończone) — niezależne od kategorii
- Inwalidacja cache: `['tasks']` i `['events']` zamiast `['calendar-items']` i `['inbox-tasks']`

**TaskInbox**:
- Dane pobierane przez `useTasks({ scope: 'inbox' })` i `useCategories()`
- Nowa mutacja: `moveDeadlineToTodayMutation` — przycisk "Przesuń na dziś" widoczny przy zadaniach w sekcji "zaległe" (overdue), zmienia datę deadline'u zachowując godzinę
- Tworzenie kategorii: automatycznie dołącza `teamId` aktywnego workspace'a

**TaskModal**:
- Tworzenie zadania: dołącza `teamId` z aktywnego workspace'a
- Quick deadline buttons: "Dzisiaj", "Jutro", "W przyszłym tygodniu" — szybkie ustawianie deadline'u z zachowaniem godziny
- Optimistic toggle complete: korzysta z `workspaceTaskCache` utilities

**EventModal**:
- Tworzenie wydarzenia: dołącza `teamId` z aktywnego workspace'a
- Inwalidacja cache zaktualizowana do nowych kluczy

**SearchBar**, **AttachmentPanel**:
- Kategorie pobierane z hooka `useCategories()` zamiast inline `useQuery`
- Inwalidacja cache zaktualizowana

**Layout**:
- Dodanie `WorkspaceSwitcher` obok istniejących elementów nagłówka

**authStore**:
- Login/register/logout/checkAuth: wywołują `clearClientSession()` (czyszczenie cache React Query + reset aktywnego workspace'a)

#### 3.11.9 Zmiany CSS

- Completed task na kalendarzu: `opacity: 0.4` → `opacity: 0.92` (kolor tła zielony wystarczająco odróżnia ukończone)
- Task card padding: `p-3` → `px-3 py-2` (kompaktniejsze karty)
- Priority 4 (pilne): poprawiony kontrast kolorów w dark mode (`#fecaca` zamiast `dark:text-red-300`)

#### 3.11.10 Przypisywanie osób (Assignee / cowork)

Mechanizm delegowania zadań i wydarzeń konkretnemu członkowi zespołu. Stanowi uzupełnienie workspace'ów — zadanie / wydarzenie należy do zespołu (`teamId`), ale może być dodatkowo przypisane do jednego konkretnego użytkownika (`assigneeId`).

**Model danych**:

| Model | Kolumna | Typ | Opis |
|-------|---------|-----|------|
| Task | assigneeId | String? | FK do User (SetNull przy usuwaniu użytkownika). NULL = nieprzypisane |
| Event | assigneeId | String? | FK do User (SetNull przy usuwaniu użytkownika). NULL = nieprzypisane |

**Nowe relacje Prisma**:
- `User.tasks` (relacja "TaskOwner") + `User.assignedTasks` (relacja "TaskAssignee")
- `User.events` (relacja "EventOwner") + `User.assignedEvents` (relacja "EventAssignee")
- Nowe indeksy: `tasks(assigneeId)`, `tasks(teamId, assigneeId)`, `events(assigneeId)`, `events(teamId, assigneeId)` — przyspieszenie zapytań "moje przypisania w zespole X"

**Migracje**:
- `20260416164655_add_event_assignee/migration.sql`
- `20260416170000_add_task_assignee/migration.sql`

**Reguły walidacji (`resolveAssigneeId`)** — helper w `taskController` i `eventController`:
1. `assigneeId === undefined` → pole nie zmieniane (UPDATE) lub nie ustawiane (CREATE)
2. `assigneeId === null` → explicit unassign
3. `teamId === null` (workspace osobisty): assignee **musi** być aktualnym użytkownikiem, inaczej `403` ("Personal tasks/events can only be assigned to yourself")
4. `teamId !== null` (workspace zespołowy): weryfikacja istnienia rekordu `TeamMember(teamId, userId=assigneeId)`; brak członkostwa → `400` ("Assignee is not a member of this team")

**Workspace change auto-nullification**: Przy UPDATE, jeśli `teamId` się zmienia i wywołujący nie podał `assigneeId`, istniejący `assigneeId` jest re-walidowany w kontekście **nowego** workspace'a. Jeśli dotychczasowy assignee nie należy do nowego zespołu — jest automatycznie ustawiany na `null` (zamiast błędu).

**Domyślne wartości**:
- `EventController.createEvent`: jeśli `assigneeId` nie został podany, domyślnie ustawiany jest **acting user** (twórca). Odzwierciedla intuicję "moje wydarzenie, chyba że inaczej zaznaczę"
- `TaskController.createTask`: brak domyślnego assignee — zadanie bez przypisania pozostaje niezaprzypisane

**Payload odpowiedzi**: Endpoints `GET/POST/PATCH /tasks/*` i `/events/*` dołączają zagnieżdżone pole `assignee: { id, name, avatarUrl, email } | null` (select przez relację) — pozwala wyświetlić avatar i dane bez dodatkowego zapytania o użytkownika.

**Frontend — komponent `AssigneeAvatar`** (`components/AssigneeAvatar.tsx`):
- Wyświetla avatar użytkownika (jeśli `avatarUrl`) z fallbackiem na inicjał (pierwsza litera imienia lub emaila) na niebieskim tle
- Trzy rozmiary: `xs` (5×5), `sm` (6×6), `md` (8×8)
- Obsługa błędu ładowania obrazu (`onError` → fallback do inicjału)
- Tooltip "Assigned to: {name|email}" (wyłączany przez `showTitle={false}`)

**Integracja w komponentach**:
- **TaskCard**: Mały avatar w prawym górnym rogu karty obok tytułu
- **CalendarView**: Avatar `size="xs"` po prawej stronie w `renderEventContent` (zarówno dla task jak i event)
- **TaskModal / EventModal**: Dropdown "Przypisany do" — widoczny **tylko** gdy `activeWorkspaceId !== null` (czyli w workspace zespołowym). Lista członków pobierana z `useTeamMembers(activeWorkspaceId)`. Dostępne opcje: "Nieprzypisane" (null) + każdy członek zespołu z avatarem, nazwą i emailem. Dropdown zablokowany w trybie `view`
- Ikona `UserRound` z Lucide obok labela dropdownu

**Integracja z cronem przypomnień**: Jeśli `task.assigneeId` lub (w przyszłości) `event.assigneeId` jest ustawione, powiadomienie push trafia do assignee, nie do twórcy — zob. sekcja 3.9.

---

## 4. Model danych

### Team
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| name | String | Nazwa zespołu |
| createdAt / updatedAt | DateTime | Znaczniki czasu |

### TeamMember
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| teamId | String | FK do Team |
| userId | String | FK do User |
| role | TeamRole (OWNER/MEMBER) | Rola w zespole |
| joinedAt | DateTime | Data dołączenia |
| @@unique | (teamId, userId) | Użytkownik raz w zespole |

### TeamInvitation
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| teamId | String | FK do Team |
| email | String | Email zapraszanego |
| code | String (unique) | 8-znakowy hex kod zaproszenia |
| status | InvitationStatus (PENDING/ACCEPTED) | Status zaproszenia |
| expiresAt | DateTime | Czas wygaśnięcia (7 dni) |
| createdAt | DateTime | Data utworzenia |

### User
| Pole | Typ | Opis |
|------|-----|------|
| id | String (cuid) | Identyfikator |
| email | String (unique) | Adres email |
| password | String | Hash bcrypt |
| name | String? | Imię/nazwa |
| avatarUrl | String? | URL avatara |
| createdAt / updatedAt | DateTime | Znaczniki czasu |
| teamMembers | TeamMember[] | Relacja do członkostw w zespołach |

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
| teamId | String? | FK do Team (null = kategoria osobista) |
| @@unique | (userId, name, teamId) | Unikalność w obrębie workspace'a |
| @@index | (userId, teamId) | Indeks workspace-scoped |

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
| userId | String | FK do User (twórca, relacja "TaskOwner") |
| assigneeId | String? | FK do User (przypisany, relacja "TaskAssignee", SetNull) |
| teamId | String? | FK do Team (null = zadanie osobiste) |
| categoryId | String? | FK do Category |
| @@index | (userId, teamId) | Indeks workspace-scoped |
| @@index | (assigneeId), (teamId, assigneeId) | Indeksy dla zapytań "moje przypisania" |

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
| userId | String | FK do User (twórca, relacja "EventOwner") |
| assigneeId | String? | FK do User (przypisany, relacja "EventAssignee", SetNull) |
| teamId | String? | FK do Team (null = wydarzenie osobiste) |
| categoryId | String? | FK do Category |
| @@index | (userId, teamId) | Indeks workspace-scoped |
| @@index | (assigneeId), (teamId, assigneeId) | Indeksy dla zapytań "moje przypisania" |

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
- **`TaskModal`** — Pełna edycja zadania: cykliczność, przypomnienia (ReminderPicker), załączniki (AttachmentPanel), priorytety, kategorie, przypisywanie do członka zespołu (dropdown widoczny w workspace zespołowym)
- **`EventModal`** — Pełna edycja wydarzenia: lokalizacja, cykliczność, przypomnienia, załączniki, przypisywanie do członka zespołu (dropdown widoczny w workspace zespołowym; nowe wydarzenia domyślnie przypisywane do twórcy)
- **`Layout`** — Nagłówek z SearchBar, toggle powiadomień push, przełącznik motywu, logout
- **`SearchBar`** — Globalna cross-workspace wyszukiwarka z debounce, skrót Ctrl/Cmd+K, integracja z modalami, `WorkspaceBadge` przy każdym wyniku, automatyczne przełączenie aktywnego workspace'a przy kliknięciu wyniku z obcego zespołu
- **`AssigneeAvatar`** — Awatar przypisanej osoby (obraz z fallbackiem na inicjał). Rozmiary xs/sm/md, używany w `TaskCard`, `CalendarView`, `TaskModal`, `EventModal`

### Zarządzanie stanem

- **Zustand** (`authStore`) — token w localStorage, login/register/logout, `checkAuth()` przy starcie
- **Zustand** (`useWorkspaceStore`) — aktywny workspace (teamId | null), persystencja w localStorage, czyszczony przy zmianie sesji
- **TanStack Query** — cache z `staleTime` 5 minut; query keys scopowane do workspace'a (np. `['tasks', teamId, 'inbox']`); auto-inwalidacja przy zmianie workspace'a
- **ThemeContext** — light/dark/system

### Klient API

Axios z `baseURL: '/api'`, automatyczny Bearer token, obsługa `FormData` (usunięcie Content-Type), automatyczny logout i redirect do `/login` przy 401. Centralizacja obsługi błędów: `getApiErrorMessage()` z `lib/apiErrors.ts`.

---

## 6. Pakiet współdzielony (shared)

| Moduł | Opis |
|-------|------|
| `types.ts` | Typy TypeScript: Team, TeamMember, TeamInvitation, TeamRole, InvitationStatus, User, Category, Task, Event, CalendarItem, ApiResponse, AuthResponse, PaginatedResponse, **SearchResultType, SearchResultItem, SearchResponse**. Modele Category, Task, Event rozszerzone o opcjonalne `teamId` i `team?`. Task/Event dodatkowo o `assigneeId?` i zagnieżdżony `assignee?: Pick<User, 'id' \| 'name' \| 'avatarUrl' \| 'email'>`. |
| `validators.ts` | Schematy Zod: auth, kategorie, zadania, wydarzenia, zakres dat, query parametry, zespoły (createTeamSchema, inviteMembersSchema, joinTeamSchema), **search (searchQuerySchema, searchResultItemSchema, searchResponseSchema)**. Schematy CRUD rozszerzone o `teamId` i `assigneeId` (cuid, nullable, optional). Schematy query (getCategoriesQuerySchema, getTasksQuerySchema, getEventsQuerySchema) scopowane do workspace'a. |
| `constants.ts` | Stałe: priorytety (etykiety, kolory), domyślne kategorie (seed), etykiety cykliczności, nazwy widoków FullCalendar, domyślne sloty czasowe, limity uploadu, **etykiety workspace'ów (`PERSONAL_WORKSPACE_LABEL = 'Konto osobiste'`, `TEAM_WORKSPACE_FALLBACK_LABEL = 'Zespół'`)** |

**Uwaga**: Schematy Zod w pakiecie shared są teraz importowane przez kontrolery backendowe, co zmniejsza duplikację walidacji między API a shared. Kontrolery rozszerzają shared schematy o dodatkowe pola specyficzne dla endpointu (np. `dateString` refinement).

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
4. **Wyszukiwarka — ograniczenia pól**: Przeszukuje tylko tytuł i opis — nie uwzględnia kategorii, lokalizacji ani załączników. (Scope workspace'ów został naprawiony: zwraca wyniki osobiste + ze wszystkich zespołów użytkownika, każdy wynik zawiera `teamId`/`teamName`)
5. **Paginacja**: Typ `PaginatedResponse` istnieje w shared, ale żaden endpoint API nie implementuje paginacji
6. **README**: Dokumentacja API w README jest niekompletna — brakuje wielu endpointów (attachments, search, notifications, health, PATCH /auth/me, teams)
7. **Cykliczne zadania**: W przeciwieństwie do wydarzeń, zadania z `recurrenceRule` nie generują syntetycznych instancji — pole jest w modelu, ale logika rozwijania cykliczności nie jest w pełni zaimplementowana dla zadań
8. **Workspace — brak wysyłania emaili z zaproszeniami**: Endpoint generuje kody zaproszeń, ale ich dostarczenie do zaproszonych osób jest manualne (kopiowanie kodów). Brak integracji z serwisem email
9. **Workspace — brak zarządzania członkami**: Brak endpointów do usuwania członków z zespołu, zmiany ról (MEMBER → OWNER), ani opuszczania zespołu. Brak endpointu usuwania/edycji zespołu
10. **Workspace — brak czyszczenia wygasłych zaproszeń**: Zaproszenia z przekroczonym `expiresAt` pozostają w DB (status PENDING). Brak crona czyszczącego
11. **Assignee — brak powiadamiania całego zespołu**: Cron przypomnień kieruje push do assignee (lub twórcy jako fallback). Nie ma opcji "powiadom wszystkich członków zespołu" dla zadań zespołowych bez przypisania — powiadamiany jest tylko twórca
12. **Assignee — brak filtrów "moje przypisania"**: Backend ma indeksy `(assigneeId)` i `(teamId, assigneeId)`, ale API endpointów list (GET /tasks, GET /events) nie przyjmuje parametru `assigneeId`. Frontend również nie oferuje przełącznika "tylko moje zadania w tym zespole"
13. **Assignee — brak historii zmian**: Reassign zadania nie jest logowany — brak audytu kto i kiedy zmienił przypisanie
14. **Assignee dla wydarzeń — domyślne zachowanie**: `EventController.createEvent` domyślnie przypisuje nowe wydarzenia do twórcy (jeśli nie podano `assigneeId`). `TaskController.createTask` nie robi tego — tworzone zadanie jest bez assignee. Niespójne zachowanie może być mylące w UI
15. **Wyszukiwarka i assignee**: SearchBar nie wyświetla informacji o przypisanym użytkowniku w wynikach, nie pozwala też filtrować po assignee
