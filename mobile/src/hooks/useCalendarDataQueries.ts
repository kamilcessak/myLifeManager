import { useQueries } from '@tanstack/react-query';
import type { Event, Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { eventsRangeQueryKey, tasksScheduledQueryKey, type WorkspaceId } from '../lib/queryKeys';
import { assigneeIdApiParam } from '../lib/workspaceTaskQueries';
import { useAssigneeFilterStore } from '../store/assigneeFilterStore';
import { useAuthStore } from '../store/authStore';

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
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const assigneeKey =
    activeWorkspaceId !== null && onlyMine && userId ? userId : null;

  const results = useQueries({
    queries: [
      {
        queryKey: tasksScheduledQueryKey(
          activeWorkspaceId,
          startDateIso,
          endDateIso,
          assigneeKey,
        ),
        queryFn: async (): Promise<Task[]> => {
          const assigneeId = assigneeIdApiParam(activeWorkspaceId);
          const { data } = await apiClient.get<TasksBody>('/tasks', {
            params: {
              scheduled: 'true',
              startDate: startDateIso,
              endDate: endDateIso,
              ...(activeWorkspaceId ? { teamId: activeWorkspaceId } : {}),
              ...(assigneeId ? { assigneeId } : {}),
            },
          });
          return data.data.tasks;
        },
      },
      {
        queryKey: eventsRangeQueryKey(
          activeWorkspaceId,
          startDateIso,
          endDateIso,
          assigneeKey,
        ),
        queryFn: async (): Promise<Event[]> => {
          const assigneeId = assigneeIdApiParam(activeWorkspaceId);
          const { data } = await apiClient.get<EventsBody>('/events', {
            params: {
              startDate: startDateIso,
              endDate: endDateIso,
              ...(activeWorkspaceId ? { teamId: activeWorkspaceId } : {}),
              ...(assigneeId ? { assigneeId } : {}),
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
