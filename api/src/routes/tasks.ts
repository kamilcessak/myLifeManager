import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as taskController from '../controllers/taskController.js';

const router = Router();

router.use(requireAuth);

router.get('/inbox', taskController.getInbox);
router.get('/', taskController.getTasks);
router.get('/:id/activity', taskController.getTaskActivity);
router.get('/:id', taskController.getTaskById);
router.post('/', taskController.createTask);
router.patch('/:id/schedule', taskController.scheduleTask);
router.patch('/:id/unschedule', taskController.unscheduleTask);
router.patch('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

export default router;
