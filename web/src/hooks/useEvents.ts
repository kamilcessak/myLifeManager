import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { Event } from '../types';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

export function useEvents(startDate: string, endDate: string) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return useQuery({
    queryKey: queryKeys.events(activeWorkspaceId, startDate, endDate),
    queryFn: async () => {
      const response = await eventsApi.getAll({
        startDate,
        endDate,
        teamId: activeWorkspaceId ?? undefined,
      });
      return response.data.data.events as Event[];
    },
  });
}
