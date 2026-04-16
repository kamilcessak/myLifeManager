// ==================== PRIORITIES ====================
export const PRIORITIES = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} as const;

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Niski',
  2: 'Średni',
  3: 'Wysoki',
  4: 'Pilne',
};

export const PRIORITY_COLORS: Record<number, string> = {
  1: '#9CA3AF', // gray-400
  2: '#F59E0B', // yellow-500
  3: '#F97316', // orange-500
  4: '#EF4444', // red-500
};

// ==================== DEFAULT CATEGORIES ====================
export const DEFAULT_CATEGORIES = [
  {
    name: 'Dom',
    color: '#10B981', // green-500
    icon: 'home',
  },
  {
    name: 'Firma',
    color: '#3B82F6', // blue-500
    icon: 'briefcase',
  },
] as const;

// ==================== RECURRENCE OPTIONS ====================
export const RECURRENCE_OPTIONS = [
  { value: '', label: 'Nie powtarzaj' },
  { value: 'FREQ=DAILY;INTERVAL=1', label: 'Codziennie' },
  { value: 'FREQ=WEEKLY;INTERVAL=1', label: 'Co tydzień' },
  { value: 'FREQ=WEEKLY;INTERVAL=2', label: 'Co 2 tygodnie' },
  { value: 'FREQ=MONTHLY;INTERVAL=1', label: 'Co miesiąc' },
  { value: 'FREQ=YEARLY;INTERVAL=1', label: 'Co rok' },
] as const;

// ==================== CALENDAR VIEWS ====================
export const CALENDAR_VIEWS = {
  MONTH: 'dayGridMonth',
  WEEK: 'timeGridWeek',
  DAY: 'timeGridDay',
} as const;

// ==================== TIME SLOTS ====================
export const TIME_SLOT_DURATION = 30; // minutes
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 22;

// ==================== WORKSPACES ====================
/**
 * User-facing label for a user's own (non-team) workspace.
 * Used in search results, switchers and any "personal vs team" UI.
 */
export const PERSONAL_WORKSPACE_LABEL = 'Konto osobiste';

/**
 * Fallback label when a team workspace is missing a `teamName` (should not
 * normally happen, but keeps the UI robust against partial payloads).
 */
export const TEAM_WORKSPACE_FALLBACK_LABEL = 'Zespół';

// ==================== FILE UPLOAD ====================
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;
