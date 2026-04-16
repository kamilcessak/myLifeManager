import { ReactNode, useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import SearchBar from './SearchBar';
import WorkspaceSwitcher from './layout/WorkspaceSwitcher';
import ProfileSettingsModal from './profile/ProfileSettingsModal';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2 py-1.5 text-sm app-text-muted hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] rounded-lg transition-colors"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="w-7 h-7 rounded-full object-cover border border-[var(--app-border)]"
                />
              ) : (
                <span className="flex w-7 h-7 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]">
                  <User className="w-4 h-4" />
                </span>
              )}
              <span className="hidden sm:inline max-w-[10rem] truncate">{user?.name || user?.email}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {isAccountMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-lg p-2 z-30">
                <div className="px-2 pb-2">
                  <p className="text-sm font-medium app-text truncate">
                    {user?.name || user?.email}
                  </p>
                  {user?.name && user?.email ? (
                    <p className="text-xs app-text-muted truncate">{user.email}</p>
                  ) : null}
                </div>

                <div className="my-1 h-px bg-[var(--app-border)]" />

                <button
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm app-text hover:bg-[var(--app-surface-muted)]"
                >
                  <Settings className="w-4 h-4" />
                  <span>Ustawienia profilu</span>
                </button>

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

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}
