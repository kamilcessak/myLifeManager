import { useQuery } from '@tanstack/react-query';
import type { Team } from 'shared';
import { teamsApi } from '../lib/api';

/** Team list item returned by GET /api/teams (membership metadata from API). */
export type TeamListItem = Team & {
  myRole?: string;
  memberSince?: Date | string;
};

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async (): Promise<TeamListItem[]> => {
      const response = await teamsApi.list();
      return response.data.data.teams as TeamListItem[];
    },
  });
}
