import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-key-at-least-64-characters-long-for-testing-purposes-cloudvault';
process.env.MONGODB_URI = 'mongodb://localhost/test';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.S3_REGION = 'us-east-1';
process.env.STORAGE_QUOTA = '104857600'; // 100 MB for test

// Mock S3 service
vi.mock('../services/s3Service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createPresignedUploadPost: vi.fn().mockResolvedValue({
      url: 'https://test-bucket.s3.amazonaws.com',
      fields: { key: 'users/user_1/mock-uuid', 'Content-Type': 'application/pdf' },
      objectKey: 'users/user_1/mock-uuid',
    }),
    headObject: vi.fn().mockResolvedValue({ ContentLength: 2048 }),
    createDownloadUrl: vi.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/users/user_1/mock-uuid?presigned=true'),
    deleteObject: vi.fn().mockResolvedValue({}),
  };
});

// Mock database connection
vi.mock('../config/database.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
  disconnectDB: vi.fn().mockResolvedValue(undefined),
}));

// In-memory data
const filesStore = new Map();
const foldersStore = new Map();
const usersStore = new Map();
let fileSeq = 1;

vi.mock('../models/User.js', () => ({
  default: {
    findById: vi.fn((id) => {
      const u = usersStore.get(id?.toString()) || { _id: id, storageUsed: 0 };
      return {
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(u),
        }),
        then: (resolve) => resolve(u),
      };
    }),
    updateOne: vi.fn((query, update) => {
      const id = query._id;
      const u = usersStore.get(id?.toString()) || { _id: id, storageUsed: 0 };
      if (update.$inc?.storageUsed) {
        u.storageUsed = (u.storageUsed || 0) + update.$inc.storageUsed;
      }
      usersStore.set(id?.toString(), u);
      return Promise.resolve({ modifiedCount: 1 });
    }),
  },
}));

vi.mock('../models/File.js', () => ({
  default: {
    create: vi.fn((data) => {
      const id = `file_${fileSeq++}`;
      const f = { _id: id, status: 'pending', isDeleted: false, isStarred: false, ...data };
      filesStore.set(id, f);
      return Promise.resolve(f);
    }),
    findById: vi.fn((id) => {
      const f = filesStore.get(id?.toString());
      return {
        lean: vi.fn().mockResolvedValue(f ? { ...f } : null),
        then: (resolve) => Promise.resolve(f ? { ...f } : null).then(resolve),
      };
    }),
    find: vi.fn((query) => {
      let results = [...filesStore.values()];
      if (query.ownerId) results = results.filter((f) => f.ownerId === query.ownerId);
      if (query.isDeleted !== undefined) results = results.filter((f) => f.isDeleted === query.isDeleted);
      if (query.isStarred !== undefined) results = results.filter((f) => f.isStarred === query.isStarred);
      if (query.status) results = results.filter((f) => f.status === query.status);

      return {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(results),
      };
    }),
    findOne: vi.fn((query) => {
      const results = [...filesStore.values()].filter((f) => {
        if (query._id && f._id !== query._id.toString()) return false;
        if (query.ownerId && f.ownerId !== query.ownerId.toString()) return false;
        if (query.isDeleted !== undefined && f.isDeleted !== query.isDeleted) return false;
        if (query.status && f.status !== query.status) return false;
        return true;
      });
      return Promise.resolve(results[0] || null);
    }),
    findOneAndUpdate: vi.fn((query, update) => {
      const results = [...filesStore.values()].filter((f) => {
        if (query._id && f._id !== query._id.toString()) return false;
        if (query.ownerId && f.ownerId !== query.ownerId.toString()) return false;
        if (query.isDeleted !== undefined && f.isDeleted !== query.isDeleted) return false;
        return true;
      });
      const f = results[0];
      if (!f) return Promise.resolve(null);
      Object.assign(f, update);
      return Promise.resolve(f);
    }),
    updateOne: vi.fn((query, update) => {
      const f = filesStore.get(query._id?.toString());
      if (f) Object.assign(f, update);
      return Promise.resolve({ modifiedCount: 1 });
    }),
    deleteOne: vi.fn((query) => {
      filesStore.delete(query._id?.toString());
      return Promise.resolve({ deletedCount: 1 });
    }),
    countDocuments: vi.fn(() => Promise.resolve(filesStore.size)),
    aggregate: vi.fn().mockResolvedValue([{ total: 0 }]),
  },
}));

vi.mock('../models/Folder.js', () => ({
  default: {
    find: vi.fn((query) => {
      const results = [...foldersStore.values()].filter((f) => f.ownerId === query.ownerId);
      return {
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(results),
      };
    }),
    findOne: vi.fn((query) => {
      const results = [...foldersStore.values()].filter((f) => {
        if (query._id && f._id !== query._id.toString()) return false;
        if (query.ownerId && f.ownerId !== query.ownerId.toString()) return false;
        return true;
      });
      return Promise.resolve(results[0] || null);
    }),
    create: vi.fn((data) => {
      const id = `folder_${Date.now()}`;
      const folder = { _id: id, ...data };
      foldersStore.set(id, folder);
      return Promise.resolve(folder);
    }),
    deleteOne: vi.fn(),
  },
}));

const { default: app } = await import('../app.js');

describe('Files & Storage API', () => {
  const tokenUser1 = jwt.sign({ sub: 'user_1' }, process.env.JWT_SECRET);
  const tokenUser2 = jwt.sign({ sub: 'user_2' }, process.env.JWT_SECRET);

  beforeEach(() => {
    filesStore.clear();
    foldersStore.clear();
    usersStore.clear();
    fileSeq = 1;
    usersStore.set('user_1', { _id: 'user_1', storageUsed: 0 });
    usersStore.set('user_2', { _id: 'user_2', storageUsed: 0 });
  });

  it('POST /api/files/upload-url generates presigned post data for valid file', async () => {
    const res = await request(app)
      .post('/api/files/upload-url')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024 * 50,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uploadData');
    expect(res.body.uploadData).toHaveProperty('url');
    expect(res.body).toHaveProperty('fileId');
  });

  it('POST /api/files/upload-url rejects unsupported file types (e.g. .exe)', async () => {
    const res = await request(app)
      .post('/api/files/upload-url')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({
        filename: 'malware.exe',
        mimeType: 'application/x-msdownload',
        size: 5000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('POST /api/files/upload-url rejects files exceeding storage quota', async () => {
    // Fill up user quota
    usersStore.set('user_1', { _id: 'user_1', storageUsed: 104857600 }); // 100 MB used

    const res = await request(app)
      .post('/api/files/upload-url')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({
        filename: 'large.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      });

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/quota exceeded/i);
  });

  it('POST /api/files/confirm verifies S3 object and updates user storage', async () => {
    filesStore.set('file_1', {
      _id: 'file_1',
      ownerId: 'user_1',
      originalName: 'test.png',
      objectKey: 'users/user_1/mock-uuid',
      status: 'pending',
      size: 1000,
    });

    const res = await request(app)
      .post('/api/files/confirm')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ fileId: 'file_1' });

    expect(res.status).toBe(200);
    expect(res.body.file.status).toBe('active');
  });

  it('GET /api/files/:id/download prevents access to another user files', async () => {
    filesStore.set('file_user1', {
      _id: 'file_user1',
      ownerId: 'user_1',
      originalName: 'secret.pdf',
      objectKey: 'users/user_1/secret',
      status: 'active',
      isDeleted: false,
    });

    // User 2 tries to download User 1's file
    const res = await request(app)
      .get('/api/files/file_user1/download')
      .set('Authorization', `Bearer ${tokenUser2}`);

    expect(res.status).toBe(404);
  });

  it('PATCH /api/files/:id toggles starred state', async () => {
    filesStore.set('file_1', {
      _id: 'file_1',
      ownerId: 'user_1',
      originalName: 'notes.txt',
      status: 'active',
      isStarred: false,
      isDeleted: false,
    });

    const res = await request(app)
      .patch('/api/files/file_1')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ isStarred: true });

    expect(res.status).toBe(200);
    expect(res.body.file.isStarred).toBe(true);
  });

  it('DELETE /api/files/:id moves file to trash (soft-delete)', async () => {
    filesStore.set('file_1', {
      _id: 'file_1',
      ownerId: 'user_1',
      originalName: 'trashme.pdf',
      status: 'active',
      isDeleted: false,
    });

    const res = await request(app)
      .delete('/api/files/file_1')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/moved to trash/i);
    expect(filesStore.get('file_1').isDeleted).toBe(true);
  });

  it('POST /api/files/:id/restore restores soft-deleted file', async () => {
    filesStore.set('file_1', {
      _id: 'file_1',
      ownerId: 'user_1',
      originalName: 'restore.pdf',
      status: 'active',
      isDeleted: true,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/files/file_1/restore')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(res.status).toBe(200);
    expect(filesStore.get('file_1').isDeleted).toBe(false);
  });

  it('DELETE /api/files/:id/permanent permanently deletes file and removes from S3', async () => {
    filesStore.set('file_1', {
      _id: 'file_1',
      ownerId: 'user_1',
      originalName: 'perm.pdf',
      objectKey: 'users/user_1/perm.pdf',
      status: 'active',
      size: 5000,
      isDeleted: true,
    });

    const res = await request(app)
      .delete('/api/files/file_1/permanent')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/permanently deleted/i);
    expect(filesStore.has('file_1')).toBe(false);
  });
});
