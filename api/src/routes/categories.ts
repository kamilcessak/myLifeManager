import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  icon: z.string().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

// GET /api/categories - List all categories
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        userId: req.user!.id,
      },
      orderBy: { order: 'asc' },
    });

    res.json({
      status: 'success',
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/categories - Create new category
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createCategorySchema.parse(req.body);

    // Get max order
    const maxOrder = await prisma.category.aggregate({
      where: { userId: req.user!.id },
      _max: { order: true },
    });

    const category = await prisma.category.create({
      data: {
        ...data,
        userId: req.user!.id,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/categories/:id - Update category
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateCategorySchema.parse(req.body);

    const existingCategory = await prisma.category.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!existingCategory) {
      throw new ApiError('Category not found', 404);
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      status: 'success',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await prisma.category.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!category) {
      throw new ApiError('Category not found', 404);
    }

    if (category.isDefault) {
      throw new ApiError('Cannot delete default categories', 400);
    }

    await prisma.category.delete({
      where: { id: req.params.id },
    });

    res.json({
      status: 'success',
      message: 'Category deleted',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
