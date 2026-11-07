import File from '../models/File.js';
import User from '../models/User.js';

const QUOTA = parseInt(process.env.STORAGE_QUOTA) || 1024 * 1024 * 1024; // 1 GB

export async function getDashboard(req, res, next) {
  try {
    const [user, totalFiles, recentFiles] = await Promise.all([
      User.findById(req.userId).select('storageUsed name email').lean(),
      File.countDocuments({ ownerId: req.userId, status: 'active', isDeleted: false }),
      File.find({ ownerId: req.userId, status: 'active', isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const used = user?.storageUsed || 0;

    res.json({
      totalFiles,
      recentFiles,
      storage: {
        used,
        quota: QUOTA,
        available: Math.max(0, QUOTA - used),
      },
    });
  } catch (err) { next(err); }
}

export async function getStorage(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('storageUsed').lean();
    const used = user?.storageUsed || 0;
    res.json({
      used,
      quota: QUOTA,
      available: Math.max(0, QUOTA - used),
    });
  } catch (err) { next(err); }
}
