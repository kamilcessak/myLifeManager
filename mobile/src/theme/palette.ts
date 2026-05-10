export type AppColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  danger: string;
  offlineBannerBg: string;
  offlineBannerText: string;
};

export const lightPalette: AppColors = {
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceMuted: '#f3f4f6',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  primary: '#2563eb',
  danger: '#dc2626',
  offlineBannerBg: '#1e293b',
  offlineBannerText: '#f8fafc',
};

export const darkPalette: AppColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceMuted: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  border: '#334155',
  primary: '#60a5fa',
  danger: '#f87171',
  offlineBannerBg: '#020617',
  offlineBannerText: '#e2e8f0',
};
