import axios from 'axios';

const FALLBACK_MESSAGE =
  'Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie później.';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (Array.isArray(value)) {
    const parts = value
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim());
    if (parts.length === 0) return null;
    return parts.join('; ');
  }
  return null;
}

/** Backend Zod handler: `{ errors: [{ field, message }] }` */
function formatValidationErrors(errors: unknown): string | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;

  const parts: string[] = [];
  for (const item of errors) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t) parts.push(t);
      continue;
    }
    if (!isPlainObject(item)) continue;

    const msg = typeof item.message === 'string' ? item.message.trim() : '';
    if (!msg) continue;

    const field =
      (typeof item.field === 'string' && item.field.trim()) ||
      (Array.isArray(item.path)
        ? item.path
            .filter((p): p is string | number => typeof p === 'string' || typeof p === 'number')
            .join('.')
        : '');

    parts.push(field ? `${field}: ${msg}` : msg);
  }

  if (parts.length === 0) return null;
  return parts.join('; ');
}

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    if (typeof data === 'string') {
      const t = data.trim();
      if (t) return t;
    }

    if (isPlainObject(data)) {
      const fromIssues = formatValidationErrors(data.errors);
      if (fromIssues) return fromIssues;

      const fromMessage = normalizeMessage(data.message);
      if (fromMessage) return fromMessage;

      const fromErrorField = normalizeMessage(data.error);
      if (fromErrorField) return fromErrorField;

      if (isPlainObject(data.error)) {
        const nested = normalizeMessage(data.error.message);
        if (nested) return nested;
      }
    }

    if (!error.response && typeof error.message === 'string') {
      const t = error.message.trim();
      if (t) return t;
    }

    return FALLBACK_MESSAGE;
  }

  if (error instanceof Error) {
    const t = error.message.trim();
    if (t) return t;
  }

  return FALLBACK_MESSAGE;
};
