import type { Event, Task } from '@mlm/shared';
import { PRIORITY_COLORS } from '@mlm/shared';
import { addHours, endOfDay, startOfDay } from 'date-fns';
import type { ICalendarEventBase } from 'react-native-big-calendar';

export type MlmCalendarEvent = ICalendarEventBase & {
  itemKind: 'task' | 'event';
  /** Kolor kategorii (zadanie / wydarzenie) lub domyślny priorytet / niebieski. */
  accentColor: string;
  /** Pasek priorytetu dla zadań (jak w liście inbox). */
  priorityColor?: string;
  sourceTask?: Task;
  sourceEvent?: Event;
};

const DEFAULT_TASK_BLOCK_MS = 60 * 60 * 1000;

function taskToCalendarEvent(task: Task): MlmCalendarEvent | null {
  if (task.scheduledStart == null) return null;

  const start = new Date(task.scheduledStart);
  let end: Date;
  if (task.scheduledEnd != null) {
    end = new Date(task.scheduledEnd);
  } else {
    end = new Date(start.getTime() + DEFAULT_TASK_BLOCK_MS);
  }

  const priorityColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[2];
  const accentColor = task.category?.color ?? priorityColor;

  return {
    title: task.title,
    start,
    end,
    itemKind: 'task',
    accentColor,
    priorityColor,
    sourceTask: task,
  };
}

function eventToCalendarEvent(event: Event): MlmCalendarEvent {
  const start = new Date(event.startTime);
  let end = new Date(event.endTime);

  if (event.isAllDay) {
    const day = startOfDay(start);
    return {
      title: event.title,
      start: day,
      end: endOfDay(day),
      itemKind: 'event',
      accentColor: event.category?.color ?? '#3B82F6',
      sourceEvent: event,
      hideHours: true,
    };
  }

  if (end.getTime() <= start.getTime()) {
    end = addHours(start, 1);
  }

  return {
    title: event.title,
    start,
    end,
    itemKind: 'event',
    accentColor: event.category?.color ?? '#3B82F6',
    sourceEvent: event,
  };
}

export function buildCalendarEventsFromTasksAndEvents(
  tasks: Task[] | undefined,
  events: Event[] | undefined,
): MlmCalendarEvent[] {
  const fromTasks = (tasks ?? [])
    .map(taskToCalendarEvent)
    .filter((e): e is MlmCalendarEvent => e != null);
  const fromEvents = (events ?? []).map(eventToCalendarEvent);

  return [...fromTasks, ...fromEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}
