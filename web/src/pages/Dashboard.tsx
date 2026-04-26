import CalendarView from '../components/CalendarView';
import MobileCategoriesPanel from '../components/mobile/MobileCategoriesPanel';
import ProfileSettingsModal from '../components/profile/ProfileSettingsModal';
import SearchBar from '../components/SearchBar';
import { useCategoryFilterStore } from '../store/useCategoryFilterStore';
import { useMobileNavStore } from '../store/useMobileNavStore';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Dashboard() {
  const activeCategoryFilter = useCategoryFilterStore((s) => s.activeCategoryFilter);
  const activeMobileTab = useMobileNavStore((s) => s.activeTab);
  const setActiveMobileTab = useMobileNavStore((s) => s.setActiveTab);
  const isMobile = useIsMobile();

  return (
    <div className="split-view dashboard-root">
      <div className="split-view-main dashboard-main-pane relative min-h-0 flex-1">
        {/* Kalendarz zawsze zamontowany (panel zadania, FAB, store) */}
        <div
          className={
            isMobile && activeMobileTab !== 'calendar'
              ? 'calendar-keep-mounted'
              : 'h-full min-h-0'
          }
        >
          <CalendarView activeCategory={activeCategoryFilter} />
        </div>

        {isMobile && activeMobileTab === 'categories' ? (
          <div className="mobile-stack-overlay">
            <MobileCategoriesPanel />
          </div>
        ) : null}

        {isMobile && activeMobileTab === 'search' ? (
          <div className="mobile-stack-overlay flex flex-col bg-[var(--app-bg)] p-4">
            <h2 className="mb-3 shrink-0 text-base font-semibold text-[var(--app-text)]">Szukaj</h2>
            <div className="min-h-0 flex-1">
              <SearchBar variant="fullWidth" />
            </div>
          </div>
        ) : null}

        {isMobile && activeMobileTab === 'profile' ? (
          <ProfileSettingsModal
            isOpen
            onClose={() => setActiveMobileTab('calendar')}
          />
        ) : null}
      </div>
    </div>
  );
}
