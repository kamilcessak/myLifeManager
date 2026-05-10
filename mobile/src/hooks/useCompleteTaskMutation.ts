import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { tasksInboxQueryKey } from '../lib/queryKeys';
import { useWorkspaceStore } from '../store/workspaceStore';

interface PatchTaskResponse {
  status: string;
  data: { task: Task };
}

export function useCompleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data } = await apiClient.patch<PatchTaskResponse>(`/tasks/${taskId}`, {
        isCompleted: true,
      });
      return data.data.task;
    },
    onMutate: async (taskId) => {
      const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      const queryKey = tasksInboxQueryKey(activeWorkspaceId);

      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Task[]>(queryKey);
      const nowIso = new Date().toISOString();

      queryClient.setQueryData<Task[]>(queryKey, (old) =>
        old?.map((t) =>
          t.id === taskId
            ? { ...t, isCompleted: true, completedAt: t.completedAt ?? nowIso }
            : t,
        ),
      );

      return { previous, queryKey };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSuccess: (serverTask, taskId) => {
      const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      const queryKey = tasksInboxQueryKey(activeWorkspaceId);
      queryClient.setQueryData<Task[]>(queryKey, (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, ...serverTask } : t)),
      );
    },
  });
}
