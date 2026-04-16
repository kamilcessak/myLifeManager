import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { Event } from '../types';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useAssigneeFilterStore } from '../store/useAssigneeFilterStore';
import { useAuthStore } from '../store/authStore';

export function useEvents(startDate: string, endDate: string) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const assigneeId = activeWorkspaceId !== null && onlyMine ? userId : null;

  return useQuery({
    queryKey: queryKeys.events(activeWorkspaceId, startDate, endDate, assigneeId),
    queryFn: async () => {
      const response = await eventsApi.getAll({
        startDate,
        endDate,
        teamId: activeWorkspaceId ?? undefined,
        assigneeId: assigneeId ?? undefined,
      });
      return response.data.data.events as Event[];
    },
  });
}
