import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { Team, TeamInvitation, TeamRole } from '@mlm/shared';
import { api, teamsApi, type TeamMemberApiRow } from '../lib/api';

/** Team list item returned by GET /api/teams (membership metadata from API). */
export type TeamListItem = Team & {
  myRole?: string;
  memberSince?: Date | string;
};

const TEAMS_QUERY_KEY = ['teams'] as const;

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

function parseCreatedTeamFromResponseBody(body: unknown): Team {
  if (!body || typeof body !== 'object') {
    throw new Error('Nieprawidłowa odpowiedź serwera.');
  }
  const root = body as Record<string, unknown>;
  const data = root.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const team = (data as Record<string, unknown>).team;
    if (team && typeof team === 'object' && typeof (team as Team).id === 'string') {
      return team as Team;
    }
  }
  throw new Error('Nieprawidłowa odpowiedź serwera.');
}

export function useTeams(): UseQueryResult<TeamListItem[], Error> {
  return useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: async (): Promise<TeamListItem[]> => {
      const response = await api.get('/teams');
      return parseTeamsFromResponseBody(response.data);
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
      const response = await api.post('/teams', { name });
      return parseCreatedTeamFromResponseBody(response.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
    },
  });
}

export function useUpdateTeamMutation(): UseMutationResult<
  Team,
  Error,
  { teamId: string; name: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, name }) => {
      const response = await teamsApi.update(teamId, { name });
      return response.data.data.team;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
    },
  });
}

export function useDeleteTeamMutation(): UseMutationResult<
  { teamId: string },
  Error,
  { teamId: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId }) => {
      const response = await teamsApi.delete(teamId);
      return response.data.data;
    },
    onSuccess: (_data, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['teamMembers', teamId] });
    },
  });
}

export function useUpdateMemberRoleMutation(): UseMutationResult<
  TeamMemberApiRow,
  Error,
  { teamId: string; userId: string; role: TeamRole }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId, role }) => {
      const response = await teamsApi.updateMemberRole(teamId, userId, role);
      return response.data.data.member;
    },
    onSuccess: (_data, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: ['teamMembers', teamId] });
      void queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
    },
  });
}

export function useRemoveMemberMutation(): UseMutationResult<
  { teamId: string; userId: string; left: boolean },
  Error,
  { teamId: string; targetUserId: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, targetUserId }) => {
      const response = await teamsApi.removeMember(teamId, targetUserId);
      return response.data.data;
    },
    onSuccess: (_data, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: ['teamMembers', teamId] });
      void queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });
    },
  });
}
