import { ReactNode, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing, Calendar, Check, ChevronDown, LogOut, Monitor, Moon, User, Sun } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ThemeMode, useTheme } from '../context/ThemeContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import SearchBar from './SearchBar';
import WorkspaceSwitcher from './layout/WorkspaceSwitcher';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
    { value: 'light', label: 'Jasny', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Ciemny', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'Systemowy', icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Header */}
      <header className="h-16 px-4 flex items-center justify-between gap-4 border-b border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold app-text">My Life Manager</h1>
            <p className="text-xs app-text-muted">Zarządzaj czasem efektywnie</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 justify-center px-2">
          <SearchBar />
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <WorkspaceSwitcher />
          {permission !== 'unsupported' && (
            <button
              onClick={isSubscribed ? unsubscribe : subscribe}
              className="relative p-2 rounded-lg app-text-muted hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] transition-colors"
              title={
                permission === 'denied'
                  ? 'Powiadomienia zablokowane w przeglądarce'
                  : isSubscribed
                    ? 'Wyłącz powiadomienia'
                    : 'Włącz powiadomienia'
              }
              disabled={permission === 'denied' || permission === 'loading'}
            >
              {permission === 'denied' ? (
                <BellOff className="w-5 h-5" />
              ) : isSubscribed ? (
                <BellRing className="w-5 h-5 text-blue-500" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-2 text-sm app-text-muted hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] rounded-lg transition-colors"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
            >
              <User className="w-4 h-4" />
              <span>{user?.name || user?.email}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {isAccountMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-lg p-2 z-30">
                <p className="px-2 pb-2 text-xs font-semibold app-text-muted">Motyw</p>
                <div className="space-y-1">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTheme(option.value);
                        setIsAccountMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between rounded-md px-2 py-2 text-sm app-text hover:bg-[var(--app-surface-muted)]"
                    >
                      <span className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </span>
                      {theme === option.value ? <Check className="w-4 h-4 text-blue-500" /> : null}
                    </button>
                  ))}
                </div>

                {permission !== 'unsupported' && (
                  <>
                    <div className="my-2 h-px bg-[var(--app-border)]" />

                    <p className="px-2 pb-2 text-xs font-semibold app-text-muted">Powiadomienia push</p>

                    {permission === 'denied' ? (
                      <div className="px-2 py-2 text-xs app-text-muted">
                        <span className="flex items-center gap-2">
                          <BellOff className="w-4 h-4 shrink-0" />
                          Zablokowane w przeglądarce. Zmień w ustawieniach witryny.
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (isSubscribed) {
                            unsubscribe();
                          } else {
                            subscribe();
                          }
                        }}
                        disabled={permission === 'loading'}
                        className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm app-text hover:bg-[var(--app-surface-muted)]"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {isSubscribed ? (
                            <BellRing className="w-4 h-4 shrink-0 text-blue-500" />
                          ) : (
                            <Bell className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate">{isSubscribed ? 'Włączone' : 'Wyłączone'}</span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`shrink-0 w-9 h-5 rounded-full relative transition-colors duration-200 ${
                            isSubscribed ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              isSubscribed ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </span>
                      </button>
                    )}
                  </>
                )}

                <div className="my-2 h-px bg-[var(--app-border)]" />

                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Wyloguj</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  );
}
