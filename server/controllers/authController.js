import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_EXPIRES = '8h';

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
}

function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    storageUsed: user.storageUsed,
    createdAt: user.createdAt,
  };
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.validatedBody;
    
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    
    const token = signToken(user._id);
    console.log('[AUTH] User registered:', user.email);
    
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.validatedBody;
    
    const user = await User.findOne({ email });
    if (!user) {
      console.warn('[AUTH] Login failed: user not found', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.warn('[AUTH] Login failed: wrong password for', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    console.log('[AUTH] User logged in:', user.email);
    
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  // JWT is stateless; client removes the token
  res.json({ message: 'Logged out successfully' });
}

export async function me(req, res, next) {
  try {
    const q = User.findById(req.userId).select('-passwordHash');
    const user = typeof q.lean === 'function' ? await q.lean() : await q;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}
