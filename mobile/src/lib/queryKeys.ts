/** Workspace id: `null` = konto osobiste (brak `teamId` w query). */
export type WorkspaceId = string | null;

export function tasksInboxQueryKey(activeWorkspaceId: WorkspaceId) {
  return ['tasks', activeWorkspaceId, 'inbox'] as const;
}

export const teamsQueryKey = ['teams'] as const;
