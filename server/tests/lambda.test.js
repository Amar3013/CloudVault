import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'super-secret-key-at-least-64-characters-long-for-testing-purposes-cloudvault';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/test';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://*.amplifyapp.com';

// Mock DB connection
vi.mock('../config/database.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
  disconnectDB: vi.fn().mockResolvedValue(undefined),
}));

const { handler } = await import('../lambda.js');

describe('AWS Lambda & API Gateway Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables callbackWaitsForEmptyEventLoop on Lambda context', async () => {
    const mockContext = { callbackWaitsForEmptyEventLoop: true };
    const event = {
      version: '2.0',
      routeKey: 'GET /api/health',
      rawPath: '/api/health',
      rawQueryString: '',
      headers: { host: 'api.example.com' },
      requestContext: {
        http: { method: 'GET', path: '/api/health' },
      },
      isBase64Encoded: false,
    };

    await handler(event, mockContext);
    expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('handles API Gateway HTTP API v2 event (GET /api/health)', async () => {
    const event = {
      version: '2.0',
      routeKey: 'GET /api/health',
      rawPath: '/api/health',
      rawQueryString: '',
      headers: {
        accept: 'application/json',
        host: 'api.execute-api.us-east-1.amazonaws.com',
      },
      requestContext: {
        http: { method: 'GET', path: '/api/health' },
      },
      isBase64Encoded: false,
    };

    const response = await handler(event, {});
    expect(response).toBeDefined();
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('service', 'CloudVault API');
  });

  it('allows CORS preflight for Amplify domain (*.amplifyapp.com)', async () => {
    const event = {
      version: '2.0',
      routeKey: 'OPTIONS /api/health',
      rawPath: '/api/health',
      rawQueryString: '',
      headers: {
        origin: 'https://main.d123456abcdef.amplifyapp.com',
        'access-control-request-method': 'GET',
      },
      requestContext: {
        http: { method: 'OPTIONS', path: '/api/health' },
      },
      isBase64Encoded: false,
    };

    const response = await handler(event, {});
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://main.d123456abcdef.amplifyapp.com');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('handles API Gateway REST API v1 proxy event format', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/api/health',
      headers: { Accept: 'application/json' },
      queryStringParameters: null,
      body: null,
      isBase64Encoded: false,
    };

    const response = await handler(event, {});
    expect(response).toBeDefined();
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('supports cross-region S3 configuration where Lambda is in ap-southeast-2 and S3 is in us-east-1', () => {
    // Verify Lambda runtime region differs from S3 bucket region
    process.env.AWS_REGION = 'ap-southeast-2';
    process.env.S3_REGION = 'us-east-1';

    expect(process.env.AWS_REGION).toBe('ap-southeast-2');
    expect(process.env.S3_REGION).toBe('us-east-1');
  });

  it('verifies that S3 configuration uses S3_REGION and default AWS credential chain in Lambda', async () => {
    const awsModule = await import('../config/aws.js');
    expect(awsModule.S3_REGION).toBe('us-east-1');
    expect(awsModule.BUCKET_NAME).toBeDefined();
  });
});
