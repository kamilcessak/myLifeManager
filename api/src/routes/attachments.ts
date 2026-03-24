import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { attachmentsUpload } from '../config/multerAttachments.js';

const router = Router();

router.use(requireAuth);

const uploadsDir = path.join(process.cwd(), 'uploads');

router.post(
  '/upload',
  attachmentsUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
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

      if (taskId) {
        const task = await prisma.task.findFirst({
          where: { id: taskId, userId: req.user!.id },
        });
        if (!task) {
          throw new ApiError('Zadanie nie istnieje', 404);
        }
      }

      if (eventId) {
        const event = await prisma.event.findFirst({
          where: { id: eventId, userId: req.user!.id },
        });
        if (!event) {
          throw new ApiError('Wydarzenie nie istnieje', 404);
        }
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
      next(error);
    }
  },
);

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await prisma.attachment.findFirst({
      where: { id: req.params.id },
      include: {
        task: { select: { userId: true } },
        event: { select: { userId: true } },
      },
    });

    if (!attachment) {
      throw new ApiError('Załącznik nie istnieje', 404);
    }

    const uid = req.user!.id;
    if (attachment.taskId) {
      if (attachment.task?.userId !== uid) {
        throw new ApiError('Brak dostępu', 403);
      }
    } else if (attachment.eventId) {
      if (attachment.event?.userId !== uid) {
        throw new ApiError('Brak dostępu', 403);
      }
    } else if (attachment.userId !== uid) {
      throw new ApiError('Brak dostępu', 403);
    }

    const fp = path.join(uploadsDir, attachment.filename);
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      console.error('[attachments] unlink', e);
    }

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
