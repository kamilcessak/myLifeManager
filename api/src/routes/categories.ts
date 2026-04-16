import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as categoryController from '../controllers/categoryController.js';

const router = Router();

router.use(requireAuth);

router.get('/', categoryController.getCategories);
router.post('/', categoryController.createCategory);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

export default router;
