import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { PUBLIC_VAPID_KEY } from '../config/webpush.js';

const router = Router();

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// GET /api/notifications/vapidPublicKey — public, no auth required
router.get('/vapidPublicKey', (_req: Request, res: Response) => {
  if (!PUBLIC_VAPID_KEY) {
    return res.status(503).json({
      status: 'error',
      message: 'Push notifications are not configured on this server.',
    });
  }

  res.json({ status: 'success', data: { key: PUBLIC_VAPID_KEY } });
});

// All remaining routes require authentication
router.use(requireAuth);

// POST /api/notifications/subscribe
router.post('/subscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint, keys } = subscribeSchema.parse(req.body);

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: req.user!.id,
      },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: req.user!.id,
      },
    });

    res.status(201).json({ status: 'success', message: 'Subscription saved.' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/unsubscribe
router.delete('/unsubscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.user!.id },
    });

    res.json({ status: 'success', message: 'Subscription removed.' });
  } catch (error) {
    next(error);
  }
});

export default router;
