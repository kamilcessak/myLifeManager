import { ReactNode } from 'react';
import { Bell, BellOff, BellRing, Check, Monitor, Moon, Sun } from 'lucide-react';
import { ThemeMode, useTheme } from '../../../context/ThemeContext';
import { usePushNotifications } from '../../../hooks/usePushNotifications';

const themeOptions: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
  { value: 'light', label: 'Jasny', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Ciemny', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'Systemowy', icon: <Monitor className="h-4 w-4" /> },
];

export default function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const { permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--app-text)]">Motyw</h3>
        <p className="mb-3 text-xs text-[var(--app-text-muted)]">
          Wybierz jak aplikacja ma wyglądać. „Systemowy" dopasowuje się do ustawień Twojego
          urządzenia.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border-blue-500 bg-blue-500/10 text-[var(--app-text)]'
                    : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]'
                }`}
                aria-pressed={isActive}
              >
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
                {isActive ? <Check className="h-4 w-4 text-blue-500" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <div className="h-px bg-[var(--app-border)]" />

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
          <Bell className="h-4 w-4" />
          Powiadomienia push
        </h3>
        <p className="mb-3 text-xs text-[var(--app-text-muted)]">
          Otrzymuj przypomnienia o zadaniach i wydarzeniach nawet gdy aplikacja jest zamknięta.
        </p>

        {permission === 'unsupported' ? (
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 text-sm text-[var(--app-text-muted)]">
            Ta przeglądarka nie obsługuje powiadomień push.
          </div>
        ) : permission === 'denied' ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <BellOff className="h-4 w-4 shrink-0" />
            Powiadomienia zostały zablokowane w ustawieniach przeglądarki. Odblokuj je
            w ustawieniach witryny, aby włączyć tę funkcję.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isSubscribed) {
                unsubscribe();
              } else {
                subscribe();
              }
            }}
            disabled={permission === 'loading'}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-60"
            aria-pressed={isSubscribed}
          >
            <span className="flex min-w-0 items-center gap-2">
              {isSubscribed ? (
                <BellRing className="h-4 w-4 shrink-0 text-blue-500" />
              ) : (
                <Bell className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">
                {isSubscribed ? 'Włączone' : 'Wyłączone'}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                isSubscribed ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  isSubscribed ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        )}
      </section>
    </div>
  );
}
