import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getFolders, createFolder, updateFolder, deleteFolder } from '../controllers/folderController.js';

const router = Router();
router.use(authenticate);

const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255).trim(),
  parentFolderId: z.string().optional().nullable(),
});

router.get('/', getFolders);
router.post('/', validate(createFolderSchema), createFolder);
router.patch('/:id', updateFolder);
router.delete('/:id', deleteFolder);

export default router;
