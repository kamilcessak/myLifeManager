import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { authApi, uploadApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export interface UpdateProfileVariables {
  name?: string;
  avatarFile?: File | null;
}

export interface UpdateProfileResult {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

async function extractUploadedUrl(
  response: Awaited<ReturnType<typeof uploadApi.upload>>,
): Promise<string> {
  const data = response.data?.data ?? {};
  const url = data.imageUrl || data.url;
  if (!url || typeof url !== 'string') {
    throw new Error('Serwer nie zwrócił adresu URL przesłanego pliku.');
  }
  return url;
}

export function useUpdateProfile(): UseMutationResult<
  UpdateProfileResult,
  unknown,
  UpdateProfileVariables
> {
  const updateUser = useAuthStore((s) => s.updateUser);

  return useMutation({
    mutationFn: async ({
      name,
      avatarFile,
    }: UpdateProfileVariables): Promise<UpdateProfileResult> => {
      let avatarUrl: string | undefined;

      if (avatarFile) {
        const uploadResponse = await uploadApi.upload(avatarFile);
        avatarUrl = await extractUploadedUrl(uploadResponse);
      }

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
