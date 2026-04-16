import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { Team, TeamInvitation } from 'shared';
import { teamsApi, type TeamMemberApiRow } from '../lib/api';

/** Team list item returned by GET /api/teams (membership metadata from API). */
export type TeamListItem = Team & {
  myRole?: string;
  memberSince?: Date | string;
};

const TEAMS_QUERY_KEY = ['teams'] as const;

export function useTeams(): UseQueryResult<TeamListItem[], Error> {
  return useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: async (): Promise<TeamListItem[]> => {
      const response = await teamsApi.list();
      return response.data.data.teams as TeamListItem[];
    },
  });
}

export function useTeamMembers(
  teamId: string | null,
): UseQueryResult<TeamMemberApiRow[], Error> {
  return useQuery({
    queryKey: ['teamMembers', teamId],
    queryFn: async (): Promise<TeamMemberApiRow[]> => {
      if (!teamId) return [];
      const response = await teamsApi.getMembers(teamId);
      return response.data.data.members;
    },
    enabled: !!teamId,
  });
}

export function useInviteMembersMutation(): UseMutationResult<
  TeamInvitation[],
  Error,
  { teamId: string; emails: string[] }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, emails }) => {
      const response = await teamsApi.inviteMembers(teamId, emails);
      return response.data.data.invitations;
    },
    onSuccess: (_data, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: ['teamMembers', teamId] });
    },
  });
}

export function useJoinTeamMutation(): UseMutationResult<
  { teamId: string; message: string },
  Error,
  { code: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code }) => {
      const response = await teamsApi.join(code.trim());
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
    },
  });
}

export function useCreateTeamMutation(): UseMutationResult<
  Team,
  Error,
  { name: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }) => {
      const response = await teamsApi.create({ name });
      return response.data.data.team;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
    },
  });
}
