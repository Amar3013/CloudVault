import Folder from '../models/Folder.js';
import File from '../models/File.js';

export async function getFolders(req, res, next) {
  try {
    const { parentFolderId } = req.query;
    const query = { ownerId: req.userId };
    if (parentFolderId !== undefined) {
      query.parentFolderId = parentFolderId === '' ? null : parentFolderId;
    }
    const folders = await Folder.find(query).sort({ name: 1 }).lean();
    res.json({ folders });
  } catch (err) { next(err); }
}

export async function createFolder(req, res, next) {
  try {
    const { name, parentFolderId } = req.validatedBody;
    
    if (parentFolderId) {
      const parent = await Folder.findOne({ _id: parentFolderId, ownerId: req.userId });
      if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
    }

    const folder = await Folder.create({
      ownerId: req.userId,
      name: name.trim(),
      parentFolderId: parentFolderId || null,
    });
    res.status(201).json({ folder });
  } catch (err) { next(err); }
}

export async function updateFolder(req, res, next) {
  try {
    const { name } = req.body;
    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.userId },
      { name: name.trim() },
      { new: true }
    );
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json({ folder });
  } catch (err) { next(err); }
}

export async function deleteFolder(req, res, next) {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    // Soft-delete files in folder
    await File.updateMany({ folderId: folder._id, ownerId: req.userId }, { isDeleted: true, deletedAt: new Date() });
    await Folder.deleteOne({ _id: folder._id });
    res.json({ message: 'Folder deleted' });
  } catch (err) { next(err); }
}
