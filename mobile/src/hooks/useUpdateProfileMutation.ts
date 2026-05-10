import { useMutation } from '@tanstack/react-query';
import type { User } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';

type MeUser = Pick<User, 'id' | 'email' | 'name' | 'avatarUrl' | 'createdAt'>;

interface MePatchSuccessPayload {
  status: 'success';
  data: {
    user: MeUser;
  };
}

export type UpdateProfileBody = {
  name?: string;
  avatarUrl?: string;
};

export function useUpdateProfileMutation() {
  const updateUser = useAuthStore((s) => s.updateUser);

  return useMutation({
    mutationFn: async (body: UpdateProfileBody) => {
      const { data } = await apiClient.patch<MePatchSuccessPayload>('/auth/me', body);
      return data.data.user;
    },
    onSuccess: (user) => {
      updateUser({
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
    },
  });
}
