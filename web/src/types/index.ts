export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isDefault: boolean;
  order: number;
}

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  taskId: string | null;
  eventId: string | null;
  userId?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface TaskAssignee {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduledAllDay?: boolean;
  deadline: string | null;
  priority: number;
  recurrenceRule: string | null;
  imageUrl: string | null;
  reminderMinutes: number | null;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  categoryId: string | null;
  category: Category | null;
  attachments?: Attachment[];
  assigneeId?: string | null;
  assignee?: TaskAssignee | null;
  // Populated on synthetic RRULE instances returned by the scheduled-tasks
  // endpoint. The `id` of such an instance has the form `${originalTaskId}_${index}`.
  originalTaskId?: string;
  isRecurringInstance?: boolean;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  recurrenceRule: string | null;
  reminderMinutes: number | null;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  categoryId: string | null;
  category: Category | null;
  originalEventId?: string;
  isRecurringInstance?: boolean;
  attachments?: Attachment[];
  assigneeId?: string | null;
  assignee?: TaskAssignee | null;
}

export interface CalendarItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  type: "task" | "event";
  color?: string;
  data: Task | Event;
  classNames?: string[];
}

