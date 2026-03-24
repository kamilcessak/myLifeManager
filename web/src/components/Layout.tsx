import { ReactNode, useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown, LogOut, Monitor, Moon, User, Sun } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ThemeMode, useTheme } from '../context/ThemeContext';
import SearchBar from './SearchBar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
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

        <div className="flex-1 flex justify-center px-2">
          <SearchBar />
        </div>

        <div className="flex items-center gap-4">
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
