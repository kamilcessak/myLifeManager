import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export interface UploadAvatarResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  avatarUrl: string | null;
}

/**
 * Upload a (cropped) avatar blob to `POST /api/auth/avatar` and refresh the
 * authenticated user in the Zustand store so every avatar consumer
 * (`AssigneeAvatar`, header, etc.) rerenders with the new URL.
 */
export function useUploadAvatar(): UseMutationResult<UploadAvatarResult, unknown, File | Blob> {
  const updateUser = useAuthStore((s) => s.updateUser);

  return useMutation({
    mutationFn: async (file: File | Blob): Promise<UploadAvatarResult> => {
      const response = await authApi.uploadAvatar(file);
      return response.data.data;
    },
    onSuccess: ({ user, avatarUrl }) => {
      updateUser({
        name: user.name,
        avatarUrl: avatarUrl ?? user.avatarUrl,
      });
    },
  });
}
