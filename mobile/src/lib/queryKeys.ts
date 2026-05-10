/** Workspace id: `null` = konto osobiste (brak `teamId` w query). */
export type WorkspaceId = string | null;

/**
 * Gdy filtr „Tylko moje” jest aktywny w zespole, `assigneeFilterUserId` = id użytkownika;
 * w przeciwnym razie `null` (brak parametru assigneeId w API).
 */
export function tasksInboxQueryKey(
  activeWorkspaceId: WorkspaceId,
  assigneeFilterUserId: string | null = null,
) {
  return ['tasks', activeWorkspaceId, 'inbox', assigneeFilterUserId] as const;
}

export function tasksScheduledQueryKey(
  activeWorkspaceId: WorkspaceId,
  startDate: string,
  endDate: string,
  assigneeFilterUserId: string | null = null,
) {
  return [
    'tasks',
    activeWorkspaceId,
    'scheduled',
    startDate,
    endDate,
    assigneeFilterUserId,
  ] as const;
}

export function eventsRangeQueryKey(
  activeWorkspaceId: WorkspaceId,
  startDate: string,
  endDate: string,
  assigneeFilterUserId: string | null = null,
) {
  return ['events', activeWorkspaceId, startDate, endDate, assigneeFilterUserId] as const;
}

export const teamsQueryKey = ['teams'] as const;

export function teamMembersQueryKey(teamId: string) {
  return ['teamMembers', teamId] as const;
}

export function taskActivityQueryKey(activityTaskId: string) {
  return ['tasks', activityTaskId, 'activity'] as const;
}

export function taskDetailQueryKey(taskId: string) {
  return ['tasks', 'detail', taskId] as const;
}

export function eventDetailQueryKey(eventId: string) {
  return ['events', 'detail', eventId] as const;
}
