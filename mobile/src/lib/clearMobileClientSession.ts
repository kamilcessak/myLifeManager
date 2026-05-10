import { queryClient } from './queryClient';

/** Clears React Query cache when the session ends (parity with web `clearClientSession`). */
export function clearMobileClientSession(): void {
  queryClient.clear();
}
