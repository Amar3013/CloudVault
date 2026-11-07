import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getStorage } from '../controllers/dashboardController.js';

const router = Router();
router.use(authenticate);

router.get('/', getStorage);

export default router;
