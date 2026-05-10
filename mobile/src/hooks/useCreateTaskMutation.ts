import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { useWorkspaceStore } from '../store/workspaceStore';

interface CreateTaskResponse {
  status: string;
  data: { task: Task };
}

export type CreateTaskInput = {
  title: string;
  description?: string;
};

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const title = input.title.trim();
      const desc = input.description?.trim();
      const { data } = await apiClient.post<CreateTaskResponse>('/tasks', {
        title,
        ...(desc ? { description: desc } : {}),
        ...(activeWorkspaceId ? { teamId: activeWorkspaceId } : {}),
      });
      return data.data.task;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeWorkspaceId, 'inbox'] });
    },
  });
}
