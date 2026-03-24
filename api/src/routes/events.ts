import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RRule } from 'rrule';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

const eventCategoryInclude = {
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
const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.string().optional(),
  startTime: dateString,
  endTime: dateString,
  isAllDay: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
});

const updateEventSchema = createEventSchema.partial();

// GET /api/events - List events in date range
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const querySchema = z.object({
      startDate: dateString,
      endDate: dateString,
      categoryId: z.string().optional(),
    });

    const { startDate, endDate, categoryId } = querySchema.parse(req.query);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch non-recurring events in range
    const nonRecurringEvents = await prisma.event.findMany({
      where: {
        userId: req.user!.id,
        recurrenceRule: null,
        OR: [
          {
            startTime: { gte: start, lte: end },
          },
          {
            endTime: { gte: start, lte: end },
          },
          {
            AND: [
              { startTime: { lte: start } },
              { endTime: { gte: end } },
            ],
          },
        ],
        ...(categoryId ? { categoryId } : {}),
      },
      include: eventCategoryInclude,
    });

    // Fetch recurring events and expand occurrences
    const recurringEvents = await prisma.event.findMany({
      where: {
        userId: req.user!.id,
        recurrenceRule: { not: null },
        ...(categoryId ? { categoryId } : {}),
      },
      include: eventCategoryInclude,
    });

    // Expand recurring events
    const expandedRecurringEvents = recurringEvents.flatMap((event) => {
      if (!event.recurrenceRule) return [];

      try {
        const rule = RRule.fromString(event.recurrenceRule);
        const duration = event.endTime.getTime() - event.startTime.getTime();
        
        // Get occurrences in date range
        const occurrences = rule.between(start, end, true);
        
        return occurrences.map((occurrence, index) => ({
          ...event,
          id: `${event.id}_${index}`,
          originalEventId: event.id,
          startTime: occurrence,
          endTime: new Date(occurrence.getTime() + duration),
          isRecurringInstance: true,
        }));
      } catch (e) {
        console.error('Error parsing RRULE:', e);
        return [];
      }
    });

    const allEvents = [...nonRecurringEvents, ...expandedRecurringEvents].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    res.json({
      status: 'success',
      data: { events: allEvents },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/events/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await prisma.event.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      include: {
        category: true,
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!event) {
      throw new ApiError('Event not found', 404);
    }

    res.json({
      status: 'success',
      data: { event },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/events - Create new event
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createEventSchema.parse(req.body);

    // Validate RRULE if provided
    if (data.recurrenceRule) {
      try {
        RRule.fromString(data.recurrenceRule);
      } catch (e) {
        throw new ApiError('Invalid recurrence rule format', 400);
      }
    }

    const event = await prisma.event.create({
      data: {
        ...data,
        userId: req.user!.id,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      },
      include: eventCategoryInclude,
    });

    res.status(201).json({
      status: 'success',
      data: { event },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/events/:id - Update event
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateEventSchema.parse(req.body);

    const existingEvent = await prisma.event.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!existingEvent) {
      throw new ApiError('Event not found', 404);
    }

    // Validate RRULE if provided
    if (data.recurrenceRule) {
      try {
        RRule.fromString(data.recurrenceRule);
      } catch (e) {
        throw new ApiError('Invalid recurrence rule format', 400);
      }
    }

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
      },
      include: eventCategoryInclude,
    });

    res.json({
      status: 'success',
      data: { event },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/events/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await prisma.event.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!event) {
      throw new ApiError('Event not found', 404);
    }

    await prisma.event.delete({
      where: { id: req.params.id },
    });

    res.json({
      status: 'success',
      message: 'Event deleted',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
