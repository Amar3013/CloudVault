import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getFiles,
  getStarredFiles,
  getRecentFiles,
  getTrashFiles,
  requestUploadUrl,
  confirmUpload,
  directUploadFile,
  downloadFile,
  updateFile,
  softDeleteFile,
  restoreFile,
  permanentDeleteFile,
} from '../controllers/fileController.js';
import { createShare } from '../controllers/shareController.js';

const router = Router();
router.use(authenticate);

const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  folderId: z.string().optional().nullable(),
});

const confirmSchema = z.object({
  fileId: z.string().min(1),
});

const shareSchema = z.object({
  expiresIn: z.enum(['1h', '24h', '7d']).default('24h'),
});

router.get('/', getFiles);
router.get('/starred', getStarredFiles);
router.get('/recent', getRecentFiles);
router.get('/trash', getTrashFiles);
router.post('/upload-url', validate(uploadUrlSchema), requestUploadUrl);
router.post('/confirm', validate(confirmSchema), confirmUpload);
router.post('/upload', directUploadFile);
router.get('/:id/download', downloadFile);
router.patch('/:id', updateFile);
router.delete('/:id', softDeleteFile);
router.post('/:id/restore', restoreFile);
router.delete('/:id/permanent', permanentDeleteFile);
router.post('/:id/share', validate(shareSchema), createShare);

export default router;
