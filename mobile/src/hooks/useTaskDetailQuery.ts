import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Task } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { taskDetailQueryKey } from '../lib/queryKeys';

interface TaskBody {
  status: string;
  data: { task: Task };
}

export function useTaskDetailQuery(taskId: string): UseQueryResult<Task, Error> {
  return useQuery({
    queryKey: taskDetailQueryKey(taskId),
    queryFn: async (): Promise<Task> => {
      const { data } = await apiClient.get<TaskBody>(`/tasks/${taskId}`);
      return data.data.task;
    },
    enabled: Boolean(taskId),
  });
}
