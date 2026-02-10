import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth, AuthenticatedUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Helper to generate JWT
const generateToken = (userId: string): string => {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper to create default categories for new user
const createDefaultCategories = async (userId: string): Promise<void> => {
  await prisma.category.createMany({
    data: [
      { userId, name: 'Dom', color: '#10B981', icon: 'home', isDefault: true, order: 0 },
      { userId, name: 'Firma', color: '#3B82F6', icon: 'briefcase', isDefault: true, order: 1 },
    ],
  });
};

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ApiError('User with this email already exists', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Create default categories
    await createDefaultCategories(user.id);

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      status: 'success',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    loginSchema.parse(req.body);

    passport.authenticate('local', { session: false }, (err: Error | null, user: AuthenticatedUser | false, info: { message: string }) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: info?.message || 'Invalid credentials',
        });
      }

      const token = generateToken(user.id);

      res.json({
        status: 'success',
        data: {
          user,
          token,
        },
      });
    })(req, res, next);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

// PATCH /api/auth/me - Update current user
router.patch('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(2).optional(),
      avatarUrl: z.string().url().optional(),
    });

    const data = updateSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    res.json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
