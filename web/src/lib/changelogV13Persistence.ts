const LS_KEY = 'hide_v1_3_modal';
const COOKIE_NAME = 'app_version_seen';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export const CHANGELOG_V13_VERSION = '1.3';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};path=/;max-age=${maxAgeSeconds};SameSite=Lax`;
}

/** Show 1.3 changelog until the user dismisses it (localStorage and/or cookie). */
export function shouldShowV13Changelog(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.localStorage.getItem(LS_KEY) === 'true') return false;
  if (getCookie(COOKIE_NAME) === CHANGELOG_V13_VERSION) return false;
  return true;
}

export function acknowledgeV13Changelog(): void {
  window.localStorage.setItem(LS_KEY, 'true');
  setCookie(COOKIE_NAME, CHANGELOG_V13_VERSION, COOKIE_MAX_AGE_SECONDS);
}
