import { create } from 'zustand';
import type { User } from '@mlm/shared';
import { apiClient } from '../lib/apiClient';
import { clearMobileClientSession } from '../lib/clearMobileClientSession';
import { clearStoredToken, getStoredToken, setStoredToken } from '../lib/tokenStorage';

type AuthUser = Pick<User, 'id' | 'email' | 'name' | 'avatarUrl' | 'createdAt'>;

interface AuthSuccessPayload {
  status: 'success';
  data: {
    user: AuthUser;
    token: string;
  };
}

interface MeSuccessPayload {
  status: 'success';
  data: {
    user: AuthUser;
  };
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Clears in-memory session after HTTP 401 (token already removed from SecureStore by the interceptor). */
  logoutLocal: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  logoutLocal: () => {
    set({ user: null, token: null, isAuthenticated: false });
  },

  login: async (email, password) => {
    // TODO(Phase 2): bogatsza obsługa błędów (toast, kody 409/422), odświeżanie tokenów
    const { data } = await apiClient.post<AuthSuccessPayload>('/auth/login', { email, password });
    const { user, token } = data.data;

    clearMobileClientSession();
    await setStoredToken(token);
    set({ user, token, isAuthenticated: true });
  },

  register: async (email, password, name) => {
    // TODO(Phase 2): obsługa konfliktów email / walidacji serwera
    const { data } = await apiClient.post<AuthSuccessPayload>('/auth/register', {
      email,
      password,
      name,
    });
    const { user, token } = data.data;

    clearMobileClientSession();
    await setStoredToken(token);
    set({ user, token, isAuthenticated: true });
  },

  logout: async () => {
    await clearStoredToken();
    clearMobileClientSession();
    get().logoutLocal();
  },

  updateUser: (patch) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...patch } });
  },

  checkAuth: async () => {
    const token = await getStoredToken();

    if (!token) {
      set({ isLoading: false, isAuthenticated: false, token: null, user: null });
      return;
    }

    try {
      // TODO(Phase 2): dedykowany hook react-query dla /auth/me + cache profilu
      const { data } = await apiClient.get<MeSuccessPayload>('/auth/me');
      set({
        user: data.data.user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await clearStoredToken();
      clearMobileClientSession();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
