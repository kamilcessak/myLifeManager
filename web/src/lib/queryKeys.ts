export type WorkspaceId = string | null;

export const queryKeys = {
  categories: (teamId: WorkspaceId) => ['categories', teamId] as const,
  tasksInbox: (teamId: WorkspaceId) => ['tasks', teamId, 'inbox'] as const,
  tasksScheduled: (teamId: WorkspaceId, startDate: string, endDate: string) =>
    ['tasks', teamId, 'scheduled', startDate, endDate] as const,
  events: (teamId: WorkspaceId, startDate: string, endDate: string) =>
    ['events', teamId, startDate, endDate] as const,
};
