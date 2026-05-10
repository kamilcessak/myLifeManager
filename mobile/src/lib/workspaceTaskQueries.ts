import { useAssigneeFilterStore } from '../store/assigneeFilterStore';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import {
  eventsRangeQueryKey,
  tasksInboxQueryKey,
  tasksScheduledQueryKey,
  type WorkspaceId,
} from './queryKeys';

export function assigneeFilterUserIdForWorkspace(activeWorkspaceId: WorkspaceId): string | null {
  const onlyMine = useAssigneeFilterStore.getState().onlyMine;
  const userId = useAuthStore.getState().user?.id ?? null;
  if (activeWorkspaceId !== null && onlyMine && userId) {
    return userId;
  }
  return null;
}

/** Parametr `assigneeId` dla zapytań list (tylko zespół + filtr). */
export function assigneeIdApiParam(activeWorkspaceId: WorkspaceId): string | undefined {
  const id = assigneeFilterUserIdForWorkspace(activeWorkspaceId);
  return id ?? undefined;
}

export function resolveInboxQueryKey() {
  const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  return tasksInboxQueryKey(
    activeWorkspaceId,
    assigneeFilterUserIdForWorkspace(activeWorkspaceId),
  );
}

export function resolveScheduledQueryKey(startDate: string, endDate: string) {
  const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  return tasksScheduledQueryKey(
    activeWorkspaceId,
    startDate,
    endDate,
    assigneeFilterUserIdForWorkspace(activeWorkspaceId),
  );
}

export function resolveEventsRangeQueryKey(startDate: string, endDate: string) {
  const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  return eventsRangeQueryKey(
    activeWorkspaceId,
    startDate,
    endDate,
    assigneeFilterUserIdForWorkspace(activeWorkspaceId),
  );
}
