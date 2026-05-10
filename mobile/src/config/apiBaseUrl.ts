import { Platform } from "react-native";

const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? "3001";

/**
 * Base URL for the Express API, including the `/api` prefix (same as Vite proxy on web).
 *
 * - iOS Simulator: `localhost` reaches the host machine.
 * - Android Emulator: use `10.0.2.2` (special alias to host loopback).
 * - Physical device: set `EXPO_PUBLIC_API_BASE_URL` to `http://<LAN-IP>:3001/api`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const host = Platform.OS === "android" ? "192.168.1.69" : "localhost";
  return `http://${host}:${API_PORT}/api`;
}

/** Origin hosting `/api` and static `/uploads` (no trailing slash). */
export function getApiOrigin(): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  return base.replace(/\/api\/?$/i, "") || base;
}

/** Turn API-relative paths (`/uploads/...`) into a fetchable URL on the device. */
export function resolveMediaUrl(relativeOrAbsolute: string): string {
  if (relativeOrAbsolute.startsWith("http://") || relativeOrAbsolute.startsWith("https://")) {
    return relativeOrAbsolute;
  }
  const path = relativeOrAbsolute.startsWith("/") ? relativeOrAbsolute : `/${relativeOrAbsolute}`;
  return `${getApiOrigin()}${path}`;
}
