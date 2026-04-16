import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as eventController from '../controllers/eventController.js';

const router = Router();

router.use(requireAuth);

router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEventById);
router.post('/', eventController.createEvent);
router.patch('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

export default router;
