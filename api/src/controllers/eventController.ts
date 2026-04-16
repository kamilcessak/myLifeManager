import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RRule } from 'rrule';
import { prisma } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { verifyTeamAccess } from '../utils/teamAccess.js';
import { ensureCategoryMatchesWorkspace } from '../utils/categoryWorkspace.js';
import { getEventsQuerySchema } from 'shared';

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

const dateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format',
});

const eventsListQuerySchema = getEventsQuerySchema.extend({
  startDate: dateString,
  endDate: dateString,
});

const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
  startTime: dateString,
  endTime: dateString,
  isAllDay: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
  reminderMinutes: z.number().int().min(0).nullable().optional(),
});

const updateEventSchema = createEventSchema.partial();

async function findEventForUser(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  if (event.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: event.teamId, userId } },
    });
    return membership ? event : null;
  }
  if (event.userId !== userId || event.teamId !== null) {
    return null;
  }
  return event;
}

async function requireTeamAccessOr403(
  userId: string,
  teamId: string,
  res: Response,
): Promise<boolean> {
  try {
    await verifyTeamAccess(userId, teamId);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 403) {
      res.status(403).json({ status: 'error', message: err.message });
      return false;
    }
    throw err;
  }
}

export async function getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = eventsListQuerySchema.parse(req.query);
    const userId = req.user!.id;
    const { startDate, endDate, categoryId, teamId } = query;

    const start = new Date(startDate);
    const end = new Date(endDate);

    let workspaceWhere: { teamId: string } | { userId: string; teamId: null };
    if (teamId) {
      const allowed = await requireTeamAccessOr403(userId, teamId, res);
      if (!allowed) return;
      workspaceWhere = { teamId };
    } else {
      workspaceWhere = { userId, teamId: null };
    }

    const nonRecurringEvents = await prisma.event.findMany({
      where: {
        ...workspaceWhere,
        recurrenceRule: null,
        OR: [
          { startTime: { gte: start, lte: end } },
          { endTime: { gte: start, lte: end } },
          {
            AND: [{ startTime: { lte: start } }, { endTime: { gte: end } }],
          },
        ],
        ...(categoryId ? { categoryId } : {}),
      },
      include: eventCategoryInclude,
    });

    const recurringEvents = await prisma.event.findMany({
      where: {
        ...workspaceWhere,
        recurrenceRule: { not: null },
        ...(categoryId ? { categoryId } : {}),
      },
      include: eventCategoryInclude,
    });

    const expandedRecurringEvents = recurringEvents.flatMap((event) => {
      if (!event.recurrenceRule) return [];

      try {
        const rule = RRule.fromString(event.recurrenceRule);
        const duration = event.endTime.getTime() - event.startTime.getTime();
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
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    res.json({ status: 'success', data: { events: allEvents } });
  } catch (error) {
    next(error);
  }
}

export async function getEventById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = await findEventForUser(req.params.id, req.user!.id);

    if (!event) {
      throw new ApiError('Event not found', 404);
    }

    const full = await prisma.event.findFirst({
      where: { id: event.id },
      include: {
        category: true,
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json({ status: 'success', data: { event: full } });
  } catch (error) {
    next(error);
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createEventSchema.parse(req.body);
    const userId = req.user!.id;
    const workspaceTeamId = data.teamId ?? null;

    if (workspaceTeamId) {
      try {
        await verifyTeamAccess(userId, workspaceTeamId);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 403) {
          res.status(403).json({ status: 'error', message: err.message });
          return;
        }
        throw err;
      }
    }

    if (data.recurrenceRule) {
      try {
        RRule.fromString(data.recurrenceRule);
      } catch {
        throw new ApiError('Invalid recurrence rule format', 400);
      }
    }

    if (data.categoryId) {
      await ensureCategoryMatchesWorkspace(userId, data.categoryId, workspaceTeamId);
    }

    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        categoryId: data.categoryId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        isAllDay: data.isAllDay,
        recurrenceRule: data.recurrenceRule,
        userId,
        teamId: workspaceTeamId,
        reminderMinutes: data.reminderMinutes ?? null,
        reminderSent: false,
      },
      include: eventCategoryInclude,
    });

    res.status(201).json({ status: 'success', data: { event } });
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateEventSchema.parse(req.body);
    const userId = req.user!.id;

    const existingEvent = await findEventForUser(req.params.id, userId);

    if (!existingEvent) {
      throw new ApiError('Event not found', 404);
    }

    const nextTeamId =
      data.teamId !== undefined ? data.teamId ?? null : existingEvent.teamId ?? null;

    if (data.teamId !== undefined && data.teamId) {
      try {
        await verifyTeamAccess(userId, data.teamId);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 403) {
          res.status(403).json({ status: 'error', message: err.message });
          return;
        }
        throw err;
      }
    }

    if (data.recurrenceRule) {
      try {
        RRule.fromString(data.recurrenceRule);
      } catch {
        throw new ApiError('Invalid recurrence rule format', 400);
      }
    }

    const categoryToValidate = data.categoryId ?? existingEvent.categoryId;
    if (
      categoryToValidate &&
      (data.categoryId !== undefined || data.teamId !== undefined)
    ) {
      await ensureCategoryMatchesWorkspace(userId, categoryToValidate, nextTeamId);
    }

    const shouldResetReminder =
      data.reminderMinutes !== undefined || data.startTime !== undefined;

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...data,
        teamId: data.teamId !== undefined ? data.teamId ?? null : undefined,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        reminderMinutes:
          data.reminderMinutes !== undefined ? (data.reminderMinutes ?? null) : undefined,
        ...(shouldResetReminder ? { reminderSent: false } : {}),
      },
      include: eventCategoryInclude,
    });

    res.json({ status: 'success', data: { event } });
  } catch (error) {
    next(error);
  }
}

export async function deleteEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const event = await findEventForUser(req.params.id, userId);

    if (!event) {
      throw new ApiError('Event not found', 404);
    }

    await prisma.event.delete({
      where: { id: req.params.id },
    });

    res.json({ status: 'success', message: 'Event deleted' });
  } catch (error) {
    next(error);
  }
}
