import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Tasks
export const tasksApi = {
  getAll: (params?: {
    categoryId?: string;
    isCompleted?: boolean;
    scheduled?: boolean;
    startDate?: string;
    endDate?: string;
  }) => api.get('/tasks', { params }),
  
  getInbox: (categoryId?: string) =>
    api.get('/tasks/inbox', { params: { categoryId } }),
  
  getById: (id: string) => api.get(`/tasks/${id}`),
  
  create: (data: {
    title: string;
    description?: string;
    categoryId?: string;
    priority?: number;
    deadline?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    scheduledAllDay?: boolean;
    recurrenceRule?: string;
    imageUrl?: string;
  }) => api.post('/tasks', data),
  
  update: (id: string, data: Partial<{
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
  }>) => api.patch(`/tasks/${id}`, data),
  
  schedule: (id: string, data: { scheduledStart: string; scheduledEnd: string }) =>
    api.patch(`/tasks/${id}/schedule`, data),
  
  unschedule: (id: string) => api.patch(`/tasks/${id}/unschedule`),
  
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// Events
export const eventsApi = {
  getAll: (params: { startDate: string; endDate: string; categoryId?: string }) =>
    api.get('/events', { params }),
  
  getById: (id: string) => api.get(`/events/${id}`),
  
  create: (data: {
    title: string;
    description?: string;
    location?: string;
    categoryId?: string;
    startTime: string;
    endTime: string;
    isAllDay?: boolean;
    recurrenceRule?: string;
  }) => api.post('/events', data),
  
  update: (id: string, data: Partial<{
    title: string;
    description: string;
    location: string;
    categoryId: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    recurrenceRule: string;
  }>) => api.patch(`/events/${id}`, data),
  
  delete: (id: string) => api.delete(`/events/${id}`),
};

// Categories
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  
  create: (data: { name: string; color: string; icon?: string }) =>
    api.post('/categories', data),
  
  update: (id: string, data: Partial<{ name: string; color: string; icon: string }>) =>
    api.patch(`/categories/${id}`, data),
  
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Upload
export const uploadApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  delete: (filename: string) => api.delete(`/upload/${filename}`),
};

export default api;
