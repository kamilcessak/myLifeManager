import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { Task } from '../types';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

type InboxScope = { scope: 'inbox' };
type ScheduledScope = { scope: 'scheduled'; startDate: string; endDate: string };

export type UseTasksOptions = InboxScope | ScheduledScope;

export function useTasks(options: UseTasksOptions) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const queryKey =
    options.scope === 'inbox'
      ? queryKeys.tasksInbox(activeWorkspaceId)
      : queryKeys.tasksScheduled(activeWorkspaceId, options.startDate, options.endDate);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<Task[]> => {
      if (options.scope === 'inbox') {
        const response = await tasksApi.getInbox(undefined, activeWorkspaceId);
        return response.data.data.tasks as Task[];
      }
      const response = await tasksApi.getAll({
        startDate: options.startDate,
        endDate: options.endDate,
        teamId: activeWorkspaceId ?? undefined,
      });
      return response.data.data.tasks as Task[];
    },
  });
}
