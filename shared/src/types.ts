// ==================== TEAMS / WORKSPACES ====================
export type TeamRole = 'OWNER' | 'MEMBER';

export type InvitationStatus = 'PENDING' | 'ACCEPTED';

export interface Team {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date | string;
  team?: Team;
  user?: User;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  code: string;
  status: InvitationStatus;
  expiresAt: Date | string;
  createdAt: Date | string;
  team?: Team;
}

// ==================== USER ====================
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  teamMembers?: TeamMember[];
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
  teamId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  team?: Team;
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
  teamId?: string;
  categoryId: string | null;
  category?: Category | null;
  team?: Team;
  assigneeId?: string | null;
  assignee?: Pick<User, 'id' | 'name' | 'avatarUrl' | 'email'> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  /** Bazowe ID zadania, gdy wiersz jest syntetyczną instancją RRULE (GET /tasks z zakresem dat). */
  originalTaskId?: string;
  isRecurringInstance?: boolean;
}

export type TaskPriority = 1 | 2 | 3 | 4;

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
  teamId?: string;
  categoryId: string | null;
  category?: Category | null;
  team?: Team;
  assigneeId?: string | null;
  assignee?: Pick<User, 'id' | 'name' | 'avatarUrl' | 'email'> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  // For recurring event instances
  originalEventId?: string;
  isRecurringInstance?: boolean;
}

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

// ==================== SEARCH ====================
export type SearchResultType = 'task' | 'event';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  description: string | null;
  /** ISO 8601 date string */
  date: string;
  /**
   * Workspace the item belongs to.
   * - `null` for personal items (no team).
   * - `string` (team id) for items owned by a team the user is a member of.
   */
  teamId: string | null;
  /**
   * Display name of the team workspace.
   * - `undefined` for personal items.
   * - `string` (team name) for team items.
   */
  teamName?: string;
  /**
   * Optional assignee summary for the item.
   * - `null` / `undefined` when the item is unassigned.
   * - Populated with a subset of the assignee's user fields otherwise.
   */
  assignee?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
}

export interface SearchResponse {
  results: SearchResultItem[];
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
