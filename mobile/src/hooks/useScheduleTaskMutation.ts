import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import {
  tasksInboxQueryKey,
  tasksScheduledQueryKey,
  type WorkspaceId,
} from '../lib/queryKeys';
import { useWorkspaceStore } from '../store/workspaceStore';

interface ScheduleResponse {
  status: string;
  data: { task: Task };
}

export type ScheduleTaskVariables = {
  taskId: string;
  scheduledStart: string;
  scheduledEnd: string;
  /** Zakres widoku kalendarza — aktualizacja cache dla zaplanowanych zadań */
  range: { startIso: string; endIso: string };
};

export function useScheduleTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, scheduledStart, scheduledEnd }: ScheduleTaskVariables) => {
      const { data } = await apiClient.patch<ScheduleResponse>(`/tasks/${taskId}/schedule`, {
        scheduledStart,
        scheduledEnd,
      });
      return data.data.task;
    },
    onMutate: async (variables) => {
      const activeWorkspaceId: WorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      const inboxKey = tasksInboxQueryKey(activeWorkspaceId);
      const scheduledKey = tasksScheduledQueryKey(
        activeWorkspaceId,
        variables.range.startIso,
        variables.range.endIso,
      );

      await queryClient.cancelQueries({ queryKey: inboxKey });
      await queryClient.cancelQueries({ queryKey: scheduledKey });

      const previousInbox = queryClient.getQueryData<Task[]>(inboxKey);
      const previousScheduled = queryClient.getQueryData<Task[]>(scheduledKey);

      const inboxTask = previousInbox?.find((t) => t.id === variables.taskId);
      const optimisticTask: Task | undefined = inboxTask
        ? {
            ...inboxTask,
            scheduledStart: variables.scheduledStart,
            scheduledEnd: variables.scheduledEnd,
          }
        : undefined;

      queryClient.setQueryData<Task[]>(inboxKey, (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === variables.taskId && optimisticTask
            ? optimisticTask
            : t,
        );
      });

      queryClient.setQueryData<Task[]>(scheduledKey, (old) => {
        const list = old ?? [];
        const without = list.filter((t) => t.id !== variables.taskId);
        if (!optimisticTask) return without;
        return [...without, optimisticTask].sort((a, b) => {
          const aT = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
          const bT = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
          return aT - bT;
        });
      });

      return { previousInbox, previousScheduled, inboxKey, scheduledKey };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      if (context.previousInbox !== undefined) {
        queryClient.setQueryData(context.inboxKey, context.previousInbox);
      }
      if (context.previousScheduled !== undefined) {
        queryClient.setQueryData(context.scheduledKey, context.previousScheduled);
      }
    },
    onSuccess: (serverTask, variables) => {
      const activeWorkspaceId: WorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      const inboxKey = tasksInboxQueryKey(activeWorkspaceId);
      const scheduledKey = tasksScheduledQueryKey(
        activeWorkspaceId,
        variables.range.startIso,
        variables.range.endIso,
      );

      queryClient.setQueryData<Task[]>(inboxKey, (old) =>
        old?.map((t) => (t.id === serverTask.id ? { ...t, ...serverTask } : t)),
      );

      queryClient.setQueryData<Task[]>(scheduledKey, (old) => {
        const list = old ?? [];
        const without = list.filter((t) => t.id !== serverTask.id);
        return [...without, serverTask].sort((a, b) => {
          const aT = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
          const bT = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
          return aT - bT;
        });
      });
    },
  });
}
