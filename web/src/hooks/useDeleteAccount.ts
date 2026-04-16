import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { authApi } from '../lib/api';

/**
 * Permanently delete the current account via `DELETE /api/auth/me`.
 *
 * The hook intentionally does NOT perform any session cleanup / redirect on
 * its own – the caller is responsible for wiring that up in `onSuccess`
 * (typically: `authStore.logout()` + `clearClientSession()` + hard redirect
 * to `/login`). Keeping side effects in the caller makes it easier to handle
 * 400 responses (e.g. solo-owner of a populated team) without leaking the
 * user out of the app.
 */
export function useDeleteAccount(): UseMutationResult<void, unknown, void> {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await authApi.deleteAccount();
    },
  });
}
