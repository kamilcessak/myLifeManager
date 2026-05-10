/** Workspace id: `null` = konto osobiste (brak `teamId` w query). */
export type WorkspaceId = string | null;

export function tasksInboxQueryKey(activeWorkspaceId: WorkspaceId) {
  return ['tasks', activeWorkspaceId, 'inbox'] as const;
}

export function tasksScheduledQueryKey(
  activeWorkspaceId: WorkspaceId,
  startDate: string,
  endDate: string,
) {
  return ['tasks', activeWorkspaceId, 'scheduled', startDate, endDate] as const;
}

export function eventsRangeQueryKey(
  activeWorkspaceId: WorkspaceId,
  startDate: string,
  endDate: string,
) {
  return ['events', activeWorkspaceId, startDate, endDate] as const;
}

export const teamsQueryKey = ['teams'] as const;
