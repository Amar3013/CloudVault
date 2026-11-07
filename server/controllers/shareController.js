import crypto from 'crypto';
import ShareLink from '../models/ShareLink.js';
import File from '../models/File.js';
import { createDownloadUrl } from '../services/s3Service.js';

const EXPIRY_MAP = { '1h': 3600, '24h': 86400, '7d': 604800 };

export async function createShare(req, res, next) {
  try {
    const { expiresIn = '24h' } = req.body;
    const seconds = EXPIRY_MAP[expiresIn];
    if (!seconds) return res.status(400).json({ error: 'Invalid expiry. Use 1h, 24h, or 7d.' });

    const file = await File.findOne({ _id: req.params.id, ownerId: req.userId, status: 'active', isDeleted: false });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const shareLink = await ShareLink.create({
      fileId: file._id,
      ownerId: req.userId,
      token: rawToken,
      tokenHash,
      expiresAt: new Date(Date.now() + seconds * 1000),
    });

    const origin = process.env.ALLOWED_ORIGINS?.split(',')[0] || 'http://localhost:5173';
    const shareUrl = `${origin}/share/${rawToken}`;

    res.json({ shareUrl, expiresAt: shareLink.expiresAt, shareId: shareLink._id });
  } catch (err) { next(err); }
}

export async function getSharedFile(req, res, next) {
  try {
    const { token } = req.params;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const share = await ShareLink.findOne({ tokenHash }).populate('fileId');

    if (!share || !share.fileId) {
      return res.status(404).json({ error: 'Share link not found or has expired' });
    }
    if (share.revokedAt) {
      return res.status(410).json({ error: 'This share link has been revoked by the owner' });
    }
    if (new Date() > share.expiresAt) {
      return res.status(410).json({ error: 'This share link has expired' });
    }

    const file = share.fileId;
    if (file.isDeleted || file.status !== 'active') {
      return res.status(404).json({ error: 'File is no longer available' });
    }

    const downloadUrl = await createDownloadUrl(file.objectKey, file.originalName);

    res.json({
      file: { name: file.originalName, size: file.size, mimeType: file.mimeType },
      downloadUrl,
      expiresAt: share.expiresAt,
    });
  } catch (err) { next(err); }
}

export async function getUserShares(req, res, next) {
  try {
    const shares = await ShareLink.find({
      ownerId: req.userId,
      revokedAt: null,
    }).populate('fileId', 'originalName mimeType size').sort({ createdAt: -1 }).lean();

    const result = shares
      .filter((s) => s.fileId)
      .map((s) => ({
        _id: s._id,
        file: s.fileId,
        token: s.token,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      }));

    res.json({ shares: result });
  } catch (err) { next(err); }
}

export async function revokeShare(req, res, next) {
  try {
    const share = await ShareLink.findOneAndUpdate(
      { _id: req.params.shareId, ownerId: req.userId, revokedAt: null },
      { revokedAt: new Date() },
      { new: true }
    );
    if (!share) return res.status(404).json({ error: 'Share link not found' });
    res.json({ message: 'Share link revoked successfully' });
  } catch (err) { next(err); }
}
