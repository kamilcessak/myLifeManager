import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Event } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { eventDetailQueryKey, tasksInboxQueryKey, type WorkspaceId } from '../lib/queryKeys';
import { useAssigneeFilterStore } from '../store/assigneeFilterStore';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';

interface PatchBody {
  status: string;
  data: { event: Event };
}

export type EventPatchPayload = {
  title?: string;
  description?: string | null;
  location?: string | null;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
};

export function useUpdateEventMutation(eventId: string) {
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId) as WorkspaceId;
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const assigneeKey =
    activeWorkspaceId !== null && onlyMine && userId ? userId : null;

  return useMutation({
    mutationFn: async (body: EventPatchPayload) => {
      const { data } = await apiClient.patch<PatchBody>(`/events/${eventId}`, body);
      return data.data.event;
    },
    onSuccess: (event) => {
      queryClient.setQueryData(eventDetailQueryKey(eventId), event);
      void queryClient.invalidateQueries({ queryKey: ['events', activeWorkspaceId] });
      void queryClient.invalidateQueries({ queryKey: tasksInboxQueryKey(activeWorkspaceId, assigneeKey) });
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeWorkspaceId, 'scheduled'] });
    },
  });
}
