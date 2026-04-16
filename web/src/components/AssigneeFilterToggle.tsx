import { UserCheck } from 'lucide-react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useAssigneeFilterStore } from '../store/useAssigneeFilterStore';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';

interface AssigneeFilterToggleProps {
  className?: string;
  /** `compact` is used in tight header spots (icon + short label). */
  variant?: 'default' | 'compact';
}

/**
 * Toggle that filters tasks/events lists to items assigned to the current user.
 *
 * Rendered only when the user is in a team workspace — in a personal
 * workspace every item already implicitly belongs to the user.
 */
export default function AssigneeFilterToggle({
  className,
  variant = 'default',
}: AssigneeFilterToggleProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const toggle = useAssigneeFilterStore((s) => s.toggleOnlyMine);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  if (activeWorkspaceId === null) return null;
  if (!userId) return null;

  const label = variant === 'compact' ? 'Moje' : 'Tylko moje przypisania';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={onlyMine}
      onClick={toggle}
      title="Pokaż tylko elementy przypisane do mnie"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        onlyMine
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/60'
          : 'border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]',
        className,
      )}
    >
      <UserCheck className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
