import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

/** Validates `req.body` against the schema and replaces `req.body` with the parsed value. */
export const validateRequest = (schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
};
