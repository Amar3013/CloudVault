import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { getSharedFile, getUserShares, revokeShare } from '../controllers/shareController.js';

const router = Router();

const shareLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please wait a moment.' },
});

router.get('/', authenticate, getUserShares);
router.get('/:token', shareLimiter, getSharedFile);
router.delete('/:shareId', authenticate, revokeShare);

export default router;
