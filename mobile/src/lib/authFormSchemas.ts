import { z } from 'zod';
import { registerSchema } from '@mlm/shared';

/**
 * Formularz rejestracji: najpierw pola tekstowe (`name` zawsze string),
 * potem normalizacja pustego imienia i walidacja współdzielonym `registerSchema`.
 */
export const registerFormSchema = z
  .object({
    email: registerSchema.shape.email,
    password: registerSchema.shape.password,
    name: z.string(),
  })
  .transform((data) => ({
    email: data.email,
    password: data.password,
    name: data.name.trim() === '' ? undefined : data.name.trim(),
  }))
  .pipe(registerSchema);
