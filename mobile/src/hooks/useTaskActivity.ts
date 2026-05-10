import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ActivityLogEntry } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { taskActivityQueryKey } from '../lib/queryKeys';

interface ActivitySuccess {
  status: string;
  data: { activity: ActivityLogEntry[] };
}

export function useTaskActivity(
  activityTaskId: string | null,
): UseQueryResult<ActivityLogEntry[], Error> {
  return useQuery({
    queryKey: activityTaskId ? taskActivityQueryKey(activityTaskId) : ['tasks', 'activity', 'off'],
    queryFn: async (): Promise<ActivityLogEntry[]> => {
      if (!activityTaskId) return [];
      const { data } = await apiClient.get<ActivitySuccess>(
        `/tasks/${activityTaskId}/activity`,
      );
      return data.data.activity;
    },
    enabled: Boolean(activityTaskId),
  });
}
