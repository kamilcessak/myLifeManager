import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { tasksInboxQueryKey } from '../lib/queryKeys';
import { useWorkspaceStore } from '../store/workspaceStore';

interface InboxSuccessBody {
  status: string;
  data: { tasks: Task[] };
}

export function useInboxTasks(): UseQueryResult<Task[], Error> {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return useQuery({
    queryKey: tasksInboxQueryKey(activeWorkspaceId),
    queryFn: async (): Promise<Task[]> => {
      const { data } = await apiClient.get<InboxSuccessBody>('/tasks/inbox', {
        params: activeWorkspaceId ? { teamId: activeWorkspaceId } : {},
      });
      return data.data.tasks;
    },
  });
}
