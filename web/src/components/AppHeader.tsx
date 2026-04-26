import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  LogOut,
  Settings,
  User,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import AssigneeFilterToggle from './AssigneeFilterToggle';
import ProfileSettingsModal from './profile/ProfileSettingsModal';
import SearchBar from './SearchBar';
import WorkspaceSwitcher from './layout/WorkspaceSwitcher';

export default function AppHeader() {
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
    <>
      <header className="app-header">
        <div className="flex min-w-[220px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-[var(--app-text)]">My Life Manager</h1>
            <p className="truncate text-xs text-[var(--app-text-muted)]">Zarządzaj czasem efektywnie</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 justify-center px-4">
          <SearchBar />
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <AssigneeFilterToggle variant="compact" />
          <WorkspaceSwitcher />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="h-7 w-7 rounded-full border border-[var(--app-border)] object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]">
                  <User className="h-4 w-4" />
                </span>
              )}
              <span className="hidden max-w-[10rem] truncate sm:inline">{user?.name || user?.email}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {isAccountMenuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-lg">
                <div className="px-2 pb-2">
                  <p className="truncate text-sm font-medium text-[var(--app-text)]">{user?.name || user?.email}</p>
                  {user?.name && user?.email ? (
                    <p className="truncate text-xs text-[var(--app-text-muted)]">{user.email}</p>
                  ) : null}
                </div>

                <div className="my-1 h-px bg-[var(--app-border)]" />

                <button
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
                >
                  <Settings className="h-4 w-4" />
                  <span>Ustawienia profilu</span>
                </button>

                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Wyloguj</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
}
