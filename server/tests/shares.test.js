import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-key-at-least-64-characters-long-for-testing-purposes-cloudvault';
process.env.MONGODB_URI = 'mongodb://localhost/test';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.S3_REGION = 'us-east-1';

// Mock S3
vi.mock('../services/s3Service.js', () => ({
  createDownloadUrl: vi.fn().mockResolvedValue('https://test-bucket.s3.amazonaws.com/shared-file.pdf?presigned=true'),
}));

// Mock DB
vi.mock('../config/database.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
  disconnectDB: vi.fn().mockResolvedValue(undefined),
}));

// In-memory shares & files
const sharesMap = new Map();
const filesMap = new Map();
let shareSeq = 1;

vi.mock('../models/ShareLink.js', () => ({
  default: {
    create: vi.fn((data) => {
      const id = `share_${shareSeq++}`;
      const s = { _id: id, ...data };
      sharesMap.set(id, s);
      return Promise.resolve(s);
    }),
    findOne: vi.fn((query) => {
      const share = [...sharesMap.values()].find((s) => {
        if (query.tokenHash && s.tokenHash !== query.tokenHash) return false;
        return true;
      });
      return {
        populate: vi.fn().mockImplementation(() => {
          if (!share) return Promise.resolve(null);
          const f = filesMap.get(share.fileId?.toString());
          return Promise.resolve({ ...share, fileId: f || null });
        }),
      };
    }),
    find: vi.fn(() => ({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([...sharesMap.values()]),
    })),
    findOneAndUpdate: vi.fn((query, update) => {
      const share = [...sharesMap.values()].find((s) => {
        if (query._id && s._id !== query._id.toString()) return false;
        if (query.ownerId && s.ownerId !== query.ownerId.toString()) return false;
        return true;
      });
      if (!share) return Promise.resolve(null);
      Object.assign(share, update);
      return Promise.resolve(share);
    }),
  },
}));

vi.mock('../models/File.js', () => ({
  default: {
    findOne: vi.fn((query) => {
      const f = filesMap.get(query._id?.toString());
      if (!f || f.ownerId !== query.ownerId?.toString()) return Promise.resolve(null);
      return Promise.resolve(f);
    }),
  },
}));

const { default: app } = await import('../app.js');

describe('File Sharing API', () => {
  const tokenUser1 = jwt.sign({ sub: 'user_1' }, process.env.JWT_SECRET);
  const tokenUser2 = jwt.sign({ sub: 'user_2' }, process.env.JWT_SECRET);

  beforeEach(() => {
    sharesMap.clear();
    filesMap.clear();
    shareSeq = 1;

    filesMap.set('file_1', {
      _id: 'file_1',
      ownerId: 'user_1',
      originalName: 'report.pdf',
      objectKey: 'users/user_1/report.pdf',
      size: 1024 * 10,
      mimeType: 'application/pdf',
      status: 'active',
      isDeleted: false,
    });
  });

  it('POST /api/files/:id/share creates a time-limited share link', async () => {
    const res = await request(app)
      .post('/api/files/file_1/share')
      .set('Authorization', `Bearer ${tokenUser1}`)
      .send({ expiresIn: '24h' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('shareUrl');
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('GET /api/shares/:token allows public download of a valid share link', async () => {
    const rawToken = 'random-token-abc-123';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    sharesMap.set('share_1', {
      _id: 'share_1',
      fileId: 'file_1',
      ownerId: 'user_1',
      token: rawToken,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 3600), // 1 hour ahead
      revokedAt: null,
    });

    const res = await request(app).get(`/api/shares/${rawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.file.name).toBe('report.pdf');
    expect(res.body).toHaveProperty('downloadUrl');
  });

  it('GET /api/shares/:token rejects expired links with 410 Gone', async () => {
    const rawToken = 'expired-token';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    sharesMap.set('share_expired', {
      _id: 'share_expired',
      fileId: 'file_1',
      ownerId: 'user_1',
      token: rawToken,
      tokenHash,
      expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      revokedAt: null,
    });

    const res = await request(app).get(`/api/shares/${rawToken}`);
    expect(res.status).toBe(410);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('GET /api/shares/:token rejects revoked links with 410 Gone', async () => {
    const rawToken = 'revoked-token';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    sharesMap.set('share_revoked', {
      _id: 'share_revoked',
      fileId: 'file_1',
      ownerId: 'user_1',
      token: rawToken,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 3600),
      revokedAt: new Date(),
    });

    const res = await request(app).get(`/api/shares/${rawToken}`);
    expect(res.status).toBe(410);
    expect(res.body.error).toMatch(/revoked/i);
  });

  it('DELETE /api/shares/:shareId revokes an active link for owner', async () => {
    sharesMap.set('share_1', {
      _id: 'share_1',
      fileId: 'file_1',
      ownerId: 'user_1',
      token: 'tok-1',
      tokenHash: 'hash-1',
      expiresAt: new Date(Date.now() + 1000 * 3600),
      revokedAt: null,
    });

    const res = await request(app)
      .delete('/api/shares/share_1')
      .set('Authorization', `Bearer ${tokenUser1}`);

    expect(res.status).toBe(200);
    expect(sharesMap.get('share_1').revokedAt).toBeInstanceOf(Date);
  });

  it('DELETE /api/shares/:shareId rejects revocation by unauthorized user', async () => {
    sharesMap.set('share_1', {
      _id: 'share_1',
      fileId: 'file_1',
      ownerId: 'user_1',
      revokedAt: null,
    });

    const res = await request(app)
      .delete('/api/shares/share_1')
      .set('Authorization', `Bearer ${tokenUser2}`);

    expect(res.status).toBe(404);
  });
});
