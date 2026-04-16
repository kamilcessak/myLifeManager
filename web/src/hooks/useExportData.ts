import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { authApi } from '../lib/api';

/**
 * Extract a filename from a Content-Disposition header.
 * Falls back to a reasonable default if the header is missing or malformed.
 */
function parseFilename(header: string | null | undefined, fallback: string): string {
  if (!header) return fallback;

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      /* ignore decode errors – fall through to the quoted variant */
    }
  }

  const match = /filename="?([^";]+)"?/i.exec(header);
  if (match?.[1]) return match[1].trim();

  return fallback;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const objectUrl = window.URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Release the object URL on the next tick – some browsers need the anchor
  // click to fully dispatch before the URL can be revoked.
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
}

/**
 * Download the current user's personal data archive (GDPR export).
 *
 * The endpoint requires a Bearer token, so we go through `authApi` (Axios) to
 * get the bytes as a Blob and then synthesize a `<a download>` click in the
 * browser to persist the file.
 */
export function useExportData(): UseMutationResult<void, unknown, void> {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const response = await authApi.exportData();

      const filename = parseFilename(
        response.headers?.['content-disposition'] as string | undefined,
        `mlm-export-${new Date().toISOString().slice(0, 10)}.json`,
      );

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([JSON.stringify(response.data)], { type: 'application/json' });

      triggerBrowserDownload(blob, filename);
    },
  });
}
