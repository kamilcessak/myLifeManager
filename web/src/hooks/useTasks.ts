import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { Task } from '../types';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useAssigneeFilterStore } from '../store/useAssigneeFilterStore';
import { useAuthStore } from '../store/authStore';

type InboxScope = { scope: 'inbox' };
/**
 * Scheduled scope feeds the calendar view. `startDate` / `endDate` MUST come
 * from the currently visible calendar window (ISO strings). The API uses
 * this window both to filter persisted tasks and to expand recurring
 * tasks (RRULE) into synthetic instances, mirroring the events endpoint.
 */
type ScheduledScope = { scope: 'scheduled'; startDate: string; endDate: string };

export type UseTasksOptions = InboxScope | ScheduledScope;

export function useTasks(options: UseTasksOptions) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // The "only mine" filter only makes sense in a team workspace; in personal
  // workspace items are implicitly yours already. This keeps query keys stable
  // when switching workspaces without surprising extra fetches.
  const assigneeId = activeWorkspaceId !== null && onlyMine ? userId : null;

  const queryKey =
    options.scope === 'inbox'
      ? queryKeys.tasksInbox(activeWorkspaceId, assigneeId)
      : queryKeys.tasksScheduled(
          activeWorkspaceId,
          options.startDate,
          options.endDate,
          assigneeId,
        );

  return useQuery({
    queryKey,
    queryFn: async (): Promise<Task[]> => {
      if (options.scope === 'inbox') {
        const response = await tasksApi.getInbox(
          undefined,
          activeWorkspaceId,
          assigneeId,
        );
        return response.data.data.tasks as Task[];
      }
      const response = await tasksApi.getAll({
        startDate: options.startDate,
        endDate: options.endDate,
        teamId: activeWorkspaceId ?? undefined,
        assigneeId: assigneeId ?? undefined,
      });
      return response.data.data.tasks as Task[];
    },
  });
}
