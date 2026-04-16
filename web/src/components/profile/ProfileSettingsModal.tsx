import { useEffect, useState } from 'react';
import { Lock, Settings, ShieldAlert, SlidersHorizontal, User, X } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import ProfileTab from './tabs/ProfileTab';
import SecurityTab from './tabs/SecurityTab';
import PreferencesTab from './tabs/PreferencesTab';
import AccountTab from './tabs/AccountTab';

type TabId = 'profile' | 'security' | 'preferences' | 'account';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabId;
}

const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'security', label: 'Bezpieczeństwo', icon: Lock },
  { id: 'preferences', label: 'Preferencje', icon: SlidersHorizontal },
  { id: 'account', label: 'Konto', icon: ShieldAlert },
];

export default function ProfileSettingsModal({
  isOpen,
  onClose,
  initialTab = 'profile',
}: ProfileSettingsModalProps) {
  useEscapeToClose(onClose, isOpen);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay z-[60]" onClick={onClose}>
      <div
        className="modal-content max-w-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--app-text)]">
            <Settings className="h-5 w-5 text-[var(--app-text-muted)]" />
            Ustawienia profilu
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Sekcje ustawień profilu"
          className="flex gap-1 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 pt-2"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${id}`}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-500 text-[var(--app-text)]'
                    : 'border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          <div
            role="tabpanel"
            id="tabpanel-profile"
            aria-labelledby="tab-profile"
            hidden={activeTab !== 'profile'}
          >
            {activeTab === 'profile' && (
              <ProfileTab
                isActive={activeTab === 'profile'}
                onRequestClose={onClose}
              />
            )}
          </div>

          <div
            role="tabpanel"
            id="tabpanel-security"
            aria-labelledby="tab-security"
            hidden={activeTab !== 'security'}
          >
            {activeTab === 'security' && (
              <SecurityTab isActive={activeTab === 'security'} />
            )}
          </div>

          <div
            role="tabpanel"
            id="tabpanel-preferences"
            aria-labelledby="tab-preferences"
            hidden={activeTab !== 'preferences'}
          >
            {activeTab === 'preferences' && <PreferencesTab />}
          </div>

          <div
            role="tabpanel"
            id="tabpanel-account"
            aria-labelledby="tab-account"
            hidden={activeTab !== 'account'}
          >
            {activeTab === 'account' && <AccountTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
