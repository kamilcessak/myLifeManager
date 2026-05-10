import { getApiBaseUrl } from '../config/apiBaseUrl';

/** Buduje pełny URL awatara (ścieżki względne względem hosta API bez sufiksu `/api`). */
export function resolveAvatarUri(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.trim()) return null;
  const u = avatarUrl.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) {
    return u;
  }
  const api = getApiBaseUrl();
  const origin = api.replace(/\/api\/?$/, '');
  return u.startsWith('/') ? `${origin}${u}` : `${origin}/${u}`;
}
