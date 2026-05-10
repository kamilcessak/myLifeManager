import { queryClient } from './queryClient';
import { purgePersistedQueryCache } from './queryPersister';
import { clearStoredToken } from './tokenStorage';
import { useAssigneeFilterStore } from '../store/assigneeFilterStore';
import { useAuthStore } from '../store/authStore';
import { useThemePreferencesStore } from '../store/themePreferencesStore';
import { useWorkspaceStore } from '../store/workspaceStore';

/**
 * Po usunięciu konta: token, persystowany cache React Query, pamięć podręczna,
 * Zustand (w tym filtr assignee i preferencje motywu) oraz stan auth.
 */
export async function wipeLocalSessionAfterAccountDeletion(): Promise<void> {
  await clearStoredToken();
  queryClient.clear();
  await purgePersistedQueryCache();

  useWorkspaceStore.getState().resetWorkspace();

  useAssigneeFilterStore.setState({ onlyMine: false });
  await useAssigneeFilterStore.persist.clearStorage();

  useThemePreferencesStore.setState({ themePreference: 'system' });
  await useThemePreferencesStore.persist.clearStorage();

  useAuthStore.getState().logoutLocal();
}
