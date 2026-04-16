import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export interface UpdateProfileVariables {
  name?: string;
  avatarUrl?: string;
}

export interface UpdateProfileResult {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/**
 * Update text profile fields (name, avatarUrl via PATCH /api/auth/me).
 *
 * NOTE: Avatar file uploads are no longer handled here. Use `useUploadAvatar`
 * for the dedicated `POST /api/auth/avatar` flow (with crop + cleanup of the
 * previous file).
 */
export function useUpdateProfile(): UseMutationResult<
  UpdateProfileResult,
  unknown,
  UpdateProfileVariables
> {
  const updateUser = useAuthStore((s) => s.updateUser);

  return useMutation({
    mutationFn: async ({
      name,
      avatarUrl,
    }: UpdateProfileVariables): Promise<UpdateProfileResult> => {
      const payload: { name?: string; avatarUrl?: string } = {};
      const trimmedName = name?.trim();
      if (trimmedName && trimmedName.length > 0) {
        payload.name = trimmedName;
      }
      if (avatarUrl) {
        payload.avatarUrl = avatarUrl;
      }

      const response = await authApi.updateProfile(payload);
      return response.data.data.user;
    },
    onSuccess: (user) => {
      updateUser({
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
    },
  });
}
