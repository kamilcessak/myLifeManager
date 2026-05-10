import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { clearMobileClientSession } from './clearMobileClientSession';
import { clearStoredToken, getStoredToken } from './tokenStorage';

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete (config.headers as Record<string, string>)['Content-Type'];
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await clearStoredToken();
      clearMobileClientSession();
      const { useAuthStore } = await import('../store/authStore');
      useAuthStore.getState().logoutLocal();
    }
    return Promise.reject(error);
  },
);
