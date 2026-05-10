# Analiza projektu mobile i porównanie z web

## Cel dokumentu

Ten dokument opisuje stan aplikacji mobilnej w projekcie `myLifeManager`, jej architekturę, funkcje, przepływy API oraz różnice względem aplikacji web. Najważniejsza część to lista braków w mobile względem web, uporządkowana według wpływu na użytkownika i złożoności wdrożenia.

Analizowane obszary:

- `mobile/` - aplikacja Expo / React Native.
- `web/` - aplikacja React / Vite.
- `shared/` - współdzielone typy i schematy, używane przez oba klienty.

## Executive summary

Aplikacja mobile jest już sensownie zbudowanym klientem natywnym: ma logowanie i rejestrację, skrzynkę zadań, kalendarz, szczegóły i edycję zadań oraz wydarzeń, załączniki, kontekst workspace, filtr "tylko moje", podstawowe zarządzanie członkami zespołu, profil, motyw oraz eksport/usunięcie konta. Architektura jest spójna: Expo, React Navigation, TanStack Query z persystencją cache, Zustand, Axios oraz `SecureStore` dla tokenu.

Web jest jednak funkcjonalnie pełniejszy. Największe braki mobile względem web to: brak globalnego wyszukiwania, brak kategorii i filtrowania po kategoriach, bardzo ograniczony formularz tworzenia/edycji zadania, brak tworzenia wydarzeń z poziomu UI, brak powtarzalności i przypomnień w formularzach, brak pełnego zarządzania zespołem (tworzenie, edycja, usuwanie, zaproszenia, join code), brak zmiany hasła i avataru oraz niedokończona integracja push notifications.

Priorytetowo warto uzupełnić mobile o:

1. Kategorie i filtrowanie, bo web opiera na tym nawigację i porządkowanie zadań.
2. Pełne formularze task/event: kategoria, termin, schedule, all-day, reminder, assignee, recurrence.
3. Wyszukiwanie globalne `/search`.
4. Pełny profil i bezpieczeństwo: avatar oraz zmiana hasła.
5. Zespoły: zaproszenia, join code, tworzenie/ustawienia/usuwanie zespołów.
6. Push notifications w wariancie zgodnym z Expo.

## Mobile - stack i architektura

### Stack technologiczny

Mobile używa:

- Expo `~54`, React Native `0.81`, React `19`.
- React Navigation: native stack, bottom tabs.
- TanStack Query `v5` z `PersistQueryClientProvider` i `AsyncStorage`.
- Zustand do stanu sesji, workspace, filtra assignee i preferencji motywu.
- Axios jako klient HTTP.
- `expo-secure-store` dla tokenu JWT.
- `expo-notifications`, `expo-image-picker`, `expo-document-picker`, `expo-file-system`, `expo-sharing`.
- `react-native-big-calendar` dla widoku kalendarza.
- `react-hook-form`, Zod i schematy z `@mlm/shared`.

Kluczowe pliki:

- `mobile/App.tsx` - główne providery, NetInfo, persisted React Query.
- `mobile/src/navigation/RootNavigator.tsx` - wybór auth/app stack.
- `mobile/src/navigation/MainTabs.tsx` - zakładki `Inbox`, `Calendar`, `Profile`.
- `mobile/src/lib/apiClient.ts` - Axios, JWT, globalna obsługa `401`.
- `mobile/src/config/apiBaseUrl.ts` - konfiguracja adresu API.
- `mobile/src/store/authStore.ts` - sesja użytkownika.
- `mobile/src/lib/queryKeys.ts` - klucze cache.

### Nawigacja

Aplikacja mobilna ma klasyczny układ natywny:

- `AuthStack`: `LoginScreen`, `RegisterScreen`.
- `AppStack`: `MainTabs`, `TaskDetail`, `TaskEdit`, `EventEdit`, `TeamManager`.
- `MainTabs`: `Inbox`, `Calendar`, `Profile`.
- `ProfileStack`: profil, preferencje wyglądu, konto i dane.

To jest bardziej natywne i czytelne na telefonie niż webowy pojedynczy dashboard z overlayami. Web ma tylko trasy `/login`, `/register` i `/`, a szczegóły funkcji są realizowane przez modale, panele i store UI.

### Dane i cache

Mobile używa TanStack Query dla danych serwerowych oraz persystuje cache przez `AsyncStorage` na maksymalnie 7 dni. To jest mocny punkt aplikacji mobilnej, bo daje sensowną bazę pod słabszą sieć i częściową pracę offline.

Dane lokalne:

- `authStore` - użytkownik, status logowania, bootstrap `/auth/me`, login/register/logout.
- `workspaceStore` - aktywny workspace, ale bez persystencji.
- `assigneeFilterStore` - filtr "tylko moje", persystowany.
- `themePreferencesStore` - preferencja motywu, persystowana.

Różnica względem web: web persystuje aktywny workspace w `localStorage` (`mlm-workspace-context`), mobile resetuje workspace do osobistego po restarcie aplikacji. Dla użytkowników zespołów może to być odczuwalne jako regres UX.

### HTTP i auth

Mobile ma centralny `apiClient`:

- `baseURL` pochodzi z `getApiBaseUrl()`.
- Token JWT jest czytany asynchronicznie z `SecureStore`.
- `401` czyści token, czyści query cache i wylogowuje lokalnie użytkownika.

To jest bezpieczniejsze niż webowy `localStorage`, ale ma jeden praktyczny problem: `apiBaseUrl.ts` ma komentarz o Android Emulator `10.0.2.2`, a faktycznie domyślnie używa hardcoded `192.168.1.69`. Bez `EXPO_PUBLIC_API_BASE_URL` aplikacja może nie działać na innym komputerze, sieci albo emulatorze.

## Mobile - funkcje obecne

### Auth

Mobile obsługuje:

- logowanie `/auth/login`;
- rejestrację `/auth/register`;
- bootstrap sesji `/auth/me`;
- wylogowanie i czyszczenie sesji lokalnej;
- aktualizację profilu w zakresie imienia/nazwy przez `/auth/me`;
- eksport danych `/auth/export`;
- usunięcie konta `/auth/me`.

Brakuje względem web:

- zmiany hasła przez `/auth/password`;
- uploadu avataru przez `/auth/avatar`;
- pełniejszego UI profilu z zakładką bezpieczeństwa.

### Skrzynka zadań

`InboxScreen` pobiera `/tasks/inbox`, uwzględnia aktywny workspace i filtr assignee. Jest też szybki modal tworzenia zadania.

Obecny zakres tworzenia zadania w mobile jest jednak minimalny:

- tytuł;
- opis;
- opcjonalny `teamId` z aktywnego workspace.

Web przy tworzeniu zadania obsługuje znacznie więcej pól:

- kategoria;
- priorytet;
- `deadline`;
- `scheduledStart`, `scheduledEnd`;
- `scheduledAllDay`;
- `reminderMinutes`;
- `assigneeId`;
- załączniki kolejkowane już przy tworzeniu;
- prefilling z zaznaczenia slotu w kalendarzu.

### Kalendarz

Mobile ma `CalendarScreen` z `react-native-big-calendar`, łączy dane z:

- `/tasks` dla zaplanowanych zadań;
- `/events` dla wydarzeń.

Obsługuje przejście do szczegółów zadania i edycji wydarzenia oraz planowanie zadania przez modal slotu. Jest to dobra baza.

Brakuje względem web:

- tworzenia wydarzenia z UI;
- tworzenia zadania bezpośrednio z pełnym planowaniem;
- powtarzalności (`recurrenceRule`) w formularzu;
- przypomnień (`reminderMinutes`) w formularzu;
- przypisywania osoby (`assigneeId`) w formularzu event/task;
- kategorii i filtrowania po kategorii;
- funkcji typu "Dzisiaj" jako osobnej akcji nawigacyjnej widocznej w web sidebarze.

### Szczegóły i edycja zadania

Mobile ma:

- ekran szczegółów zadania;
- aktywność zadania `/tasks/:id/activity`;
- edycję tytułu, opisu i priorytetu;
- panel załączników;
- ukończenie zadania.

Brakuje względem web:

- edycji kategorii;
- edycji harmonogramu i deadline;
- edycji all-day;
- edycji przypomnienia;
- edycji osoby przypisanej;
- usuwania zadania z UI;
- pełnego trybu view/edit w jednym panelu;
- obsługi załączników dodawanych w trakcie tworzenia nowego zadania.

### Wydarzenia

Mobile ma:

- pobieranie wydarzeń w zakresie dat;
- szczegóły wydarzenia;
- edycję tytułu, opisu, miejsca, czasu i all-day;
- załączniki dla wydarzeń.

Brakuje względem web:

- tworzenia nowego wydarzenia z UI;
- usuwania wydarzenia;
- kategorii;
- przypomnień;
- powtarzalności;
- assignee w kontekście zespołu;
- pełniejszego formularza daty/godziny, jaki web realizuje przez `DatePicker` i `TimePicker`.

### Załączniki

Mobile ma `AttachmentPanel` i API:

- upload przez `/attachments/upload`;
- delete przez `/attachments/:id`;
- obsługę plików/dokumentów przez Expo moduły.

To jest funkcjonalnie blisko web. Różnica jest głównie w tworzeniu encji: web pozwala kolejować pliki podczas tworzenia nowego task/event i uploaduje je po utworzeniu encji. Mobile obsługuje załączniki głównie na ekranach edycji/szczegółów istniejących encji.

### Workspace i zespoły

Mobile ma:

- listę zespołów `/teams`;
- wybór workspace osobisty/zespół;
- ekran członków zespołu `/teams/:id/members`;
- zmianę roli członka;
- wyrzucenie członka;
- opuszczenie zespołu.

Brakuje względem web:

- tworzenia zespołu;
- edycji nazwy zespołu;
- usuwania zespołu;
- generowania zaproszeń `/teams/:id/invites`;
- dołączania do zespołu przez kod `/teams/join`;
- zakładki ustawień zespołu;
- zakładki zaproszeń;
- pełnej obsługi uprawnień właściciela w UI.

### Profil i konto

Mobile ma:

- widok profilu;
- edycję imienia;
- preferencję motywu: jasny, ciemny, systemowy;
- eksport danych;
- usunięcie konta;
- wylogowanie.

Brakuje względem web:

- uploadu avataru;
- zmiany hasła;
- preferencji push notifications w UI;
- bardziej kompletnego podziału profilu na zakładki: profil, bezpieczeństwo, preferencje, konto.

### Push notifications

Web ma implementację Web Push:

- `notificationsApi.getVapidPublicKey`;
- `notificationsApi.subscribe`;
- `notificationsApi.unsubscribe`;
- `public/sw.js`;
- UI w preferencjach profilu.

Mobile ma hook `usePushNotifications`, ale w kodzie jest jawny komentarz, że backend endpoint `/api/notifications/subscribe` oczekuje struktury webowej, a nie Expo tokenu. To oznacza, że integracja push w mobile jest niedokończona i wymaga uzgodnienia kontraktu API.

## Web - funkcje istotne dla porównania

Web jest aplikacją React/Vite z jednym głównym dashboardem. Centralne elementy:

- `web/src/lib/api.ts` - pełna mapa API klienta.
- `web/src/components/CalendarView.tsx` - główny widok pracy.
- `web/src/components/TaskModal.tsx` - pełny formularz zadania.
- `web/src/components/EventModal.tsx` - pełny formularz wydarzenia.
- `web/src/components/SearchBar.tsx` - globalne wyszukiwanie.
- `web/src/components/AppSidebar.tsx` - kategorie i nawigacja.
- `web/src/components/profile/ProfileSettingsModal.tsx` - profil, bezpieczeństwo, preferencje, konto.
- `web/src/components/teams/TeamManagerModal.tsx` - członkowie, zaproszenia, ustawienia zespołu.

Najważniejsze funkcje web, których mobile nie ma albo ma tylko częściowo:

- globalne wyszukiwanie z `/search`;
- kategorie `/categories`;
- tworzenie i zarządzanie kategoriami;
- filtrowanie zadań i wydarzeń po kategorii;
- pełny CRUD task/event;
- recurrence rule dla wydarzeń i zadań;
- reminders;
- assignee picker;
- pełne zarządzanie zespołem;
- zaproszenia i join code;
- avatar;
- zmiana hasła;
- web push preferences;
- persystencja aktywnego workspace;
- responsywna warstwa mobilna web, która ma wyszukiwarkę, kategorie i profil w bottom nav.

## Porównanie mobile vs web

| Obszar | Web | Mobile | Status mobile |
| --- | --- | --- | --- |
| Auth login/register | Tak | Tak | OK |
| Bootstrap sesji | Tak | Tak | OK |
| Token storage | `localStorage` | `SecureStore` | Mobile lepiej pod kątem bezpieczeństwa |
| Skrzynka zadań | Tak | Tak | OK, ale bez kategorii |
| Kalendarz | Tak, FullCalendar | Tak, native calendar | OK, ale mniej funkcji |
| Zadania - tworzenie | Pełny formularz | Tytuł + opis | Duży brak |
| Zadania - edycja | Pełny formularz | Tytuł + opis + priorytet | Duży brak |
| Zadania - usuwanie | Tak | Brak w UI | Brak |
| Wydarzenia - tworzenie | Tak | Brak w UI | Duży brak |
| Wydarzenia - edycja | Pełny formularz | Podstawowy formularz | Częściowo |
| Wydarzenia - usuwanie | Tak | Brak w UI | Brak |
| Kategorie | CRUD + filtr | Brak | Duży brak |
| Globalne wyszukiwanie | Tak | Brak | Duży brak |
| Załączniki | Tak | Tak | Prawie OK |
| Załączniki przy tworzeniu | Tak | Brak | Brak UX |
| Workspace switcher | Tak | Tak | OK |
| Persystencja workspace | Tak | Nie | Brak UX |
| Filtr "tylko moje" | Tak | Tak | OK |
| Lista członków zespołu | Tak | Tak | OK |
| Role członków | Tak | Tak | OK |
| Opuszczenie zespołu | Tak | Tak | OK |
| Zaproszenia do zespołu | Tak | Brak | Brak |
| Join team code | Tak | Brak | Brak |
| Tworzenie zespołu | Tak | Brak | Brak |
| Edycja/usuwanie zespołu | Tak | Brak | Brak |
| Avatar | Tak | Brak | Brak |
| Zmiana hasła | Tak | Brak | Brak |
| Eksport danych | Tak | Tak | OK |
| Usunięcie konta | Tak | Tak | OK |
| Motyw | Tak | Tak | OK |
| Push notifications | Web Push | Expo hook z TODO | Niedokończone |
| Offline awareness | Standard web | NetInfo + persisted cache | Mobile mocniejsze |

## Braki mobile względem web - szczegółowo

### P0 - braki blokujące parytet funkcjonalny

#### 1. Brak kategorii

Web ma pełną obsługę `/categories`, tworzenie kategorii w sidebarze, filtr `all`/`none`/konkretna kategoria i query keys zależne od workspace. Mobile nie ma hooków, ekranów ani API dla kategorii.

Wpływ:

- Użytkownik mobile nie może korzystać z podstawowego sposobu organizacji pracy z web.
- Zadania i wydarzenia utworzone/przypisane do kategorii na web nie mają równoważnego UX w mobile.
- Mobile nie może filtrować widoku inbox/kalendarza po kategorii.

Rekomendacja:

- Dodać `useCategories`, `categoriesApi` albo osobne hooki zgodne z istniejącym stylem mobile.
- Dodać `categoryFilterStore`.
- Rozszerzyć `InboxScreen` i `CalendarScreen` o filtr kategorii.
- Rozszerzyć formularze task/event o wybór kategorii.
- Dodać minimalne tworzenie kategorii, najlepiej w osobnym ekranie lub bottom sheet.

#### 2. Ograniczone formularze zadań

Mobile przy tworzeniu zadania obsługuje tylko `title` i `description`, a przy edycji tylko `title`, `description`, `priority`. Web obsługuje pełny model zadania.

Brakuje pól:

- `categoryId`;
- `deadline`;
- `scheduledStart`;
- `scheduledEnd`;
- `scheduledAllDay`;
- `reminderMinutes`;
- `assigneeId`;
- prawdopodobnie obsługi `recurrenceRule` w UI;
- usuwania zadania.

Wpływ:

- Mobile tworzy uboższe zadania niż web.
- Użytkownik musi wracać do web, żeby dopiąć deadline, kategorię, przypomnienie, przypisanie albo harmonogram.
- Kalendarz mobile jest bardziej widokiem niż pełnym centrum planowania.

Rekomendacja:

- Rozbudować `CreateTaskModal` lub zastąpić go pełnym ekranem `TaskEditScreen` działającym w trybie create/edit.
- Rozszerzyć `TaskPatchPayload` i `CreateTaskInput`.
- Współdzielić jak najwięcej logiki z `@mlm/shared` i lokalnymi mapperami dat.

#### 3. Brak tworzenia wydarzeń

Web ma `EventModal` z pełnym create/edit. Mobile ma edycję istniejącego wydarzenia i pobieranie szczegółów, ale nie ma widocznego przepływu tworzenia eventu.

Brakuje:

- przycisku/akcji "Dodaj wydarzenie";
- wyboru typu po kliknięciu slotu: zadanie czy wydarzenie;
- formularza create event;
- obsługi kategorii, przypomnienia, recurrence i assignee.

Wpływ:

- Mobile nie jest pełnoprawnym klientem kalendarza.
- Użytkownik może przeglądać i edytować część danych, ale nowe wydarzenia musi tworzyć w web.

Rekomendacja:

- Dodać flow podobny do webowego `SelectAddTypeModal`: wybór zadanie/wydarzenie po tapnięciu slotu.
- Zaimplementować `useCreateEventMutation`.
- Ujednolicić formularz create/edit event.

#### 4. Brak globalnego wyszukiwania

Web ma `SearchBar` korzystający z `/search`, obsługujący wyniki task/event, skrót Cmd/Ctrl+K i przełączanie workspace, jeśli wynik jest z innego kontekstu. Mobile nie ma odwołań do `/search`.

Wpływ:

- Przy większej liczbie zadań i wydarzeń mobile będzie dużo trudniejszy w użyciu.
- Brak szybkiego dostępu do elementów z innych workspace.

Rekomendacja:

- Dodać tab lub ekran `Search`.
- Użyć typu `SearchResultItem` z `@mlm/shared`.
- Po wybraniu wyniku przełączać workspace, jeśli `teamId` wyniku różni się od aktywnego.
- Nawigować do `TaskDetail` albo `EventEdit`/nowego `EventDetail`.

### P1 - istotne braki produktowe

#### 5. Brak pełnego zarządzania zespołami

Mobile ma członków, role, usuwanie członków i opuszczenie zespołu. Web ma więcej:

- tworzenie zespołu;
- edycja nazwy;
- usunięcie zespołu;
- generowanie zaproszeń;
- kopiowanie kodów;
- join code;
- zakładki members/invites/settings.

Wpływ:

- Użytkownik mobilny nie może samodzielnie założyć zespołu ani zaprosić osób.
- Owner zespołu musi przejść do web, żeby zarządzać cyklem życia zespołu.

Rekomendacja:

- Rozszerzyć `WorkspaceSwitcher` o "Utwórz zespół" i "Dołącz kodem".
- Rozszerzyć `TeamManagerScreen` o taby: członkowie, zaproszenia, ustawienia.
- Dodać hooki dla `POST /teams`, `PATCH /teams/:id`, `DELETE /teams/:id`, `POST /teams/:id/invites`, `POST /teams/join`.

#### 6. Brak zmiany hasła i avataru

Web ma `SecurityTab` dla `/auth/password` i `AvatarUploader` dla `/auth/avatar`. Mobile ma tylko edycję imienia.

Wpływ:

- Mobile nie obsługuje podstawowych ustawień konta.
- Użytkownik nie może spójnie zarządzać tożsamością z telefonu.

Rekomendacja:

- Dodać ekran "Bezpieczeństwo" w `ProfileStack`.
- Dodać formularz zmiany hasła na schemacie `changePasswordSchema` z `@mlm/shared`.
- Dodać upload avataru z `expo-image-picker` i endpointem `/auth/avatar`.

#### 7. Niedokończone push notifications

Mobile ma hook Expo Notifications, ale endpoint backendu oczekuje `PushSubscriptionJSON` web, nie Expo tokenu.

Wpływ:

- Funkcja może nie działać mimo obecności kodu.
- Użytkownik mobile nie dostaje przypomnień/powiadomień zgodnie z oczekiwaniami.

Rekomendacja:

- Ustalić kontrakt backendu dla mobile, np. `POST /notifications/mobile/subscribe` albo rozszerzyć istniejący endpoint o `{ platform, token, deviceId }`.
- Dodać unsubscribe.
- Dodać UI w preferencjach mobile.
- Powiązać z `reminderMinutes` w task/event.

#### 8. Brak przypomnień i powtarzalności w UI

Web ma `ReminderPicker` oraz pola `recurrenceRule` w formularzach. Mobile pobiera dane, ale formularze ich nie obsługują.

Wpływ:

- Edycja w mobile może nieświadomie pominąć część semantyki obiektu.
- Użytkownik nie może stworzyć cyklicznych wydarzeń/zadań ani przypomnień z telefonu.

Rekomendacja:

- Dodać proste presetowe recurrence jak w web: codziennie, co tydzień, co 2 tygodnie, co miesiąc, co rok.
- Dodać picker przypomnienia.
- Upewnić się, że patch nie usuwa istniejących pól, jeśli użytkownik ich nie edytuje.

### P2 - braki UX i techniczne

#### 9. Brak persystencji workspace w mobile

Web persystuje `activeWorkspaceId`, mobile nie.

Wpływ:

- Po restarcie aplikacji użytkownik wraca do workspace osobistego.
- Dla osób pracujących głównie w zespole jest to uciążliwe.

Rekomendacja:

- Dodać `persist` dla `workspaceStore`, np. przez `AsyncStorage`.
- Resetować workspace przy logout i usunięciu konta, tak jak obecnie.

#### 10. Konfiguracja API na Androidzie

`apiBaseUrl.ts` deklaruje w komentarzu `10.0.2.2`, ale używa `192.168.1.69`.

Wpływ:

- Projekt jest mniej przenośny.
- Nowy developer może uruchomić Android emulator i dostać błąd połączenia.

Rekomendacja:

- Zmienić fallback Androida na `10.0.2.2`.
- Dla fizycznego urządzenia wymagać `EXPO_PUBLIC_API_BASE_URL`.
- Dodać notkę w README/mobile setup.

#### 11. Brak testów mobile

`mobile/package.json` ma tylko `typecheck`. Web ma lint/build, ale też nie widać tu rozbudowanej warstwy testów. Dla mobile brakuje nawet bazowego lint/test script.

Wpływ:

- Rozszerzanie formularzy i cache invalidation będzie bardziej ryzykowne.
- Parytet mobile-web będzie trudniej utrzymać.

Rekomendacja:

- Dodać przynajmniej typecheck w CI dla mobile, jeśli jeszcze nie jest podpięty.
- Rozważyć testy logiki hooków/mutacji i mapperów payloadów.
- Dodać checklistę manualną dla najważniejszych flow.

## Mocne strony mobile

Mobile ma kilka decyzji lepszych lub bardzo dobrze dopasowanych do natywnego klienta:

- Bezpieczniejsze przechowywanie tokenu w `SecureStore`.
- Persystowany cache React Query i integracja z NetInfo.
- Natywna nawigacja przez tabs/stack zamiast skomplikowanych overlayów.
- Dobre fundamenty pod offline i słabszą sieć.
- Spójna obsługa `401` i czyszczenie sesji.
- Użycie `@mlm/shared` dla typów i części walidacji.
- Załączniki działające przez natywne pickery.
- Ekran aktywności zadania i podstawowe zarządzanie członkami zespołu.

## Ryzyka implementacyjne przy domykaniu parytetu

### Rozrost formularzy

Największe ryzyko to szybkie rozbudowanie `CreateTaskModal`, `TaskEditScreen` i `EventEditScreen` do bardzo dużych komponentów. Web ma już rozbudowane modale, ale mobile powinno użyć bardziej natywnego podziału:

- osobny ekran create/edit;
- sekcje formularza;
- małe komponenty: wybór kategorii, assignee, reminder, recurrence, data/godzina.

### Cache invalidation

Mobile ma już klucze workspace i assignee. Po dodaniu kategorii trzeba pilnować, żeby query keys zawierały także filtr kategorii tam, gdzie jest potrzebny. W przeciwnym razie łatwo o stare dane po zmianie filtra.

### Zachowanie istniejących pól

Przy edycji encji mobile nie powinien usuwać pól, których formularz nie obsługuje. To szczególnie ważne dla `recurrenceRule`, `reminderMinutes`, `categoryId`, `assigneeId`, `scheduledStart` i `scheduledEnd`. Dopóki UI nie obsługuje pola, patch powinien go nie wysyłać.

### Push notifications

Nie warto kończyć UI push po stronie mobile bez uzgodnienia backendowego kontraktu dla Expo tokenów. Obecny hook ma właściwy kierunek, ale komentarz w kodzie wskazuje realny mismatch API.

## Rekomendowany roadmap mobile

### Etap 1 - porządkowanie techniczne

- Poprawić fallback Android API URL.
- Spersistować `workspaceStore`.
- Dodać podstawowy `mobile:typecheck` do root scripts, jeśli ma być uruchamiany z poziomu repo.
- Uporządkować typy payloadów task/event pod przyszłe pełne formularze.

### Etap 2 - kategorie i filtrowanie

- Dodać API/hooki kategorii.
- Dodać store filtra kategorii.
- Dodać UI wyboru kategorii w inbox i calendar.
- Dodać wybór kategorii w task/event.

### Etap 3 - pełne task/event

- Rozbudować create/edit task.
- Dodać create event.
- Dodać delete task/event.
- Dodać reminder, assignee, all-day, daty/godziny.
- Dodać recurrence presets.

### Etap 4 - search

- Dodać ekran wyszukiwania.
- Obsłużyć `/search`.
- Obsłużyć wyniki z innych workspace.
- Nawigować do szczegółów zadania/wydarzenia.

### Etap 5 - profil i zespoły

- Dodać zmianę hasła.
- Dodać avatar upload.
- Dodać tworzenie i dołączanie do zespołów.
- Rozszerzyć `TeamManagerScreen` o zaproszenia i ustawienia.

### Etap 6 - push notifications

- Uzgodnić backend API dla Expo.
- Dodać subscribe/unsubscribe.
- Dodać UI w preferencjach.
- Przetestować przypomnienia dla task/event.

## Najkrótsza ścieżka do parytetu z web

Jeśli celem jest jak najszybsze dogonienie web, rekomendowana kolejność jest następująca:

1. Kategorie + filtr kategorii.
2. Pełny formularz zadania.
3. Tworzenie i pełna edycja wydarzeń.
4. Globalne wyszukiwanie.
5. Profil: hasło + avatar.
6. Zespoły: invite/join/create/settings.
7. Push notifications.

Ta kolejność najpierw odblokowuje codzienną pracę użytkownika na mobile, a dopiero potem funkcje administracyjne i powiadomienia.

## Wnioski końcowe

Mobile nie jest prototypem - ma solidne fundamenty i obsługuje najważniejsze przepływy codziennego użycia: auth, inbox, kalendarz, szczegóły, podstawową edycję, workspace, załączniki i konto. Różnica względem web polega głównie na głębokości funkcji. Web jest pełnym klientem administracyjno-produkcyjnym, a mobile jest obecnie klientem do przeglądania, prostego tworzenia i podstawowej edycji.

Największy produktowy dług mobile to brak kategorii, brak pełnych formularzy task/event oraz brak wyszukiwania. Po uzupełnieniu tych trzech obszarów aplikacja mobilna stanie się znacznie bliższa realnemu parytetowi z web. Zmiana hasła, avatar, zespoły i push notifications są kolejnym krokiem do pełnej samodzielności użytkownika na urządzeniu mobilnym.
