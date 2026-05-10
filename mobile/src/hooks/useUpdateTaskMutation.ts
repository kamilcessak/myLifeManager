import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { taskActivityQueryKey, taskDetailQueryKey, tasksInboxQueryKey, type WorkspaceId } from '../lib/queryKeys';
import { useAssigneeFilterStore } from '../store/assigneeFilterStore';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';

interface PatchBody {
  status: string;
  data: { task: Task };
}

export type TaskPatchPayload = {
  title?: string;
  description?: string | null;
  priority?: number;
};

export function useUpdateTaskMutation(taskId: string) {
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId) as WorkspaceId;
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const assigneeKey =
    activeWorkspaceId !== null && onlyMine && userId ? userId : null;

  return useMutation({
    mutationFn: async (body: TaskPatchPayload) => {
      const { data } = await apiClient.patch<PatchBody>(`/tasks/${taskId}`, body);
      return data.data.task;
    },
    onSuccess: (task) => {
      queryClient.setQueryData(taskDetailQueryKey(taskId), task);
      void queryClient.invalidateQueries({ queryKey: tasksInboxQueryKey(activeWorkspaceId, assigneeKey) });
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeWorkspaceId, 'scheduled'] });
      void queryClient.invalidateQueries({ queryKey: ['events', activeWorkspaceId] });
      void queryClient.invalidateQueries({ queryKey: taskActivityQueryKey(taskId) });
    },
  });
}
