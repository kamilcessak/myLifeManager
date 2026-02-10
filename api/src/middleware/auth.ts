import { Request, Response, NextFunction } from 'express';
import passport from 'passport';

// Type for authenticated user
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

// Extend Express Request
declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

// Middleware to protect routes
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate('jwt', { session: false }, (err: Error | null, user: AuthenticatedUser | false) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized - Please login',
      });
    }
    req.user = user;
    next();
  })(req, res, next);
};

// Optional auth - attaches user if token is valid, but doesn't require it
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate('jwt', { session: false }, (err: Error | null, user: AuthenticatedUser | false) => {
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
};
