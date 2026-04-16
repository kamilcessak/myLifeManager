import { z } from 'zod';

// ==================== AUTH ====================
export const registerSchema = z.object({
  email: z.string().email('Nieprawidłowy format email'),
  password: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
  name: z.string().min(2, 'Imię musi mieć co najmniej 2 znaki').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Nieprawidłowy format email'),
  password: z.string().min(1, 'Hasło jest wymagane'),
});

// ==================== CATEGORY ====================
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana').max(50, 'Nazwa może mieć max 50 znaków'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Nieprawidłowy format koloru (np. #FF5733)'),
  icon: z.string().optional(),
  teamId: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// ==================== TASK ====================
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Tytuł jest wymagany').max(255),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
  priority: z.number().min(1).max(4).default(2),
  deadline: z.string().datetime().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  recurrenceRule: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  isCompleted: z.boolean().optional(),
});

export const scheduleTaskSchema = z.object({
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
});

// ==================== EVENT ====================
export const createEventSchema = z.object({
  title: z.string().min(1, 'Tytuł jest wymagany').max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isAllDay: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
});

export const updateEventSchema = createEventSchema.partial();

// ==================== QUERY ====================
export const dateRangeQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
});

export const taskQuerySchema = z.object({
  categoryId: z.string().optional(),
  isCompleted: z.enum(['true', 'false']).optional(),
  scheduled: z.enum(['true', 'false']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  teamId: z.string().optional(),
});

/** List categories — optional team scope */
export const getCategoriesQuerySchema = z.object({
  teamId: z.string().optional(),
});

/** Aliases for list endpoints */
export const getTasksQuerySchema = taskQuerySchema;
export const getEventsQuerySchema = dateRangeQuerySchema;

// ==================== TEAM ====================
export const createTeamSchema = z.object({
  name: z.string().min(1, 'Nazwa zespołu jest wymagana'),
});

export const inviteMembersSchema = z.object({
  emails: z.array(z.string().email('Nieprawidłowy format email')),
});

export const joinTeamSchema = z.object({
  code: z.string().min(1, 'Kod zaproszenia jest wymagany'),
});

// ==================== SEARCH ====================
export const searchResultItemSchema = z.object({
  id: z.string(),
  type: z.enum(['task', 'event']),
  title: z.string(),
  description: z.string().nullable(),
  date: z.string().datetime(),
  teamId: z.string().nullable(),
  teamName: z.string().optional(),
});

export const searchResponseSchema = z.object({
  results: z.array(searchResultItemSchema),
});

export const searchQuerySchema = z.object({
  q: z.string().optional(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ScheduleTaskInput = z.infer<typeof scheduleTaskSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type GetCategoriesQuery = z.infer<typeof getCategoriesQuerySchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type InviteMembersInput = z.infer<typeof inviteMembersSchema>;
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchResultItemSchema = z.infer<typeof searchResultItemSchema>;
export type SearchResponseSchema = z.infer<typeof searchResponseSchema>;
