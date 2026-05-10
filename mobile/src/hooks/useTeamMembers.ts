import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { TeamMember, TeamRole } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { teamMembersQueryKey, teamsQueryKey } from '../lib/queryKeys';

export type TeamMemberListItem = TeamMember & {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

interface MembersSuccess {
  status: string;
  data: { members: TeamMemberListItem[] };
}

export function useTeamMembers(teamId: string | null): UseQueryResult<TeamMemberListItem[], Error> {
  return useQuery({
    queryKey: teamId ? teamMembersQueryKey(teamId) : ['teamMembers', 'disabled'],
    queryFn: async (): Promise<TeamMemberListItem[]> => {
      if (!teamId) return [];
      const { data } = await apiClient.get<MembersSuccess>(`/teams/${teamId}/members`);
      return data.data.members;
    },
    enabled: Boolean(teamId),
  });
}

interface MemberPatchBody {
  role: TeamRole;
}

interface MemberPatchSuccess {
  status: string;
  data: { member: TeamMemberListItem };
}

export function useUpdateMemberRoleMutation(): UseMutationResult<
  TeamMemberListItem,
  Error,
  { teamId: string; userId: string; role: TeamRole }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId, role }) => {
      const { data } = await apiClient.patch<MemberPatchSuccess>(
        `/teams/${teamId}/members/${userId}`,
        { role } satisfies MemberPatchBody,
      );
      return data.data.member;
    },
    onSuccess: (_data, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: teamMembersQueryKey(teamId) });
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
    },
  });
}

interface RemoveSuccess {
  status: string;
  data: { teamId: string; userId: string; left: boolean };
}

export function useRemoveMemberMutation(): UseMutationResult<
  RemoveSuccess['data'],
  Error,
  { teamId: string; targetUserId: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, targetUserId }) => {
      const { data } = await apiClient.delete<RemoveSuccess>(
        `/teams/${teamId}/members/${targetUserId}`,
      );
      return data.data;
    },
    onSuccess: (_data, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: teamMembersQueryKey(teamId) });
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey });
    },
  });
}
