import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys, type WorkspaceId } from './queryKeys';
import type { Task } from '../types';

export type TaskCachesSnapshot = {
  inboxKey: ReturnType<typeof queryKeys.tasksInbox>;
  inbox: Task[] | undefined;
  scheduled: Array<[QueryKey, unknown]>;
};

export function snapshotTaskCaches(queryClient: QueryClient, teamId: WorkspaceId): TaskCachesSnapshot {
  const inboxKey = queryKeys.tasksInbox(teamId);
  return {
    inboxKey,
    inbox: queryClient.getQueryData<Task[]>(inboxKey),
    scheduled: queryClient.getQueriesData({
      predicate: (q: Query) =>
        q.queryKey[0] === 'tasks' && q.queryKey[1] === teamId && q.queryKey[2] === 'scheduled',
    }),
  };
}

export function restoreTaskCaches(queryClient: QueryClient, snapshot: TaskCachesSnapshot) {
  queryClient.setQueryData(snapshot.inboxKey, snapshot.inbox);
  snapshot.scheduled.forEach(([key, data]) => {
    queryClient.setQueryData(key, data);
  });
}

export function patchTaskInTaskCaches(
  queryClient: QueryClient,
  teamId: WorkspaceId,
  taskId: string,
  patch: Partial<Task>,
) {
  queryClient.setQueryData<Task[]>(queryKeys.tasksInbox(teamId), (old = []) =>
    old.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  );

  queryClient.setQueriesData(
    {
      predicate: (q: Query) =>
        q.queryKey[0] === 'tasks' && q.queryKey[1] === teamId && q.queryKey[2] === 'scheduled',
    },
    (old: unknown) => {
      if (!Array.isArray(old)) {
        return old;
      }
      return (old as Task[]).map((t) => (t.id === taskId ? { ...t, ...patch } : t));
    },
  );
}
