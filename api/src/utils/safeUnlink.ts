import fs from 'fs';
import fsp from 'fs/promises';

/**
 * Remove a file from disk safely.
 *
 * - Does nothing if the path is empty or the file does not exist.
 * - Never throws: errors are logged so callers can continue responding with success
 *   even if the filesystem cleanup failed (e.g. the file was already gone).
 */
export async function safeUnlink(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return;

  try {
    await fsp.unlink(filePath);
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return;
    }
    console.error('[safeUnlink] failed to remove file', filePath, error);
  }
}

/** Synchronous variant kept for backwards compatibility with older callers. */
export function safeUnlinkSync(filePath: string | null | undefined): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.error('[safeUnlink] failed to remove file', filePath, error);
  }
}
