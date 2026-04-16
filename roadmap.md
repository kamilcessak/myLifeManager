# My Life Manager — Roadmapa produktowa

> Dokument utrzymywany jako checklist. Zaznaczaj `[x]` przy ukończonych pozycjach.
> Legenda priorytetów: **P0** = blocker dla produkcyjnego launchu, **P1** = dojrzałość produktu, **P2** = differentiation / long-tail.
> Legenda rozmiarów (T-shirt): **XS** < 1d, **S** 1–3d, **M** 3–7d, **L** 1–2 tyg, **XL** > 2 tyg.

---

## Spis treści

1. [Horyzont 0 — Production Hardening (2–4 tyg.)](#horyzont-0--production-hardening-24-tyg)
2. [Horyzont 1 — Trust Layer (1–3 mies.)](#horyzont-1--trust-layer-13-mies)
3. [Horyzont 2 — Scale & Differentiation (3–6 mies.)](#horyzont-2--scale--differentiation-36-mies)
4. [Horyzont 3 — Platform & Ecosystem (6+ mies.)](#horyzont-3--platform--ecosystem-6-mies)
5. [Cross-cutting / Continuous](#cross-cutting--continuous)
6. [Backlog pomysłów (nieuszeregowane)](#backlog-pomysłów-nieuszeregowane)

---

## Horyzont 0 — Production Hardening (2–4 tyg.)

Cel: doprowadzić aplikację do stanu, w którym można ją wystawić publicznie/pro-sumer bez ryzyka reputacyjnego.

### H0.1 Email delivery i onboarding zespołów  `P0` `L`

- [ ] Wybór i konfiguracja providera (Resend / SendGrid / Postmark / AWS SES)
- [ ] Warstwa serwisowa `EmailService` z template'ami (MJML lub react-email)
- [ ] Wysyłka emaila przy tworzeniu zaproszenia (`POST /api/teams/:id/invites`) zawierającego link z kodem
- [ ] Strona landing `/invite/:code` — automatyczne wklepanie kodu w `JoinTeamModal`
- [ ] Retry/requeue dla nieudanych wysyłek (outbox pattern lub tabela `EmailJob`)
- [ ] Konfiguracja SPF / DKIM / DMARC dla domeny produkcyjnej
- [ ] Rate-limit dla generowania zaproszeń (zapobieganie spamowi)

### H0.2 Password reset flow  `P0` `M`

- [ ] Model `PasswordResetToken` (token hash, userId, expiresAt, consumedAt)
- [ ] `POST /api/auth/password/request-reset` — generuje token, wysyła email (nie ujawnia czy email istnieje)
- [ ] `POST /api/auth/password/reset` — walidacja tokenu, ustawienie nowego hasła, jednorazowość
- [ ] Cron cleanup wygasłych tokenów (analogicznie do `InvitationCleanupCron`)
- [ ] Strony frontend: `/forgot-password`, `/reset-password/:token`
- [ ] Invalidacja sesji (wszystkie JWT-y) po resetcie — patrz H1.3

### H0.3 Email verification  `P0` `M`

- [ ] Model `EmailVerificationToken` (token hash, userId, email, expiresAt)
- [ ] Kolumna `User.emailVerifiedAt: DateTime?`
- [ ] Wysyłka linku weryfikacyjnego po rejestracji
- [ ] `POST /api/auth/verify-email` — walidacja tokenu, ustawienie `emailVerifiedAt`
- [ ] Endpoint `POST /api/auth/verify-email/resend` z rate-limitem
- [ ] UI: banner w nagłówku "Potwierdź email" + przycisk "Wyślij ponownie"
- [ ] Opcjonalnie (feature flag): blokada zaproszeń do zespołów dla niezweryfikowanych kont

### H0.4 Rate limiting  `P0` `S`

- [ ] Instalacja `express-rate-limit` (Redis store dla multi-instance) lub `rate-limiter-flexible`
- [ ] Per-IP limit na `/api/auth/login` (5/min, exponential backoff)
- [ ] Per-IP limit na `/api/auth/register` (3/h)
- [ ] Per-IP limit na `/api/auth/password/request-reset` (3/h)
- [ ] Per-user limit na `/api/search` (30/min)
- [ ] Globalny limit per IP (np. 300 req/min) — safety net
- [ ] Response headers `RateLimit-*` dla klienta
- [ ] UI: friendly message przy 429 (toast "Za dużo prób, spróbuj za chwilę")

### H0.5 Error tracking i observability  `P0` `M`

- [ ] Sentry (lub Bugsnag / Rollbar) — integracja backend + frontend
- [ ] Source maps upload przy build frontu
- [ ] Structured logging (pino lub winston JSON) zamiast `console.log`
- [ ] Request ID propagation (middleware `req.id` + zwracanie `X-Request-Id`)
- [ ] Podstawowe metryki: `/api/health` rozszerzony o sprawdzenie DB connection, migracji, VAPID config
- [ ] Metryki Prometheus (opcjonalnie) lub StatsD — request count, latency p50/p95/p99, error rate

### H0.6 Paginacja — pierwsze endpointy  `P0` `M`

- [ ] Standard response envelope: `{ data, pagination: { cursor, hasMore, total? } }`
- [ ] Cursor-based pagination w `GET /api/tasks/inbox` (domyślny limit 50)
- [ ] Cursor-based pagination w `GET /api/search` (limit 25, "load more")
- [ ] Cursor-based pagination w `GET /api/tasks/:id/activity` (limit 50)
- [ ] Frontend: infinite scroll / "Load more" w `TaskInbox` i `SearchBar`
- [ ] Zaktualizować typ `PaginatedResponse` w shared żeby faktycznie pasował

### H0.7 Testy fundamentów  `P0` `L`

- [ ] Setup Jest / Vitest + supertest dla API
- [ ] Testy jednostkowe `resolveAssigneeId` (wszystkie 4 przypadki × workspace personal/team)
- [ ] Testy solo-owner guard (delete user + leave team + change role)
- [ ] Testy `verifyTeamAccess`, `requireOwner`, `countTeamOwners`
- [ ] Testy `findTaskForUser` / `findEventForUser` (cross-workspace denial)
- [ ] Testy rozwijania RRULE (task i event) — boundary cases (DST, leap year, COUNT, UNTIL)
- [ ] Testy ActivityLog — atomowość w transakcji, best-effort przy błędzie
- [ ] CI workflow (GitHub Actions) — test + lint + typecheck na każdym PR

### H0.8 ActivityLog — fix cascade autora  `P0` `S`

- [ ] Migracja: zmiana `ActivityLog.userId` z `Cascade` na `SetNull`
- [ ] Denormalizacja autora: dodać kolumny `authorName`, `authorEmail` (snapshot w momencie wpisu)
- [ ] Helper `logActivity` uzupełnia snapshot przy zapisie
- [ ] Renderer frontendu `TaskActivityLog` fallbackuje na denormalizowane pola gdy `user === null`
- [ ] Backfill denormalizacji dla istniejących wpisów (one-off script)

---

## Horyzont 1 — Trust Layer (1–3 mies.)

Cel: zbudować zaufanie wymagane do B2B / pro-sumer użycia.

### H1.1 MFA / 2FA  `P1` `L`

- [ ] Model `UserMfa` (userId, secret, backupCodes[], enabledAt)
- [ ] TOTP (RFC 6238) — `POST /api/auth/mfa/setup` zwraca secret + QR code (otpauth URL)
- [ ] `POST /api/auth/mfa/verify-setup` — weryfikacja pierwszego kodu, włączenie MFA
- [ ] `POST /api/auth/mfa/disable` — wymaga hasła + kodu TOTP
- [ ] Generowanie 10 backup codes przy setupie, hashowanie w DB, markowanie zużytych
- [ ] Flow logowania: jeśli `mfaEnabled` → krok drugi z kodem TOTP
- [ ] UI w `SecurityTab`: sekcja "Uwierzytelnianie dwuskładnikowe" z setupem i wyświetleniem QR
- [ ] Opcjonalnie: WebAuthn / passkeys jako alternatywa / dodatek

### H1.2 Soft-delete konta i zespołu  `P1` `L`

- [ ] Kolumna `deletedAt: DateTime?` na `User`, `Team`, `Task`, `Event` (soft-delete paradigm)
- [ ] Alternatywnie: osobna tabela `DeletionRequest` (userId/teamId, scheduledFor, reason)
- [ ] Zmiana `DELETE /api/auth/me` — oznacza konto jako `pendingDeletion` + `scheduledPurgeAt = now + 30d`
- [ ] Blokada logowania konta w trash (ale z możliwością recovery)
- [ ] Endpoint `POST /api/auth/account/recover` — przywrócenie w oknie 30d
- [ ] Analogicznie `DELETE /api/teams/:id` — trash zespołu z recovery
- [ ] Cron `startAccountPurgeCron` (daily) — twarde czyszczenie po 30d
- [ ] Email powiadomienia: "Konto zostanie usunięte za X dni", "Konto zostało trwale usunięte"
- [ ] UI: strona "Twoje konto jest w trakcie usuwania" z przyciskiem "Przywróć"

### H1.3 Session management  `P1` `M`

- [ ] Model `Session` (id, userId, createdAt, lastUsedAt, userAgent, ip, revokedAt)
- [ ] JWT zawiera `sessionId` w payloadzie zamiast tylko `sub`
- [ ] Middleware sprawdzający czy sesja nie jest revoked (Redis cache dla performance)
- [ ] `GET /api/auth/sessions` — lista aktywnych sesji użytkownika
- [ ] `DELETE /api/auth/sessions/:id` — revoke konkretnej sesji
- [ ] `DELETE /api/auth/sessions` — revoke wszystkich (poza bieżącą lub włącznie)
- [ ] UI w `SecurityTab`: sekcja "Aktywne sesje" z listą urządzeń i geolokalizacją po IP
- [ ] Auto-revoke wszystkich sesji po zmianie hasła i po reset password

### H1.4 Rozszerzony Activity Log  `P1` `L`

- [ ] Nowe akcje dla Task: `CHANGED_TITLE`, `CHANGED_DESCRIPTION`, `CHANGED_PRIORITY`, `CHANGED_CATEGORY`, `CHANGED_SCHEDULED_TIME`, `CHANGED_RECURRENCE`, `CHANGED_REMINDER`, `DELETED`
- [ ] ActivityLog dla `Event` — analogiczny model `EventActivityLog` lub polimorficzny `activityLog(entityType, entityId)`
- [ ] ActivityLog dla `Team` (zmiana nazwy, dodanie/usunięcie członka, zmiana roli, usunięcie zespołu)
- [ ] Endpoint `GET /api/events/:id/activity`
- [ ] Endpoint `GET /api/teams/:id/activity`
- [ ] Frontend: komponent generyczny `ActivityLog` reużywany w Task/Event/Team modal
- [ ] Filtry w activity log: po autorze, po typie akcji, po zakresie dat

### H1.5 Pełny RODO export  `P1` `M`

- [ ] Eksport rozszerzony o dane zespołowe (`teamId != null`) gdzie user jest autorem lub assignee
- [ ] Eksport członkostw w zespołach (`TeamMember`)
- [ ] Eksport wpisów ActivityLog których user jest autorem
- [ ] Eksport push subscriptions (metadane, bez kluczy kryptograficznych)
- [ ] Eksport załączników — metadane + downloadable archive (ZIP w tle, email z linkiem po wygenerowaniu)
- [ ] Asynchroniczne generowanie dużych eksportów (job queue) zamiast synchronicznego endpointu
- [ ] Czas życia linku do eksportu (7 dni) + auto-cleanup

### H1.6 Comments / Mentions  `P1` `L`

- [ ] Model `Comment` (taskId/eventId, userId, content, createdAt, updatedAt, deletedAt)
- [ ] Wsparcie dla @mentions (parser markdown-like, przechowywanie `mentionedUserIds[]`)
- [ ] Endpointy CRUD: `GET/POST/PATCH/DELETE /api/tasks/:id/comments` (+ analog events)
- [ ] Walidacja: wspomnieć można tylko członków tego samego workspace'a
- [ ] Push notification do wspomnianego użytkownika
- [ ] Wpis w ActivityLog: `COMMENTED`, `MENTIONED_USER`
- [ ] Frontend: sekcja komentarzy w `TaskModal` / `EventModal`, widget @mention z autocomplete członków
- [ ] Inline editing własnego komentarza, soft-delete dla siebie i dla OWNER

### H1.7 Preferencje powiadomień  `P1` `M`

- [ ] Model `NotificationPreferences` (userId, key, channel, enabled) — klucze per typ zdarzenia
- [ ] Typy: `TASK_REMINDER`, `TASK_ASSIGNED`, `TASK_DEADLINE_CHANGED`, `EVENT_REMINDER`, `COMMENT_MENTION`, `TEAM_INVITE`, `TEAM_REMOVED`, etc.
- [ ] Kanały: `push`, `email`, `in_app`
- [ ] Endpointy `GET/PATCH /api/me/notification-preferences`
- [ ] Cron przypomnień respektuje preferencje
- [ ] Email notifications (digest opcja: "Wysyłaj email jednym zbiorczym raportem raz dziennie")
- [ ] UI w `PreferencesTab`: matryca typ × kanał z toggle'ami
- [ ] Preset "Do Not Disturb" (godziny wyciszenia per strefa czasowa)

---

## Horyzont 2 — Scale & Differentiation (3–6 mies.)

Cel: skalowalność techniczna + cechy wyróżniające produkt na rynku.

### H2.1 Cron jako dedykowany worker  `P1` `L`

- [ ] Wybór kolejki: BullMQ (Redis) lub pg-boss (PostgreSQL-native)
- [ ] Wydzielenie `apps/worker` jako osobny proces z własnym Dockerfile
- [ ] Migracja `startReminderCron` → job queue z dokładnym scheduleem per event (zamiast polling co minutę)
- [ ] Migracja `startInvitationCleanupCron`, `startAttachmentCleanupCron`, nowy `startAccountPurgeCron`
- [ ] Dead-letter queue + retry policy
- [ ] Monitoring queue depth i job latency
- [ ] Kompatybilność z horizontal scaling API (workery nie duplikują pracy)

### H2.2 RRULE Exceptions — edycja pojedynczego wystąpienia  `P1` `XL`

- [ ] Model `RecurrenceException` (parentTaskId/parentEventId, originalDate, overrideData JSON, isCancelled)
- [ ] API: edycja instancji RRULE → zapis do `RecurrenceException` zamiast oryginalnego zadania
- [ ] Opcje UI: "Tylko to wystąpienie" / "To i następne" / "Cała seria"
- [ ] Tryb "To i następne" — split serii: stara seria z `UNTIL`, nowa seria od tej daty
- [ ] Rozwijanie recurring uwzględnia exceptions przy generowaniu syntetycznych instancji
- [ ] Usunięcie wystąpienia (`isCancelled: true`) wyklucza je z listy
- [ ] Frontend dialog wyboru zakresu edycji (wzorem Google Calendar)

### H2.3 Advanced search  `P1` `L`

- [ ] Rozszerzony scope: tytuł, opis, lokalizacja, nazwa kategorii, nazwa załącznika, komentarze
- [ ] Operatory w query: `priority:4`, `assignee:me`, `category:Dom`, `deadline:<2026-05-01`, `is:completed`
- [ ] Filtry strukturalne w UI: workspace, kategoria, assignee, priorytet, zakres dat, stan
- [ ] Pełna paginacja wyników (cursor-based) — oddzielnie dla tasks i events
- [ ] Historia wyszukiwań (top 5 ostatnich) w dropdown `SearchBar`
- [ ] Zapisane filtry ("Moje priorytety 1 na ten tydzień") — per user
- [ ] Opcjonalnie: full-text search z PG `tsvector` zamiast `ILIKE contains` dla wydajności

### H2.4 Installable PWA + offline-first inbox  `P2` `L`

- [ ] Manifest PWA, ikony, splash screen, theme color
- [ ] Service Worker rozszerzony o caching strategii (network-first dla API, cache-first dla assetów)
- [ ] IndexedDB (np. Dexie) dla offline cache zadań i kategorii
- [ ] Offline queue mutacji (create/update task) — replay przy powrocie online
- [ ] Visual indicator "Offline mode" w Layout
- [ ] Konflikty przy synchronizacji: last-write-wins z logiem konfliktu dla usera
- [ ] "Install app" prompt w UI

### H2.5 Sub-categories / Tags / Labels  `P2` `M`

- [ ] Decyzja: hierarchiczne kategorie (parentId) vs osobny model `Tag`
- [ ] Jeśli tagi: model `Tag` (name, color, teamId/userId) + `TaskTag`, `EventTag` (many-to-many)
- [ ] Endpointy CRUD tagów
- [ ] Filtrowanie zadań/wydarzeń po tagach (multiple, AND/OR)
- [ ] UI: tag picker w `TaskModal`, `EventModal`, `TaskInbox`
- [ ] Auto-complete + tworzenie w locie

### H2.6 Attachments — pending upload UX  `P2` `M`

- [ ] Public endpoint `POST /api/attachments/pending` (multipart, bez taskId/eventId)
- [ ] Zwraca `attachmentId` z `expiresAt` (np. +24h)
- [ ] Endpoint `POST /api/attachments/:id/attach` — dowiązanie do istniejącego task/event
- [ ] Flow w `TaskModal` tryb "create": upload pliku przed submitem → attachmentIds w body create
- [ ] Frontend: preview pliku w modalu przed zapisaniem zadania
- [ ] Inline preview PDF (react-pdf) i pełny lightbox dla obrazów

### H2.7 Zaawansowane cechy kalendarza  `P2` `L`

- [ ] Multi-day drag (przeciąganie zadania na kilka dni)
- [ ] Time zones per wydarzenie (pole `timeZone` na Event)
- [ ] Widok "Agenda" (lista chronologiczna zamiast siatki)
- [ ] Widok roczny (heatmap aktywności)
- [ ] Copy/duplicate event / task z shortcut
- [ ] Working hours / free-busy per user (podstawy pod scheduling assistant)

### H2.8 Dashboard / Raporty  `P2` `L`

- [ ] Widok `/stats` lub sekcja w Dashboard
- [ ] Metryki: zadania ukończone w tygodniu/miesiącu, streak dni z 100% ukończenia, top kategorie, avg czas realizacji
- [ ] Wykres workload per assignee (w workspace zespołowym)
- [ ] Productivity insights: "W poniedziałki kończysz 40% więcej zadań niż w środy"
- [ ] Export raportu do PDF

---

## Horyzont 3 — Platform & Ecosystem (6+ mies.)

Cel: otwarcie platformy, integracje, mobile.

### H3.1 Aplikacja mobilna  `P2` `XL`

- [ ] Decyzja: React Native / Expo vs dokończenie PWA
- [ ] Struktura `mobile/` workspace — faktyczne wypełnienie zadeklarowanego slotu
- [ ] Współdzielenie API client i typów przez `shared`
- [ ] Native push (FCM/APNs) zamiast tylko Web Push
- [ ] Biometric login (FaceID/TouchID)
- [ ] Offline-first (IndexedDB → SQLite lub WatermelonDB)
- [ ] Native share target — dodanie zadania przez Share Sheet z innych aplikacji
- [ ] App Store / Play Store submission (screenshots, privacy policy, review)

### H3.2 Public API + OAuth2  `P2` `XL`

- [ ] OAuth2 provider (authorization code + PKCE) — `/api/oauth/authorize`, `/api/oauth/token`
- [ ] Model `OAuthApp` (clientId, clientSecret hash, redirectUris, scopes)
- [ ] Model `AccessToken`, `RefreshToken` z scopes
- [ ] Strona developer portal (`/developers`) — zarządzanie aplikacjami
- [ ] Dokumentacja API: OpenAPI 3 + Swagger UI / Stoplight
- [ ] SDK TypeScript (auto-generated z OpenAPI)
- [ ] Webhooks (`POST https://customer-url` przy zdarzeniach: task.created, task.completed, event.created, etc.)
- [ ] Rate limiting per app

### H3.3 Integracje natywne  `P2` `XL`

- [ ] Google Calendar (two-way sync) — import eventów + export jako external calendar
- [ ] Apple Calendar / iCloud (CalDAV server w MLM)
- [ ] Outlook / Microsoft 365
- [ ] Slack: slash command `/mlm add [task]`, powiadomienia na kanał
- [ ] Discord bot (analogicznie)
- [ ] Zapier / Make integration
- [ ] iCal feed per workspace (read-only subscription URL)
- [ ] Email-to-task (`inbox+userhash@mlm.app` → automatyczne utworzenie zadania)

### H3.4 Billing / Subscriptions  `P2` `XL`

- [ ] Decyzja modelu: freemium (limity zespołów/zadań) / paid (trial + subskrypcja) / open-source self-host
- [ ] Integracja Stripe (lub Paddle — upraszcza VAT EU)
- [ ] Modele `Subscription`, `Invoice`, `PaymentMethod`
- [ ] Webhooks Stripe → aktualizacja statusu subskrypcji
- [ ] Feature flags per plan (Free / Pro / Team / Enterprise)
- [ ] Admin panel: lista użytkowników, subskrypcji, możliwość recovery, refundów
- [ ] Strona pricing + checkout

### H3.5 AI features  `P2` `L`

- [ ] "Natural language task input" — "Spotkanie z Anią jutro o 15 dotyczące projektu X" → wypełnia pola
- [ ] Smart scheduling suggestion — AI proponuje sloty w kalendarzu na podstawie free-busy
- [ ] Auto-categorization — LLM sugeruje kategorię przy tworzeniu
- [ ] Weekly review summary (co zrobiłem, co następne, sugestie)
- [ ] Transkrypcja + extraction action items z notatek głosowych / spotkań
- [ ] Decyzja modelu: OpenAI API (proste) vs self-hosted LLM (koszt/prywatność)
- [ ] Opt-in per user (privacy concerns)

---

## Cross-cutting / Continuous

Zadania nie pasujące do konkretnego horyzontu, ale wymagające stałej uwagi.

### Bezpieczeństwo

- [ ] Audyt dependencies (npm audit) w CI + Dependabot / Renovate
- [ ] Audit log dostępów admina do bazy
- [ ] CSP headers w Caddy (nie tylko podstawowe security headers)
- [ ] Subresource Integrity dla external scripts (jeśli są)
- [ ] Regularny pentest (min. raz do roku przed kolejnym major release)
- [ ] Threat modeling dokument (STRIDE)
- [ ] Security.txt + program bug bounty (gdy dojrzejemy do publicznego launcha)
- [ ] Rotacja JWT_SECRET z grace period (key rotation)
- [ ] Migracja z `localStorage` JWT do `httpOnly cookie` + CSRF tokens (do rozważenia)

### Jakość kodu i dokumentacja

- [ ] Conventional Commits + semantic-release (auto changelog)
- [ ] Pre-commit hooks: lint-staged + typecheck
- [ ] Storybook dla komponentów designu (przynajmniej atomy + molekuły)
- [ ] Rozszerzona dokumentacja API (OpenAPI) — w tym wszystkie brakujące endpointy wspomniane w projectAnalysis pkt 5
- [ ] CONTRIBUTING.md
- [ ] Architecture Decision Records (ADR) dla istotnych decyzji
- [ ] `.cursor/rules` dla wzorców projektowych (naming, patterns, layering)

### Performance

- [ ] Baseline lighthouse audit (target: Performance > 90)
- [ ] Bundle analyzer + code splitting po trasach
- [ ] Lazy loading modalów (`React.lazy`)
- [ ] Optymalizacja RRULE expansion przy dużych zakresach (memoizacja, worker thread?)
- [ ] DB query analysis — EXPLAIN na top 10 najwolniejszych
- [ ] Connection pooling (pgBouncer) gdy > 1 instancja API
- [ ] CDN dla statycznych assetów
- [ ] Image optimization pipeline dla uploadowanych avatarów i attachmentów

### Skalowanie infrastruktury

- [ ] Managed PostgreSQL (RDS / Supabase / Neon) z automatycznymi backupami PITR
- [ ] Replikacja read-replica dla zapytań odczytowych
- [ ] Terraform / Pulumi dla infra-as-code
- [ ] Blue-green deployment lub canary releases
- [ ] Load testing (k6 / Artillery) — baseline dla 100, 500, 1000 concurrent users
- [ ] Backup weryfikacja — automatyczny test restore co tydzień

### A11y / i18n

- [ ] Audit dostępności (axe, pa11y) — target WCAG 2.1 AA
- [ ] Keyboard navigation we wszystkich modalach (nie tylko Profile)
- [ ] Skip links, focus trap w modalach, ARIA live regions dla toastów
- [ ] i18n framework (react-intl / next-intl) — przygotowanie pod wielojęzyczność
- [ ] Tłumaczenia: EN, PL, DE (kolejność wg targetu rynkowego)
- [ ] Locale-aware date/time formatting (`date-fns` już jest, rozszerzyć o intl)
- [ ] RTL support (jeśli docelowo języki arabskie/hebrajskie)

---

## Backlog pomysłów (nieuszeregowane)

Surowe pomysły do oceny produktowej — nie mają jeszcze priorytetu ani estymaty.

- [ ] Kanban / Board view (kolumny wg statusu lub kategorii)
- [ ] Gantt chart dla zadań z zależnościami (`blockedBy`, `blocks`)
- [ ] Zależności między zadaniami (graf, wizualizacja)
- [ ] Subtaski / checklista wewnątrz zadania
- [ ] Time tracking (start/stop timer, suma czasu spędzonego)
- [ ] Pomodoro timer zintegrowany
- [ ] Focus mode (ukrywa inbox, pokazuje tylko aktualne zadanie)
- [ ] Habit tracker (typ zadania "habit" z widokiem heatmapy)
- [ ] Cele (Goals) jako byt wyższego poziomu z progress barem agregującym podrzędne zadania
- [ ] Public share link dla zadania/wydarzenia (read-only)
- [ ] Cotygodniowy review (modal "Przegląd tygodnia" w piątek)
- [ ] Quick add z globalnego shortcut (Ctrl+N) bez otwierania modala
- [ ] Command palette (Ctrl+K rozszerzony) — nawigacja + akcje, nie tylko search
- [ ] Dark mode per workspace (różne motywy dla konta osobistego i zespołu)
- [ ] Custom fields per kategoria (user-defined properties)
- [ ] Przekazywanie własności zespołu (transfer ownership) — alternatywa dla "ostatniego OWNER guarda"
- [ ] Role pośrednie: OWNER / ADMIN / MEMBER / GUEST (viewer only)
- [ ] Guest users — członek z ograniczonym dostępem (tylko przypisane zadania, bez listy wszystkich)
- [ ] Cross-team task duplication / move
- [ ] Templates — szablon zadania / wydarzenia / zespołu do reużycia
- [ ] Recurring templates (szablon powtarzany cyklicznie, np. tygodniowy "zestaw spotkań")
- [ ] Print-friendly view kalendarza / inbox
- [ ] Export kalendarza do PDF (widok tygodniowy jako printable)
- [ ] Widget w menu bar (macOS) / system tray (Windows) — quick peek na dzisiejsze zadania
- [ ] Chrome extension — quick add z dowolnej strony
- [ ] Import z innych narzędzi (Todoist, TickTick, Asana, Trello) — kreator migracji
- [ ] "Scratch pad" per user — szybkie notatki nie będące zadaniem
- [ ] Integracja z note-taking apps (Obsidian, Notion) — backlink do notatek
- [ ] Voice input (dyktowanie zadania)
- [ ] Geofencing (przypomnienie "kup mleko" gdy jestem koło sklepu) — mobile only

---

## Metryki sukcesu roadmapy

Kryteria oceny czy roadmap zmierza w dobrym kierunku (do przeglądu co kwartał):

- [ ] Time-to-first-value: nowy użytkownik ma pierwsze zadanie + 1 event w kalendarzu w < 2 min od rejestracji
- [ ] Retention D7 > 40%, D30 > 20%
- [ ] NPS > 40 po 3 miesiącach używania
- [ ] Crash-free sessions > 99.5%
- [ ] p95 latency API < 300ms
- [ ] Lighthouse Performance > 90, Accessibility > 95
- [ ] Test coverage > 70% dla backendu, > 50% dla frontendu
- [ ] 0 krytycznych CVE w dependencies (Dependabot green)
- [ ] Mean time to recovery (MTTR) < 1h dla incydentów produkcyjnych

---

_Ostatnia aktualizacja roadmapy: 2026-04-16 (utworzenie na podstawie `projectAnalysis.md`)._
