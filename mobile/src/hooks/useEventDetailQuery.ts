import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Event } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { eventDetailQueryKey } from '../lib/queryKeys';

interface EventBody {
  status: string;
  data: { event: Event };
}

export function useEventDetailQuery(eventId: string): UseQueryResult<Event, Error> {
  return useQuery({
    queryKey: eventDetailQueryKey(eventId),
    queryFn: async (): Promise<Event> => {
      const { data } = await apiClient.get<EventBody>(`/events/${eventId}`);
      return data.data.event;
    },
    enabled: Boolean(eventId),
  });
}
