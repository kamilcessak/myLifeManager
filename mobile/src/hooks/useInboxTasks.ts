import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { tasksInboxQueryKey } from '../lib/queryKeys';
import { assigneeIdApiParam } from '../lib/workspaceTaskQueries';
import { useAssigneeFilterStore } from '../store/assigneeFilterStore';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';

interface InboxSuccessBody {
  status: string;
  data: { tasks: Task[] };
}

export function useInboxTasks(): UseQueryResult<Task[], Error> {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const assigneeKey =
    activeWorkspaceId !== null && onlyMine && userId ? userId : null;

  return useQuery({
    queryKey: tasksInboxQueryKey(activeWorkspaceId, assigneeKey),
    queryFn: async (): Promise<Task[]> => {
      const assigneeId = assigneeIdApiParam(activeWorkspaceId);
      const { data } = await apiClient.get<InboxSuccessBody>('/tasks/inbox', {
        params: {
          ...(activeWorkspaceId ? { teamId: activeWorkspaceId } : {}),
          ...(assigneeId ? { assigneeId } : {}),
        },
      });
      return data.data.tasks;
    },
  });
}
