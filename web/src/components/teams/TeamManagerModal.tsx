import { useEffect, useMemo, useState } from 'react';
import { Mail, Settings, Users, X } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useTeams, type TeamListItem } from '../../hooks/useTeams';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import TeamMembersTab from './TeamMembersTab';
import TeamInvitesTab from './TeamInvitesTab';
import TeamSettingsTab from './TeamSettingsTab';

type TabId = 'members' | 'invites' | 'settings';

interface TabDescriptor {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
}

const ALL_TABS: TabDescriptor[] = [
  { id: 'members', label: 'Członkowie', icon: Users },
  { id: 'invites', label: 'Zaproszenia', icon: Mail, ownerOnly: true },
  { id: 'settings', label: 'Ustawienia', icon: Settings, ownerOnly: true },
];

interface TeamManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabId;
}

export default function TeamManagerModal({
  isOpen,
  onClose,
  initialTab = 'members',
}: TeamManagerModalProps) {
  useEscapeToClose(onClose, isOpen);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: teams } = useTeams();

  const activeTeam: TeamListItem | undefined = useMemo(
    () => teams?.find((t) => t.id === activeWorkspaceId),
    [teams, activeWorkspaceId],
  );
  const isOwner = activeTeam?.myRole === 'OWNER';

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => !t.ownerOnly || isOwner),
    [isOwner],
  );

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  // If the currently selected tab becomes hidden (e.g. role changed), fall back to members.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab('members');
    }
  }, [visibleTabs, activeTab]);

  useEffect(() => {
    if (isOpen && !activeWorkspaceId) {
      onClose();
    }
  }, [isOpen, activeWorkspaceId, onClose]);

  if (!isOpen || !activeWorkspaceId) return null;

  return (
    <div className="modal-overlay z-[60]" onClick={onClose}>
      <div
        className="modal-content max-w-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Zarządzaj zespołem</h2>
            {activeTeam ? (
              <p className="mt-0.5 truncate text-sm text-[var(--app-text-muted)]">
                {activeTeam.name}
              </p>
            ) : null}
          </div>
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
          aria-label="Sekcje zarządzania zespołem"
          className="flex gap-1 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 pt-2"
        >
          {visibleTabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                id={`team-tab-${id}`}
                aria-selected={isActive}
                aria-controls={`team-tabpanel-${id}`}
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

        <div className="max-h-[min(70vh,560px)] overflow-y-auto px-5 py-5">
          <div
            role="tabpanel"
            id="team-tabpanel-members"
            aria-labelledby="team-tab-members"
            hidden={activeTab !== 'members'}
          >
            {activeTab === 'members' ? (
              <TeamMembersTab
                teamId={activeWorkspaceId}
                isOwner={isOwner}
                onLeaveTeam={onClose}
              />
            ) : null}
          </div>

          <div
            role="tabpanel"
            id="team-tabpanel-invites"
            aria-labelledby="team-tab-invites"
            hidden={activeTab !== 'invites'}
          >
            {activeTab === 'invites' ? (
              <TeamInvitesTab teamId={activeWorkspaceId} isOwner={isOwner} />
            ) : null}
          </div>

          <div
            role="tabpanel"
            id="team-tabpanel-settings"
            aria-labelledby="team-tab-settings"
            hidden={activeTab !== 'settings'}
          >
            {activeTab === 'settings' && activeTeam ? (
              <TeamSettingsTab
                team={activeTeam}
                isOwner={isOwner}
                onDeleted={onClose}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
