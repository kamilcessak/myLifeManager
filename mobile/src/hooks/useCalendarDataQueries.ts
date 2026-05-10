import { useQueries } from '@tanstack/react-query';
import type { Event, Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { eventsRangeQueryKey, tasksScheduledQueryKey, type WorkspaceId } from '../lib/queryKeys';

interface TasksBody {
  status: string;
  data: { tasks: Task[] };
}

interface EventsBody {
  status: string;
  data: { events: Event[] };
}

export type CalendarRangeQueriesResult = {
  tasks: Task[] | undefined;
  events: Event[] | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: Error | null;
};

/**
 * Równoległe GET /tasks (scheduled + zakres) oraz GET /events dla widoku kalendarza.
 */
export function useCalendarRangeQueries(
  activeWorkspaceId: WorkspaceId,
  startDateIso: string,
  endDateIso: string,
): CalendarRangeQueriesResult {
  const results = useQueries({
    queries: [
      {
        queryKey: tasksScheduledQueryKey(activeWorkspaceId, startDateIso, endDateIso),
        queryFn: async (): Promise<Task[]> => {
          const { data } = await apiClient.get<TasksBody>('/tasks', {
            params: {
              scheduled: 'true',
              startDate: startDateIso,
              endDate: endDateIso,
              ...(activeWorkspaceId ? { teamId: activeWorkspaceId } : {}),
            },
          });
          return data.data.tasks;
        },
      },
      {
        queryKey: eventsRangeQueryKey(activeWorkspaceId, startDateIso, endDateIso),
        queryFn: async (): Promise<Event[]> => {
          const { data } = await apiClient.get<EventsBody>('/events', {
            params: {
              startDate: startDateIso,
              endDate: endDateIso,
              ...(activeWorkspaceId ? { teamId: activeWorkspaceId } : {}),
            },
          });
          return data.data.events;
        },
      },
    ],
  });

  const [tasksQuery, eventsQuery] = results;

  const error =
    (tasksQuery.error as Error | undefined) ??
    (eventsQuery.error as Error | undefined) ??
    null;

  return {
    tasks: tasksQuery.data,
    events: eventsQuery.data,
    isPending: tasksQuery.isPending || eventsQuery.isPending,
    isFetching: tasksQuery.isFetching || eventsQuery.isFetching,
    error,
  };
}
