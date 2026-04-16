import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { verifyTeamAccess } from '../utils/teamAccess.js';
import { ensureCategoryMatchesWorkspace } from '../utils/categoryWorkspace.js';
import { taskQuerySchema } from 'shared';

const taskInclude = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      email: true,
    },
  },
  attachments: {
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

const dateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format',
});

const listTasksQuerySchema = taskQuerySchema.extend({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
  assigneeId: z.string().cuid('Invalid assignee id').nullable().optional(),
  priority: z.number().min(1).max(4).default(2),
  deadline: dateString.optional(),
  scheduledStart: dateString.optional(),
  scheduledEnd: dateString.optional(),
  scheduledAllDay: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  imageUrl: z.string().url().optional(),
  reminderMinutes: z.number().int().min(0).nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
  assigneeId: z.string().cuid('Invalid assignee id').nullable().optional(),
  priority: z.number().min(1).max(4).optional(),
  deadline: dateString.nullable().optional(),
  scheduledStart: dateString.nullable().optional(),
  scheduledEnd: dateString.nullable().optional(),
  scheduledAllDay: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isCompleted: z.boolean().optional(),
  reminderMinutes: z.number().int().min(0).nullable().optional(),
});

const inboxQuerySchema = z.object({
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
  assigneeId: z.string().optional(),
});

async function findTaskForUser(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return null;
  if (task.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: task.teamId, userId } },
    });
    return membership ? task : null;
  }
  if (task.userId !== userId || task.teamId !== null) {
    return null;
  }
  return task;
}

/**
 * Validates that the given assigneeId can legally own a task in the given workspace.
 *
 * Rules:
 * - Personal task (teamId === null):
 *     the assignee MUST be the acting user. Any other id is rejected with 403.
 * - Team task (teamId !== null):
 *     the assignee MUST have an active TeamMember record for that team.
 *
 * Returns the value that should be persisted on the Task row
 * (either the validated assigneeId or null).
 */
async function resolveAssigneeId(
  requestedAssigneeId: string | null | undefined,
  teamId: string | null,
  actingUserId: string,
): Promise<string | null | undefined> {
  if (requestedAssigneeId === undefined) {
    return undefined;
  }

  if (requestedAssigneeId === null) {
    return null;
  }

  if (teamId === null) {
    if (requestedAssigneeId !== actingUserId) {
      throw new ApiError('Personal tasks can only be assigned to yourself', 403);
    }
    return requestedAssigneeId;
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: requestedAssigneeId } },
    select: { id: true },
  });

  if (!membership) {
    throw new ApiError('Assignee is not a member of this team', 400);
  }

  return requestedAssigneeId;
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

export async function getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listTasksQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const where: Record<string, unknown> = {};

    if (query.teamId) {
      const allowed = await requireTeamAccessOr403(userId, query.teamId, res);
      if (!allowed) return;
      Object.assign(where, { teamId: query.teamId });
    } else {
      Object.assign(where, { userId, teamId: null });
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }

    if (query.isCompleted !== undefined) {
      where.isCompleted = query.isCompleted === 'true';
    }

    if (query.scheduled === 'true') {
      if (query.startDate && query.endDate) {
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
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ status: 'success', data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function getInbox(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { categoryId, teamId, assigneeId } = inboxQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const baseWhere: Record<string, unknown> = {
      OR: [
        { isCompleted: false },
        {
          isCompleted: true,
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      ],
      ...(categoryId ? { categoryId: String(categoryId) } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    };

    if (teamId) {
      const allowed = await requireTeamAccessOr403(userId, teamId, res);
      if (!allowed) return;
      Object.assign(baseWhere, { teamId });
    } else {
      Object.assign(baseWhere, { userId, teamId: null });
    }

    const tasks = await prisma.task.findMany({
      where: baseWhere,
      include: taskInclude,
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ status: 'success', data: { tasks } });
  } catch (error) {
    next(error);
  }
}

export async function getTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await findTaskForUser(req.params.id, req.user!.id);

    if (!task) {
      throw new ApiError('Task not found', 404);
    }

    const full = await prisma.task.findFirst({
      where: { id: task.id },
      include: {
        category: true,
        assignee: {
          select: { id: true, name: true, avatarUrl: true, email: true },
        },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json({ status: 'success', data: { task: full } });
  } catch (error) {
    next(error);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createTaskSchema.parse(req.body);
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

    if (data.categoryId) {
      await ensureCategoryMatchesWorkspace(userId, data.categoryId, workspaceTeamId);
    }

    // Default assignee policy:
    // - Personal workspace (teamId === null): default to the creator (userId)
    //   unless the payload explicitly set assigneeId (including null).
    // - Team workspace (teamId !== null): leave unassigned (null)
    //   unless the payload explicitly provided an assigneeId.
    const requestedAssigneeId =
      data.assigneeId === undefined
        ? workspaceTeamId === null
          ? userId
          : null
        : data.assigneeId;

    const resolvedAssigneeId = await resolveAssigneeId(
      requestedAssigneeId,
      workspaceTeamId,
      userId,
    );

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        priority: data.priority,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
        scheduledAllDay: data.scheduledAllDay ?? false,
        recurrenceRule: data.recurrenceRule,
        imageUrl: data.imageUrl,
        userId,
        teamId: workspaceTeamId,
        assigneeId: resolvedAssigneeId ?? null,
        reminderMinutes: data.reminderMinutes ?? null,
        reminderSent: false,
      },
      include: taskInclude,
    });

    res.status(201).json({ status: 'success', data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateTaskSchema.parse(req.body);
    const userId = req.user!.id;

    const existingTask = await findTaskForUser(req.params.id, userId);

    if (!existingTask) {
      throw new ApiError('Task not found', 404);
    }

    const nextTeamId =
      data.teamId !== undefined ? data.teamId ?? null : existingTask.teamId ?? null;

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

    const categoryToValidate = data.categoryId ?? existingTask.categoryId;
    if (
      categoryToValidate &&
      (data.categoryId !== undefined || data.teamId !== undefined)
    ) {
      await ensureCategoryMatchesWorkspace(userId, categoryToValidate, nextTeamId);
    }

    // Resolve assignee against the effective (post-update) workspace.
    // If the workspace itself changes and the caller didn't touch assigneeId,
    // we must re-validate the existing assignee against the new workspace,
    // nullifying it if it no longer belongs.
    const workspaceChanged =
      data.teamId !== undefined && (existingTask.teamId ?? null) !== nextTeamId;

    let resolvedAssigneeId: string | null | undefined;
    if (data.assigneeId !== undefined) {
      resolvedAssigneeId = await resolveAssigneeId(data.assigneeId, nextTeamId, userId);
    } else if (workspaceChanged && existingTask.assigneeId) {
      try {
        resolvedAssigneeId = await resolveAssigneeId(
          existingTask.assigneeId,
          nextTeamId,
          userId,
        );
      } catch {
        resolvedAssigneeId = null;
      }
    } else {
      resolvedAssigneeId = undefined;
    }

    const shouldResetReminder =
      data.reminderMinutes !== undefined ||
      data.scheduledStart !== undefined ||
      data.deadline !== undefined;

    const { assigneeId: _ignoredAssigneeId, ...restData } = data;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...restData,
        teamId: data.teamId !== undefined ? data.teamId ?? null : undefined,
        assigneeId: resolvedAssigneeId,
        deadline: data.deadline ? new Date(data.deadline) : data.deadline === null ? null : undefined,
        scheduledStart: data.scheduledStart
          ? new Date(data.scheduledStart)
          : data.scheduledStart === null
            ? null
            : undefined,
        scheduledEnd: data.scheduledEnd
          ? new Date(data.scheduledEnd)
          : data.scheduledEnd === null
            ? null
            : undefined,
        scheduledAllDay: data.scheduledAllDay !== undefined ? data.scheduledAllDay : undefined,
        completedAt: data.isCompleted ? new Date() : data.isCompleted === false ? null : undefined,
        reminderMinutes: data.reminderMinutes !== undefined ? (data.reminderMinutes ?? null) : undefined,
        ...(shouldResetReminder ? { reminderSent: false } : {}),
      },
      include: taskInclude,
    });

    res.json({ status: 'success', data: { task } });
  } catch (error) {
    next(error);
  }
}

export async function scheduleTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const scheduleSchema = z.object({
      scheduledStart: z.string().datetime(),
      scheduledEnd: z.string().datetime(),
    });

    const { scheduledStart, scheduledEnd } = scheduleSchema.parse(req.body);
    const userId = req.user!.id;

    const task = await findTaskForUser(req.params.id, userId);

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

    res.json({ status: 'success', data: { task: updatedTask } });
  } catch (error) {
    next(error);
  }
}

export async function unscheduleTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const task = await findTaskForUser(req.params.id, userId);

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

    res.json({ status: 'success', data: { task: updatedTask } });
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const task = await findTaskForUser(req.params.id, userId);

    if (!task) {
      throw new ApiError('Task not found', 404);
    }

    await prisma.task.delete({
      where: { id: req.params.id },
    });

    res.json({ status: 'success', message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
}
