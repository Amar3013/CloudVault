import File from '../models/File.js';
import Folder from '../models/Folder.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import fs from 'fs';
import formidable from 'formidable';
import { v4 as uuidv4 } from 'uuid';
import {
  validateFileMetadata,
  createPresignedUploadPost,
  uploadObject,
  headObject,
  createDownloadUrl,
  deleteObject,
} from '../services/s3Service.js';

const QUOTA = parseInt(process.env.STORAGE_QUOTA) || 1024 * 1024 * 1024;
const PAGE_SIZE = 50;

export async function getFiles(req, res, next) {
  try {
    const { folderId, search, sortBy = 'createdAt', sortDir = 'desc', page = 1, deleted } = req.query;
    const isTrash = deleted === 'true';
    const query = {
      ownerId: req.userId,
      status: 'active',
      isDeleted: isTrash,
    };
    if (folderId) query.folderId = folderId === '' ? null : new mongoose.Types.ObjectId(folderId);
    else if (folderId === '') query.folderId = null;
    if (search) query.originalName = { $regex: search, $options: 'i' };

    const validSortFields = ['createdAt', 'originalName', 'size'];
    const sort = { [validSortFields.includes(sortBy) ? sortBy : 'createdAt']: sortDir === 'asc' ? 1 : -1 };
    
    const skip = (parseInt(page) - 1) * PAGE_SIZE;
    const [files, total] = await Promise.all([
      File.find(query).sort(sort).skip(skip).limit(PAGE_SIZE).lean(),
      File.countDocuments(query),
    ]);
    
    res.json({ files, total, page: parseInt(page), pageSize: PAGE_SIZE });
  } catch (err) { next(err); }
}

export async function getStarredFiles(req, res, next) {
  try {
    const files = await File.find({ ownerId: req.userId, isStarred: true, status: 'active', isDeleted: false }).sort({ updatedAt: -1 }).lean();
    res.json({ files });
  } catch (err) { next(err); }
}

export async function getRecentFiles(req, res, next) {
  try {
    const files = await File.find({ ownerId: req.userId, status: 'active', isDeleted: false }).sort({ createdAt: -1 }).limit(10).lean();
    res.json({ files });
  } catch (err) { next(err); }
}

export async function getTrashFiles(req, res, next) {
  try {
    const files = await File.find({ ownerId: req.userId, isDeleted: true, status: 'active' }).sort({ deletedAt: -1 }).lean();
    res.json({ files });
  } catch (err) { next(err); }
}

export async function requestUploadUrl(req, res, next) {
  try {
    const { filename, mimeType, size, folderId } = req.validatedBody;
    
    // Validate file metadata
    validateFileMetadata(filename, mimeType, size);
    
    // Validate folder ownership if specified
    if (folderId) {
      const folder = await Folder.findOne({ _id: folderId, ownerId: req.userId });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });
    }

    // Check quota (including pending uploads)
    const user = await User.findById(req.userId);
    const userObjectId = mongoose.Types.ObjectId.isValid(req.userId)
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;
    const pendingSize = await File.aggregate([
      { $match: { ownerId: userObjectId, status: 'pending', createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } } },
      { $group: { _id: null, total: { $sum: '$size' } } }
    ]);
    const pendingBytes = pendingSize[0]?.total || 0;
    const currentUsed = (user && user.storageUsed) || 0;
    
    if (currentUsed + pendingBytes + size > QUOTA) {
      return res.status(413).json({ error: 'Storage quota exceeded. Please delete some files.' });
    }

    const { url, fields, objectKey } = await createPresignedUploadPost(req.userId, filename, mimeType, size);
    
    // Create a pending file record
    const file = await File.create({
      ownerId: req.userId,
      originalName: filename,
      objectKey,
      mimeType,
      size,
      folderId: folderId || null,
      status: 'pending',
    });

    res.json({ uploadData: { url, fields }, fileId: file._id });
  } catch (err) { next(err); }
}

export async function confirmUpload(req, res, next) {
  try {
    const { fileId } = req.validatedBody;
    
    const file = await File.findOne({ _id: fileId, ownerId: req.userId, status: 'pending' });
    if (!file) return res.status(404).json({ error: 'Upload record not found' });

    // Verify the object exists in S3
    let headData;
    try {
      headData = await headObject(file.objectKey);
    } catch (err) {
      await File.deleteOne({ _id: file._id });
      return res.status(400).json({ error: 'File was not uploaded to S3. Please try again.' });
    }

    const actualSize = headData.ContentLength;
    
    // Activate file and update storage
    await File.updateOne({ _id: file._id }, { status: 'active', size: actualSize });
    await User.updateOne({ _id: req.userId }, { $inc: { storageUsed: actualSize } });
    
    const query = File.findById ? File.findById(file._id) : File.findOne({ _id: file._id });
    const updatedFile = typeof query.lean === 'function' ? await query.lean() : await query;
    console.log('[UPLOAD] Confirmed:', file.originalName, actualSize, 'bytes');
    
    res.json({ file: updatedFile });
  } catch (err) { next(err); }
}

export async function directUploadFile(req, res, next) {
  try {
    const form = formidable({
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 25 * 1024 * 1024,
      keepExtensions: true,
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        if (err.code === 1009 || err.message?.includes('maxFileSize')) {
          return res.status(413).json({ error: 'File exceeds maximum size of 25 MB' });
        }
        return next(err);
      }

      let fileObj;
      try {
        fileObj = Array.isArray(files.file) ? files.file[0] : files.file;
        if (!fileObj) {
          return res.status(400).json({ error: 'No file provided' });
        }

        const filename = fileObj.originalFilename || fileObj.newFilename || 'upload';
        const mimeType = fileObj.mimetype || 'application/octet-stream';
        const size = fileObj.size;
        const folderId = Array.isArray(fields.folderId) ? fields.folderId[0] : fields.folderId;

        validateFileMetadata(filename, mimeType, size);

        if (folderId) {
          const folder = await Folder.findOne({ _id: folderId, ownerId: req.userId });
          if (!folder) return res.status(404).json({ error: 'Folder not found' });
        }

        const user = await User.findById(req.userId);
        const currentUsed = (user && user.storageUsed) || 0;
        if (currentUsed + size > QUOTA) {
          return res.status(413).json({ error: 'Storage quota exceeded. Please delete some files.' });
        }

        const objectKey = `users/${req.userId}/${uuidv4()}`;
        const fileBuffer = fs.readFileSync(fileObj.filepath);

        await uploadObject({
          objectKey,
          body: fileBuffer,
          mimeType,
        });

        try { fs.unlinkSync(fileObj.filepath); } catch {}

        const created = await File.create({
          ownerId: req.userId,
          originalName: filename,
          objectKey,
          mimeType,
          size,
          folderId: folderId || null,
          status: 'active',
        });

        await User.updateOne({ _id: req.userId }, { $inc: { storageUsed: size } });
        console.log('[UPLOAD] Direct upload confirmed:', filename, size, 'bytes');

        const query = File.findById ? File.findById(created._id) : File.findOne({ _id: created._id });
        const resultFile = typeof query.lean === 'function' ? await query.lean() : await query;

        res.status(201).json({ file: resultFile });
      } catch (innerErr) {
        if (fileObj?.filepath) {
          try { fs.unlinkSync(fileObj.filepath); } catch {}
        }
        next(innerErr);
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function downloadFile(req, res, next) {
  try {
    const file = await File.findOne({ _id: req.params.id, ownerId: req.userId, status: 'active', isDeleted: false });
    if (!file) return res.status(404).json({ error: 'File not found' });
    
    const url = await createDownloadUrl(file.objectKey, file.originalName);
    res.json({ url });
  } catch (err) { next(err); }
}

export async function updateFile(req, res, next) {
  try {
    const { originalName, isStarred } = req.body;
    const update = {};
    if (originalName !== undefined) update.originalName = originalName.trim();
    if (isStarred !== undefined) update.isStarred = Boolean(isStarred);
    
    const file = await File.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.userId, status: 'active', isDeleted: false },
      update,
      { new: true }
    );
    if (!file) return res.status(404).json({ error: 'File not found' });
    
    res.json({ file });
  } catch (err) { next(err); }
}

export async function softDeleteFile(req, res, next) {
  try {
    const file = await File.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.userId, status: 'active', isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!file) return res.status(404).json({ error: 'File not found' });
    
    res.json({ message: 'File moved to trash' });
  } catch (err) { next(err); }
}

export async function restoreFile(req, res, next) {
  try {
    const file = await File.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.userId, isDeleted: true },
      { isDeleted: false, deletedAt: null },
      { new: true }
    );
    if (!file) return res.status(404).json({ error: 'File not found in trash' });
    
    res.json({ file });
  } catch (err) { next(err); }
}

export async function permanentDeleteFile(req, res, next) {
  try {
    const file = await File.findOne({ _id: req.params.id, ownerId: req.userId, isDeleted: true });
    if (!file) return res.status(404).json({ error: 'File not found in trash' });

    // Delete from S3
    try { await deleteObject(file.objectKey); } catch (err) {
      console.error('[S3] Delete failed:', err.message);
    }
    
    await File.deleteOne({ _id: file._id });
    await User.updateOne({ _id: req.userId }, { $inc: { storageUsed: -file.size } });
    
    console.log('[DELETE] Permanently deleted:', file.originalName);
    res.json({ message: 'File permanently deleted' });
  } catch (err) { next(err); }
}
