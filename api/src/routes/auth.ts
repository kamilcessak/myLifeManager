import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { changePasswordSchema } from '@mlm/shared';
import { prisma } from '../config/database.js';
import { requireAuth, AuthenticatedUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { safeUnlink } from '../utils/safeUnlink.js';
import { deleteUserAccount, exportUserData } from '../controllers/authController.js';

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
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET || 'default-secret', {
    expiresIn,
  } as jwt.SignOptions);
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

// GET /api/auth/export - Export personal data (GDPR / RODO)
router.get('/export', requireAuth, exportUserData);

// DELETE /api/auth/me - Permanently delete current account
router.delete('/me', requireAuth, deleteUserAccount);

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

// PATCH /api/auth/password - Change current user's password
router.patch(
  '/password',
  requireAuth,
  validateRequest(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
      });

      if (!user) {
        throw new ApiError('Użytkownik nie istnieje', 404);
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentValid) {
        throw new ApiError('Nieprawidłowe obecne hasło', 400);
      }

      const isSameAsOld = await bcrypt.compare(newPassword, user.password);
      if (isSameAsOld) {
        throw new ApiError('Nowe hasło musi różnić się od obecnego', 400);
      }

      const newHashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: userId },
        data: { password: newHashedPassword },
      });

      res.status(200).json({
        status: 'success',
        message: 'Hasło zostało zmienione',
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Avatar upload (POST /api/auth/avatar)
// ---------------------------------------------------------------------------

const uploadsRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userDir = path.join(uploadsRoot, req.user!.id);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    // Crop pipeline sends JPEG blobs, but accept original extension as fallback.
    const ext = path.extname(file.originalname) || (file.mimetype === 'image/png' ? '.png' : '.jpg');
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_AVATAR_SIZE || '5242880', 10), // 5 MB default
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AVATAR_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError('Nieprawidłowy typ pliku. Dozwolone: JPEG, PNG, WebP.', 400));
    }
  },
});

const buildAvatarUrl = (userId: string, filename: string): string => {
  const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${baseUrl}/uploads/${userId}/${filename}`;
};

/**
 * Extract the local filesystem path from a stored avatarUrl, if it is a locally
 * hosted file (served from `/uploads/...`). Returns null for external URLs so
 * they are never deleted.
 */
const resolveLocalAvatarPath = (avatarUrl: string | null | undefined): string | null => {
  if (!avatarUrl) return null;

  let pathname: string;
  try {
    pathname = new URL(avatarUrl).pathname;
  } catch {
    pathname = avatarUrl;
  }

  const marker = '/uploads/';
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;

  const relative = pathname.slice(idx + marker.length);
  if (!relative) return null;

  return path.join(uploadsRoot, relative);
};

// POST /api/auth/avatar - Upload & replace the current user's avatar
router.post(
  '/avatar',
  requireAuth,
  avatarUpload.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    const uploadedFilePath = req.file ? path.join(req.file.destination, req.file.filename) : null;

    try {
      if (!req.file) {
        throw new ApiError('Nie przesłano pliku', 400);
      }

      const userId = req.user!.id;

      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });

      const newAvatarUrl = buildAvatarUrl(userId, req.file.filename);

      const user = await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: newAvatarUrl },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
        },
      });

      // Best-effort cleanup of the previous avatar file. Do not block the response
      // if the old file is already gone or unlink fails for any reason.
      const oldLocalPath = resolveLocalAvatarPath(existing?.avatarUrl);
      if (oldLocalPath && oldLocalPath !== uploadedFilePath) {
        void safeUnlink(oldLocalPath);
      }

      res.status(200).json({
        status: 'success',
        data: {
          user,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      // Rollback: remove the freshly uploaded file on any DB/validation failure.
      if (uploadedFilePath) {
        void safeUnlink(uploadedFilePath);
      }
      next(error);
    }
  },
);

export default router;
