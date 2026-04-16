import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { authApi } from '../lib/api';

export interface ChangePasswordVariables {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ChangePasswordResult {
  status: string;
  message: string;
}

/**
 * Change the current user's password via PATCH /api/auth/password.
 */
export function useChangePassword(): UseMutationResult<
  ChangePasswordResult,
  unknown,
  ChangePasswordVariables
> {
  return useMutation({
    mutationFn: async (variables: ChangePasswordVariables): Promise<ChangePasswordResult> => {
      const response = await authApi.changePassword(variables);
      return response.data;
    },
  });
}
