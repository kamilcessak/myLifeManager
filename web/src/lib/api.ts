import axios from "axios";
import type {
  SearchResultItem,
  Team,
  TeamInvitation,
  TeamRole,
} from "shared";
import { type Attachment } from "../types";
import { clearClientSession } from "./clearClientSession";

export type TeamMemberApiRow = {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete (config.headers as Record<string, string>)["Content-Type"];
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      clearClientSession();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    api.patch<{
      status: string;
      data: {
        user: {
          id: string;
          email: string;
          name: string | null;
          avatarUrl: string | null;
          createdAt: string;
        };
      };
    }>("/auth/me", data),
  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }) =>
    api.patch<{ status: string; message: string }>("/auth/password", data),
  uploadAvatar: (file: File | Blob, filename = "avatar.jpg") => {
    const formData = new FormData();
    const blobFile =
      file instanceof File ? file : new File([file], filename, { type: file.type || "image/jpeg" });
    formData.append("avatar", blobFile);
    return api.post<{
      status: string;
      data: {
        user: {
          id: string;
          email: string;
          name: string | null;
          avatarUrl: string | null;
          createdAt: string;
        };
        avatarUrl: string | null;
      };
    }>("/auth/avatar", formData);
  },
};

// Teams
export const teamsApi = {
  list: () =>
    api.get<{ status: string; data: { teams: unknown[] } }>("/teams"),

  create: (data: { name: string }) =>
    api.post<{ status: string; data: { team: Team } }>("/teams", data),

  getMembers: (teamId: string) =>
    api.get<{ status: string; data: { members: TeamMemberApiRow[] } }>(
      `/teams/${teamId}/members`,
    ),

  inviteMembers: (teamId: string, emails: string[]) =>
    api.post<{ status: string; data: { invitations: TeamInvitation[] } }>(
      `/teams/${teamId}/invites`,
      { emails },
    ),

  join: (code: string) =>
    api.post<{ status: string; data: { teamId: string; message: string } }>(
      "/teams/join",
      { code },
    ),
};

// Tasks
export const tasksApi = {
  getAll: (params?: {
    categoryId?: string;
    isCompleted?: boolean;
    scheduled?: boolean;
    startDate?: string;
    endDate?: string;
    teamId?: string;
  }) => api.get("/tasks", { params }),

  getInbox: (categoryId?: string, teamId?: string | null) =>
    api.get("/tasks/inbox", {
      params: {
        ...(categoryId ? { categoryId } : {}),
        ...(teamId ? { teamId } : {}),
      },
    }),

  getById: (id: string) => api.get(`/tasks/${id}`),

  create: (data: {
    title: string;
    description?: string;
    categoryId?: string;
    teamId?: string;
    priority?: number;
    deadline?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    scheduledAllDay?: boolean;
    recurrenceRule?: string;
    imageUrl?: string;
    reminderMinutes?: number | null;
    assigneeId?: string | null;
  }) => api.post("/tasks", data),

  update: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      categoryId: string;
      priority: number;
      deadline: string;
      scheduledAllDay: boolean;
      scheduledStart: string;
      scheduledEnd: string;
      recurrenceRule: string;
      imageUrl: string;
      isCompleted: boolean;
      reminderMinutes: number | null;
      teamId: string;
      assigneeId: string | null;
    }>,
  ) => api.patch(`/tasks/${id}`, data),

  schedule: (
    id: string,
    data: { scheduledStart: string; scheduledEnd: string },
  ) => api.patch(`/tasks/${id}/schedule`, data),

  unschedule: (id: string) => api.patch(`/tasks/${id}/unschedule`),

  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// Events
export const eventsApi = {
  getAll: (params: {
    startDate: string;
    endDate: string;
    categoryId?: string;
    teamId?: string;
  }) => api.get("/events", { params }),

  getById: (id: string) => api.get(`/events/${id}`),

  create: (data: {
    title: string;
    description?: string;
    location?: string;
    categoryId?: string;
    teamId?: string;
    startTime: string;
    endTime: string;
    isAllDay?: boolean;
    recurrenceRule?: string;
    reminderMinutes?: number | null;
    assigneeId?: string | null;
  }) => api.post("/events", data),

  update: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      location: string;
      categoryId: string;
      startTime: string;
      endTime: string;
      isAllDay: boolean;
      recurrenceRule: string;
      reminderMinutes: number | null;
      teamId: string;
      assigneeId: string | null;
    }>,
  ) => api.patch(`/events/${id}`, data),

  delete: (id: string) => api.delete(`/events/${id}`),
};

// Categories
export const categoriesApi = {
  getAll: (teamId?: string | null) =>
    api.get("/categories", { params: teamId ? { teamId } : undefined }),

  create: (data: { name: string; color: string; icon?: string; teamId?: string }) =>
    api.post("/categories", data),

  update: (
    id: string,
    data: Partial<{ name: string; color: string; icon: string }>,
  ) => api.patch(`/categories/${id}`, data),

  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Upload (legacy obrazów)
export const uploadApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.post<{
      status: string;
      data: {
        imageUrl?: string;
        url?: string;
        filename?: string;
        size?: number;
      };
    }>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  delete: (filename: string) => api.delete(`/upload/${filename}`),
};

export const attachmentsApi = {
  upload: (file: File, opts: { taskId?: string; eventId?: string }) => {
    const formData = new FormData();
    formData.append("file", file);
    if (opts.taskId) formData.append("taskId", opts.taskId);
    if (opts.eventId) formData.append("eventId", opts.eventId);
    return api.post<{ status: string; data: { attachment: Attachment } }>(
      "/attachments/upload",
      formData,
    );
  },

  delete: (id: string) => api.delete(`/attachments/${id}`),
};

// Notifications
export const notificationsApi = {
  getVapidPublicKey: () =>
    api.get<{ status: string; data: { key: string } }>('/notifications/vapidPublicKey'),

  subscribe: (subscription: PushSubscriptionJSON) =>
    api.post('/notifications/subscribe', subscription),

  unsubscribe: (endpoint: string) =>
    api.delete('/notifications/unsubscribe', { data: { endpoint } }),
};

// Search
export const searchApi = {
  search: (q: string) =>
    api.get<{ status: string; data: { results: SearchResultItem[] } }>("/search", {
      params: { q },
    }),
};

export { api };
export default api;
