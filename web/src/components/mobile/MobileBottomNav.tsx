import { CalendarDays, FolderKanban, Plus, Search, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMobileNavStore, type MobileNavTab } from '../../store/useMobileNavStore';
import { useCalendarUiStore } from '../../store/useCalendarUiStore';

const NAV_ITEMS: { id: MobileNavTab; label: string; icon: typeof CalendarDays }[] = [
  { id: 'calendar', label: 'Kalendarz', icon: CalendarDays },
  { id: 'categories', label: 'Kategorie', icon: FolderKanban },
  { id: 'search', label: 'Szukaj', icon: Search },
  { id: 'profile', label: 'Profil', icon: User },
];

export default function MobileBottomNav() {
  const activeTab = useMobileNavStore((s) => s.activeTab);
  const setActiveTab = useMobileNavStore((s) => s.setActiveTab);
  const requestCreateTask = useCalendarUiStore((s) => s.requestCreateTask);
  const bottomSheetOpen = useCalendarUiStore((s) => s.mobileTaskBottomSheetOpen);

  return (
    <>
      <nav className="mobile-bottom-nav flex md:hidden" aria-label="Nawigacja mobilna">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'mobile-bottom-nav__item',
                active && 'mobile-bottom-nav__item--active',
              )}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="mobile-bottom-nav__label">{label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={requestCreateTask}
        className={cn('mobile-fab flex md:hidden', bottomSheetOpen && 'mobile-fab--hidden')}
        aria-label="Dodaj zadanie"
        title="Dodaj zadanie"
      >
        <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
      </button>
    </>
  );
}
