import { useMemo, useState, type ReactNode } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  Loader2,
  PlusCircle,
  RefreshCw,
  Settings,
  User,
  UserPlus,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTeams } from '../../hooks/useTeams';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import TeamManagerModal from '../teams/TeamManagerModal';
import JoinTeamModal from '../teams/JoinTeamModal';
import CreateTeamModal from '../teams/CreateTeamModal';

const PERSONAL_WORKSPACE_VALUE = '__mlm_personal__';

export default function WorkspaceSwitcher() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const { data: teams, isLoading, isError, isFetching, refetch } = useTeams();

  const [open, setOpen] = useState(false);
  const [teamManagerOpen, setTeamManagerOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selectValue = activeWorkspaceId ?? PERSONAL_WORKSPACE_VALUE;

  const label = useMemo(() => {
    if (isLoading) return null;
    if (selectValue === PERSONAL_WORKSPACE_VALUE) return 'Konto osobiste';
    const team = teams?.find((t) => t.id === selectValue);
    return team?.name ?? 'Obszar roboczy';
  }, [isLoading, selectValue, teams]);

  const pickWorkspace = (value: string) => {
    setActiveWorkspace(value === PERSONAL_WORKSPACE_VALUE ? null : value);
    setOpen(false);
  };

  const openTeamSettings = () => {
    setOpen(false);
    setTeamManagerOpen(true);
  };

  const openJoin = () => {
    setOpen(false);
    setJoinOpen(true);
  };

  const openCreate = () => {
    setOpen(false);
    setCreateOpen(true);
  };

  return (
    <>
      <div className="flex min-w-0 max-w-[280px] items-end gap-1 sm:max-w-[320px]">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="hidden text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)] sm:block">
            Obszar
          </span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isLoading}
                aria-label="Wybierz obszar roboczy"
                aria-expanded={open}
                className={cn(
                  'flex h-9 w-full min-w-[160px] max-w-full items-center justify-between gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 text-left text-sm text-[var(--app-text)] shadow-none outline-none transition-colors',
                  'hover:bg-[var(--app-surface)] focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    Ładowanie…
                  </span>
                ) : (
                  <>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {selectValue === PERSONAL_WORKSPACE_VALUE ? (
                        <User className="h-4 w-4 shrink-0 text-blue-500" />
                      ) : (
                        <Building2 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                      )}
                      <span className="truncate">{label}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[var(--radix-popover-trigger-width)] min-w-[220px] max-w-[min(100vw-2rem,320px)] border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-[var(--app-text)] shadow-lg"
            >
              <div className="max-h-[min(60vh,360px)] overflow-y-auto p-1">
                <WorkspaceOptionRow
                  selected={selectValue === PERSONAL_WORKSPACE_VALUE}
                  icon={<User className="h-4 w-4 shrink-0 text-blue-500" />}
                  title="Konto osobiste"
                  onSelect={() => pickWorkspace(PERSONAL_WORKSPACE_VALUE)}
                />

                {teams && teams.length > 0 ? (
                  <>
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                      Zespoły
                    </p>
                    {teams.map((team) => (
                      <WorkspaceOptionRow
                        key={team.id}
                        selected={selectValue === team.id}
                        icon={<Building2 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />}
                        title={team.name}
                        onSelect={() => pickWorkspace(team.id)}
                      />
                    ))}
                  </>
                ) : null}

                {isError ? (
                  <div className="flex items-center gap-2 px-2 py-2 text-xs text-red-600 dark:text-red-400">
                    <span className="min-w-0 flex-1 leading-snug">Nie udało się wczytać zespołów</span>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      disabled={isFetching}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-blue-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-400"
                      title="Spróbuj ponownie"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden />
                      <span className="hidden sm:inline">Spróbuj ponownie</span>
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[var(--app-border)] p-2">
                <button
                  type="button"
                  onClick={openCreate}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-muted)]"
                >
                  <PlusCircle className="h-4 w-4 shrink-0 text-blue-500" />
                  Utwórz nowy zespół
                </button>
                <button
                  type="button"
                  onClick={openJoin}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-muted)]"
                >
                  <UserPlus className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  Dołącz z kodem
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {activeWorkspaceId !== null ? (
          <button
            type="button"
            onClick={openTeamSettings}
            title="Ustawienia zespołu"
            aria-label="Ustawienia zespołu"
            className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
          >
            <Settings className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <TeamManagerModal isOpen={teamManagerOpen} onClose={() => setTeamManagerOpen(false)} />
      <JoinTeamModal isOpen={joinOpen} onClose={() => setJoinOpen(false)} />
      <CreateTeamModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function WorkspaceOptionRow({
  selected,
  icon,
  title,
  onSelect,
}: {
  selected: boolean;
  icon: ReactNode;
  title: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
        selected
          ? 'bg-[var(--app-surface-muted)] text-[var(--app-text)]'
          : 'text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]/80',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{title}</span>
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-blue-500" /> : <span className="w-4 shrink-0" />}
    </button>
  );
}
