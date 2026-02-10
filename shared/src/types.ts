// ==================== USER ====================
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserWithoutPassword extends Omit<User, 'password'> {}

// ==================== CATEGORY ====================
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isDefault: boolean;
  order: number;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ==================== TASK ====================
export interface Task {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
  completedAt: Date | string | null;
  scheduledStart: Date | string | null;
  scheduledEnd: Date | string | null;
  deadline: Date | string | null;
  priority: TaskPriority;
  recurrenceRule: string | null;
  imageUrl: string | null;
  userId: string;
  categoryId: string | null;
  category?: Category | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type TaskPriority = 1 | 2 | 3 | 4;

export interface CreateTaskInput {
  title: string;
  description?: string;
  categoryId?: string;
  priority?: TaskPriority;
  deadline?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  recurrenceRule?: string;
  imageUrl?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  isCompleted?: boolean;
}

export interface ScheduleTaskInput {
  scheduledStart: string;
  scheduledEnd: string;
}

// ==================== EVENT ====================
export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date | string;
  endTime: Date | string;
  isAllDay: boolean;
  recurrenceRule: string | null;
  userId: string;
  categoryId: string | null;
  category?: Category | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  // For recurring event instances
  originalEventId?: string;
  isRecurringInstance?: boolean;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  categoryId?: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  recurrenceRule?: string;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {}

// ==================== CALENDAR ====================
export interface CalendarItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  type: 'task' | 'event';
  color?: string;
  data: Task | Event;
  classNames?: string[];
}

// ==================== API RESPONSES ====================
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface AuthResponse {
  user: UserWithoutPassword;
  token: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
