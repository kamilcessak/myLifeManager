import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { attachmentsUpload } from '../config/multerAttachments.js';
import { verifyTeamAccess } from '../utils/teamAccess.js';

const router = Router();

router.use(requireAuth);

const uploadsDir = path.join(process.cwd(), 'uploads');

const safeUnlink = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error('[attachments] unlink', e);
  }
};

const assertResourceAccess = async (
  resource: { userId: string; teamId: string | null },
  currentUserId: string,
): Promise<void> => {
  if (resource.teamId === null) {
    if (resource.userId !== currentUserId) {
      throw new ApiError('Brak dostępu', 403);
    }
    return;
  }
  await verifyTeamAccess(currentUserId, resource.teamId);
};

router.post(
  '/upload',
  attachmentsUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const uploadedFilePath = req.file ? path.join(uploadsDir, req.file.filename) : null;

    try {
      if (!req.file) {
        throw new ApiError('Nie przesłano pliku', 400);
      }

      const taskId = typeof req.body.taskId === 'string' ? req.body.taskId.trim() : '';
      const eventId = typeof req.body.eventId === 'string' ? req.body.eventId.trim() : '';

      if (taskId && eventId) {
        throw new ApiError('Podaj albo taskId, albo eventId — nie oba naraz', 400);
      }
      if (!taskId && !eventId) {
        throw new ApiError('Podaj taskId lub eventId (najpierw utwórz zadanie lub wydarzenie)', 400);
      }

      const currentUserId = req.user!.id;

      if (taskId) {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          select: { userId: true, teamId: true },
        });
        if (!task) {
          throw new ApiError('Zadanie nie istnieje', 404);
        }
        await assertResourceAccess(task, currentUserId);
      }

      if (eventId) {
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: { userId: true, teamId: true },
        });
        if (!event) {
          throw new ApiError('Wydarzenie nie istnieje', 404);
        }
        await assertResourceAccess(event, currentUserId);
      }

      const publicUrl = `/uploads/${req.file.filename}`;

      const attachment = await prisma.attachment.create({
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: publicUrl,
          taskId: taskId || null,
          eventId: eventId || null,
        },
      });

      res.status(201).json({
        status: 'success',
        data: { attachment },
      });
    } catch (error) {
      if (uploadedFilePath) {
        safeUnlink(uploadedFilePath);
      }
      next(error);
    }
  },
);

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
      include: {
        task: { select: { userId: true, teamId: true } },
        event: { select: { userId: true, teamId: true } },
      },
    });

    if (!attachment) {
      throw new ApiError('Załącznik nie istnieje', 404);
    }

    const currentUserId = req.user!.id;

    if (attachment.taskId) {
      if (!attachment.task) {
        throw new ApiError('Zadanie nie istnieje', 404);
      }
      await assertResourceAccess(attachment.task, currentUserId);
    } else if (attachment.eventId) {
      if (!attachment.event) {
        throw new ApiError('Wydarzenie nie istnieje', 404);
      }
      await assertResourceAccess(attachment.event, currentUserId);
    } else if (attachment.userId !== currentUserId) {
      throw new ApiError('Brak dostępu', 403);
    }

    safeUnlink(path.join(uploadsDir, attachment.filename));

    await prisma.attachment.delete({ where: { id: attachment.id } });

    res.json({
      status: 'success',
      message: 'Załącznik usunięty',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
