export type WorkspaceId = string | null;
export type AssigneeFilter = string | null;

export const queryKeys = {
  categories: (teamId: WorkspaceId) => ['categories', teamId] as const,
  tasksInbox: (teamId: WorkspaceId, assigneeId: AssigneeFilter = null) =>
    ['tasks', teamId, 'inbox', { assigneeId }] as const,
  tasksScheduled: (
    teamId: WorkspaceId,
    startDate: string,
    endDate: string,
    assigneeId: AssigneeFilter = null,
  ) => ['tasks', teamId, 'scheduled', startDate, endDate, { assigneeId }] as const,
  events: (
    teamId: WorkspaceId,
    startDate: string,
    endDate: string,
    assigneeId: AssigneeFilter = null,
  ) => ['events', teamId, startDate, endDate, { assigneeId }] as const,
};
