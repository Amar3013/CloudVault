import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-key-at-least-64-characters-long-for-testing-purposes-cloudvault';
process.env.MONGODB_URI = 'mongodb://localhost/test';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.S3_REGION = 'us-east-1';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';

// Mock DB connection
vi.mock('../config/database.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
  disconnectDB: vi.fn().mockResolvedValue(undefined),
}));

// In-memory user store
const usersMap = new Map();
let userIdSeq = 1;

vi.mock('../models/User.js', () => {
  return {
    default: {
      findOne: vi.fn(({ email }) => {
        const found = [...usersMap.values()].find((u) => u.email.toLowerCase() === email?.toLowerCase());
        return Promise.resolve(found ? { ...found } : null);
      }),
      findById: vi.fn((id) => {
        const found = usersMap.get(id?.toString());
        const userObj = found ? { _id: found._id, name: found.name, email: found.email, storageUsed: found.storageUsed, createdAt: found.createdAt } : null;
        return {
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(userObj),
            then: (resolve) => Promise.resolve(userObj).then(resolve),
          }),
          then: (resolve) => Promise.resolve(found ? { ...found } : null).then(resolve),
        };
      }),
      create: vi.fn(async (data) => {
        const id = `user_${userIdSeq++}`;
        const user = {
          _id: id,
          storageUsed: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        usersMap.set(id, user);
        return user;
      }),
      updateOne: vi.fn(),
    },
  };
});

// Import app after mocks
const { default: app } = await import('../app.js');

describe('Auth & Security API', () => {
  beforeEach(() => {
    usersMap.clear();
    userIdSeq = 1;
  });

  it('GET /api/health returns 200 with service status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('CloudVault API');
  });

  it('POST /api/auth/register creates user and returns JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'john@example.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('POST /api/auth/register validates minimum password length', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'short@example.com',
        password: 'short',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('POST /api/auth/register rejects duplicate email', async () => {
    // First registration
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'Password123!',
      });

    // Duplicate registration
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Clone',
        email: 'alice@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('POST /api/auth/login authenticates with correct credentials', async () => {
    // Register user first
    const pwHash = await bcrypt.hash('CorrectPass123!', 10);
    usersMap.set('user_1', {
      _id: 'user_1',
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: pwHash,
      storageUsed: 0,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bob@example.com',
        password: 'CorrectPass123!',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('bob@example.com');
  });

  it('POST /api/auth/login rejects wrong password', async () => {
    const pwHash = await bcrypt.hash('CorrectPass123!', 10);
    usersMap.set('user_1', {
      _id: 'user_1',
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: pwHash,
      storageUsed: 0,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bob@example.com',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('GET /api/auth/me rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me succeeds with valid Bearer token', async () => {
    const user = {
      _id: 'user_1',
      name: 'Auth User',
      email: 'auth@example.com',
      storageUsed: 500,
      createdAt: new Date(),
    };
    usersMap.set('user_1', user);

    const token = jwt.sign({ sub: 'user_1' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('auth@example.com');
  });
});
