import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { verifyTeamAccess } from '../utils/teamAccess.js';
import {
  createCategorySchema,
  getCategoriesQuerySchema,
  updateCategorySchema,
} from '@mlm/shared';

async function findCategoryForUser(categoryId: string, userId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return null;
  if (category.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: category.teamId, userId } },
    });
    return membership ? category : null;
  }
  if (category.userId !== userId || category.teamId !== null) {
    return null;
  }
  return category;
}

export async function getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { teamId } = getCategoriesQuerySchema.parse(req.query);
    const userId = req.user!.id;

    if (teamId) {
      try {
        await verifyTeamAccess(userId, teamId);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 403) {
          res.status(403).json({ status: 'error', message: err.message });
          return;
        }
        throw err;
      }

      const categories = await prisma.category.findMany({
        where: { teamId },
        orderBy: { order: 'asc' },
      });

      res.json({ status: 'success', data: { categories } });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { userId, teamId: null },
      orderBy: { order: 'asc' },
    });

    res.json({ status: 'success', data: { categories } });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createCategorySchema.parse(req.body);
    const userId = req.user!.id;
    const teamId = data.teamId ?? null;

    if (teamId) {
      try {
        await verifyTeamAccess(userId, teamId);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 403) {
          res.status(403).json({ status: 'error', message: err.message });
          return;
        }
        throw err;
      }
    }

    const maxOrder = await prisma.category.aggregate({
      where: teamId ? { teamId } : { userId, teamId: null },
      _max: { order: true },
    });

    const category = await prisma.category.create({
      data: {
        name: data.name,
        color: data.color,
        icon: data.icon,
        userId,
        teamId: teamId || null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    res.status(201).json({ status: 'success', data: { category } });
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { teamId: _bodyTeamId, ...data } = updateCategorySchema.parse(req.body);
    const userId = req.user!.id;

    const existingCategory = await findCategoryForUser(req.params.id, userId);

    if (!existingCategory) {
      throw new ApiError('Category not found', 404);
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ status: 'success', data: { category } });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const category = await findCategoryForUser(req.params.id, userId);

    if (!category) {
      throw new ApiError('Category not found', 404);
    }

    if (category.isDefault) {
      throw new ApiError('Cannot delete default categories', 400);
    }

    await prisma.category.delete({
      where: { id: req.params.id },
    });

    res.json({ status: 'success', message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
}
