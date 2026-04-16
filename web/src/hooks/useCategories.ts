import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { Category } from '../types';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

export function useCategories() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return useQuery({
    queryKey: queryKeys.categories(activeWorkspaceId),
    queryFn: async () => {
      const response = await categoriesApi.getAll(activeWorkspaceId);
      return response.data.data.categories as Category[];
    },
  });
}
