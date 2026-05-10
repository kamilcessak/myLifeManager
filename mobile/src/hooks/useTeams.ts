import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Team } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { teamsQueryKey } from '../lib/queryKeys';

export type TeamListItem = Team & {
  myRole?: string;
  memberSince?: Date | string;
};

function parseTeamsFromResponseBody(body: unknown): TeamListItem[] {
  if (!body || typeof body !== 'object') return [];
  const root = body as Record<string, unknown>;
  const data = root.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const teams = (data as Record<string, unknown>).teams;
    if (Array.isArray(teams)) return teams as TeamListItem[];
  }
  if (Array.isArray(root.teams)) return root.teams as TeamListItem[];
  return [];
}

export function useTeams(): UseQueryResult<TeamListItem[], Error> {
  return useQuery({
    queryKey: teamsQueryKey,
    queryFn: async (): Promise<TeamListItem[]> => {
      const { data } = await apiClient.get<unknown>('/teams');
      return parseTeamsFromResponseBody(data);
    },
  });
}
