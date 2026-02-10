import { create } from 'zustand';
import { authApi } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
  
  login: async (email, password) => {
    const response = await authApi.login({ email, password });
    const { user, token } = response.data.data;
    
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true });
  },
  
  register: async (email, password, name) => {
    const response = await authApi.register({ email, password, name });
    const { user, token } = response.data.data;
    
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    
    try {
      const response = await authApi.me();
      set({
        user: response.data.data.user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem('token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));

// Check auth on app load
useAuthStore.getState().checkAuth();
