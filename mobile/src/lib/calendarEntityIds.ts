import type { Event, Task } from '@mlm/shared';

export function getTaskStableId(task: Pick<Task, 'id' | 'originalTaskId'>): string {
  return task.originalTaskId ?? task.id;
}

export function getEventStableId(event: Pick<Event, 'id' | 'originalEventId'>): string {
  return event.originalEventId ?? event.id;
}
