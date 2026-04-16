import { Building2, Loader2, User } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeams } from '../../hooks/useTeams';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

const PERSONAL_WORKSPACE_VALUE = '__mlm_personal__';

export default function WorkspaceSwitcher() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const { data: teams, isLoading, isError } = useTeams();

  const selectValue = activeWorkspaceId ?? PERSONAL_WORKSPACE_VALUE;

  return (
    <div className="flex min-w-0 max-w-[220px] flex-col gap-0.5 sm:max-w-[260px]">
      <span className="hidden text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)] sm:block">
        Obszar
      </span>
      <Select
        value={selectValue}
        onValueChange={(value) => {
          setActiveWorkspace(value === PERSONAL_WORKSPACE_VALUE ? null : value);
        }}
        disabled={isLoading}
      >
        <SelectTrigger
          size="sm"
          aria-label="Wybierz obszar roboczy"
          className="h-9 w-full min-w-[160px] max-w-full border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)] shadow-none hover:bg-[var(--app-surface)] focus-visible:ring-blue-500/30"
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              Ładowanie…
            </span>
          ) : (
            <SelectValue placeholder="Obszar roboczy" />
          )}
        </SelectTrigger>
        <SelectContent
          align="end"
          position="popper"
          className="min-w-[var(--radix-select-trigger-width)] border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-lg"
        >
          <SelectItem
            value={PERSONAL_WORKSPACE_VALUE}
            className="cursor-pointer focus:bg-[var(--app-surface-muted)] focus:text-[var(--app-text)]"
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-blue-500" />
              Konto osobiste
            </span>
          </SelectItem>

          {teams && teams.length > 0 ? (
            <SelectGroup>
              <SelectLabel className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                Zespoły
              </SelectLabel>
              {teams.map((team) => (
                <SelectItem
                  key={team.id}
                  value={team.id}
                  className="cursor-pointer focus:bg-[var(--app-surface-muted)] focus:text-[var(--app-text)]"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    <span className="truncate">{team.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}

          {isError ? (
            <div className="px-2 py-2 text-xs text-red-600 dark:text-red-400">Nie udało się wczytać zespołów</div>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
