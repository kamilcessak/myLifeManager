import { queryClient } from './queryClient';
import { purgePersistedQueryCache } from './queryPersister';

/** Clears React Query cache when the session ends (parity with web `clearClientSession`). */
export function clearMobileClientSession(): void {
  queryClient.clear();
  void purgePersistedQueryCache();
}
