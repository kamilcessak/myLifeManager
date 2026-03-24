# My Life Manager

Aplikacja do zarządzania czasem w stylu Time Blocking. Łączy listę zadań (Inbox) z kalendarzem, umożliwiając przeciąganie zadań na konkretne godziny.

## Funkcje

- **Split View**: Lewy panel z zadaniami (Inbox), prawy panel z kalendarzem
- **Drag & Drop**: Przeciągnij zadanie z Inbox na kalendarz, aby je zaplanować
- **Kategorie**: Dom / Firma (z możliwością dodania własnych)
- **Priorytety**: Niski, Średni, Wysoki, Pilne
- **Powtarzalność**: Wydarzenia i zadania cykliczne (RRULE)
- **Deadline**: Kolorowanie zadań zbliżających się do terminu

## Architektura

```
/my-life-manager
├── /api          # Backend: Express.js + TypeScript + Prisma
├── /web          # Frontend: React + Vite + FullCalendar
├── /shared       # Współdzielone typy i walidatory Zod
└── /mobile       # Aplikacja mobilna: React Native + Expo
```

## Wymagania

- Node.js >= 18
- Yarn
- Docker + Docker Compose (opcjonalnie, rekomendowane)

## Instalacja

### Opcja A (rekomendowana): Docker, jeden start całego środowiska

```bash
cp api/.env.example api/.env
yarn docker:up
```

To uruchomi:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5433

Przydatne komendy:

```bash
yarn docker:down
yarn docker:logs
```

### Opcja B: lokalnie bez Dockera

#### 1. Sklonuj repozytorium i zainstaluj zależności

```bash
cd my-life-manager
yarn install
```

#### 2. Skonfiguruj bazę danych

Utwórz bazę PostgreSQL:

```sql
CREATE DATABASE mylifemanager;
```

Skopiuj plik `.env.example` do `.env` w folderze `/api`:

```bash
cp api/.env.example api/.env
```

Dostosuj `DATABASE_URL` w pliku `api/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mylifemanager?schema=public"
JWT_SECRET="twoj-tajny-klucz-jwt"
```

#### 3. Uruchom migracje bazy danych

```bash
yarn db:generate
yarn db:migrate
```

#### 4. Uruchom aplikację

W dwóch terminalach:

**Terminal 1 - Backend:**
```bash
yarn api:dev
```

**Terminal 2 - Frontend:**
```bash
yarn web:dev
```

Aplikacja będzie dostępna pod:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Prisma Studio (baza danych): `yarn db:studio`

#### 5. Aplikacja mobilna (Expo)

**Terminal 3 - Mobile:**
```bash
yarn mobile:start
```

Otwórz projekt w Expo Go (skanuj QR) lub uruchom emulator (np. `i` dla iOS, `a` dla Android w terminalu Expo).

Aby aplikacja mobilna łączyła się z API:
- **Emulator iOS:** domyślnie `http://localhost:3001`
- **Emulator Android:** ustaw w `mobile/.env`: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`
- **Fizyczne urządzenie:** ustaw `EXPO_PUBLIC_API_URL=http://<IP komputera>:3001` (API musi być uruchomione na tym samym LAN)

## API Endpoints

### Auth
- `POST /api/auth/register` - Rejestracja
- `POST /api/auth/login` - Logowanie
- `GET /api/auth/me` - Aktualny użytkownik

### Tasks
- `GET /api/tasks` - Lista zadań
- `GET /api/tasks/inbox` - Niezaplanowane zadania
- `POST /api/tasks` - Utwórz zadanie
- `PATCH /api/tasks/:id` - Aktualizuj zadanie
- `PATCH /api/tasks/:id/schedule` - Zaplanuj zadanie (drag & drop)
- `PATCH /api/tasks/:id/unschedule` - Usuń z kalendarza
- `DELETE /api/tasks/:id` - Usuń zadanie

### Events
- `GET /api/events` - Lista wydarzeń (z rozwinięciem RRULE)
- `POST /api/events` - Utwórz wydarzenie
- `PATCH /api/events/:id` - Aktualizuj wydarzenie
- `DELETE /api/events/:id` - Usuń wydarzenie

### Categories
- `GET /api/categories` - Lista kategorii
- `POST /api/categories` - Utwórz kategorię
- `PATCH /api/categories/:id` - Aktualizuj kategorię
- `DELETE /api/categories/:id` - Usuń kategorię

### Upload
- `POST /api/upload` - Upload obrazka (multipart/form-data)
- `DELETE /api/upload/:filename` - Usuń obrazek

## Tech Stack

### Backend
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Passport.js (JWT)
- Zod (walidacja)
- rrule (wydarzenia cykliczne)

### Frontend (Web)
- React 18
- Vite
- TypeScript
- TailwindCSS
- FullCalendar (z Drag & Drop)
- TanStack Query (React Query)
- Zustand (state management)
- date-fns

### Mobile (Expo)
- React Native (Expo SDK 52)
- React Navigation (Bottom Tabs)
- react-native-calendars (ExpandableCalendar + AgendaList)
- AsyncStorage (token)
- axios

## Licencja

MIT
