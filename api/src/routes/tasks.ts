import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

const taskInclude = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
    },
  },
  attachments: {
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

// All routes require authentication
router.use(requireAuth);

// Helper to validate date strings (accepts ISO format or datetime-local format)
const dateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format',
});

// Validation schemas
const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  priority: z.number().min(1).max(4).default(2),
  deadline: dateString.optional(),
  scheduledStart: dateString.optional(),
  scheduledEnd: dateString.optional(),
  scheduledAllDay: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  priority: z.number().min(1).max(4).optional(),
  deadline: dateString.nullable().optional(),
  scheduledStart: dateString.nullable().optional(),
  scheduledEnd: dateString.nullable().optional(),
  scheduledAllDay: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isCompleted: z.boolean().optional(),
});

const querySchema = z.object({
  categoryId: z.string().optional(),
  isCompleted: z.enum(['true', 'false']).optional(),
  scheduled: z.enum(['true', 'false']).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

// GET /api/tasks - List all tasks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = querySchema.parse(req.query);
    
    const where: any = {
      userId: req.user!.id,
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.isCompleted !== undefined) {
      where.isCompleted = query.isCompleted === 'true';
    }

    // Filter scheduled vs unscheduled (inbox)
    if (query.scheduled === 'true') {
      // Only tasks that have been scheduled (have scheduledStart)
      if (query.startDate && query.endDate) {
        // Filter by date range for scheduled tasks
        where.scheduledStart = {
          not: null,
          gte: new Date(query.startDate),
          lte: new Date(query.endDate),
        };
      } else {
        where.scheduledStart = { not: null };
      }
    } else if (query.scheduled === 'false') {
      where.scheduledStart = null;
    } else if (query.startDate && query.endDate) {
      // No scheduled filter - search by both scheduledStart and deadline
      where.OR = [
        {
          scheduledStart: {
            gte: new Date(query.startDate),
            lte: new Date(query.endDate),
          },
        },
        {
          deadline: {
            gte: new Date(query.startDate),
            lte: new Date(query.endDate),
          },
        },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [
        { priority: 'desc' },
        { deadline: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      status: 'success',
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/inbox - Get unscheduled tasks
router.get('/inbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId } = req.query;

    const tasks = await prisma.task.findMany({
      where: {
        userId: req.user!.id,
        // scheduledStart: null, // Show all tasks in inbox
        OR: [
          { isCompleted: false },
          { 
            isCompleted: true,
            updatedAt: { // Only show recently completed tasks (last 7 days)
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            }
          }
        ],
        ...(categoryId ? { categoryId: String(categoryId) } : {}),
      },
      include: taskInclude,
      orderBy: [
        { priority: 'desc' },
        { deadline: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      status: 'success',
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      include: {
        category: true,
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!task) {
      throw new ApiError('Task not found', 404);
    }

    res.json({
      status: 'success',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks - Create new task
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        ...data,
        userId: req.user!.id,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
        scheduledAllDay: data.scheduledAllDay ?? false,
      },
      include: taskInclude,
    });

    res.status(201).json({
      status: 'success',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id - Update task
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateTaskSchema.parse(req.body);

    // Check if task exists and belongs to user
    const existingTask = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!existingTask) {
      throw new ApiError('Task not found', 404);
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...data,
        deadline: data.deadline ? new Date(data.deadline) : data.deadline === null ? null : undefined,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : data.scheduledStart === null ? null : undefined,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : data.scheduledEnd === null ? null : undefined,
        scheduledAllDay: data.scheduledAllDay !== undefined ? data.scheduledAllDay : undefined,
        completedAt: data.isCompleted ? new Date() : data.isCompleted === false ? null : undefined,
      },
      include: taskInclude,
    });

    res.json({
      status: 'success',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id/schedule - Schedule task (drag & drop from inbox)
router.patch('/:id/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scheduleSchema = z.object({
      scheduledStart: z.string().datetime(),
      scheduledEnd: z.string().datetime(),
    });

    const { scheduledStart, scheduledEnd } = scheduleSchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!task) {
      throw new ApiError('Task not found', 404);
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        scheduledStart: new Date(scheduledStart),
        scheduledEnd: new Date(scheduledEnd),
      },
      include: taskInclude,
    });

    res.json({
      status: 'success',
      data: { task: updatedTask },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id/unschedule - Remove from calendar (back to inbox)
router.patch('/:id/unschedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!task) {
      throw new ApiError('Task not found', 404);
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        scheduledStart: null,
        scheduledEnd: null,
      },
      include: taskInclude,
    });

    res.json({
      status: 'success',
      data: { task: updatedTask },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!task) {
      throw new ApiError('Task not found', 404);
    }

    await prisma.task.delete({
      where: { id: req.params.id },
    });

    res.json({
      status: 'success',
      message: 'Task deleted',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
