import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import folderRoutes from './routes/folders.js';
import shareRoutes from './routes/shares.js';
import dashboardRoutes from './routes/dashboard.js';
import storageRoutes from './routes/storage.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security headers (allows cross-origin downloads & presigned URL redirection)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration supporting local dev and future AWS Amplify frontend domains
const rawAllowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function isOriginAllowed(origin) {
  // Allow server-to-server, curl, mobile apps, or local non-browser requests
  if (!origin) return true;
  
  if (rawAllowedOrigins.includes('*') || rawAllowedOrigins.includes(origin)) {
    return true;
  }
  
  // Support Amplify domains: e.g. https://main.d123456abcdef.amplifyapp.com or wildcard *.amplifyapp.com
  const isAmplifyOrigin = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)?\.amplifyapp\.com$/i.test(origin);
  const allowAllAmplify = rawAllowedOrigins.some((ao) => ao.includes('amplifyapp.com'));
  if (isAmplifyOrigin && allowAllAmplify) {
    return true;
  }

  // Check wildcard domain matching (e.g. *.yourdomain.com)
  return rawAllowedOrigins.some((allowed) => {
    if (allowed.startsWith('*.')) {
      const domainSuffix = allowed.slice(1);
      return origin.endsWith(domainSuffix);
    }
    return false;
  });
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
    callback(new Error('Not allowed by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  maxAge: 86400,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging: skip morgan in tests; in Lambda, logs stream directly to CloudWatch
if (process.env.NODE_ENV !== 'test' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use(morgan('combined'));
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'CloudVault API',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    serverless: Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/storage', storageRoutes);

// Global error handler
app.use(errorHandler);

// Start server locally when not running under tests or AWS Lambda
const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
if (process.env.NODE_ENV !== 'test' && !isLambda) {
  const PORT = process.env.PORT || 3000;
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`[SERVER] CloudVault running locally on http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error('[SERVER] Database connection failed:', err.message);
    });
}

export default app;
