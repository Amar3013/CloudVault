import serverless from 'serverless-http';
import app from './app.js';
import { connectDB } from './config/database.js';

let serverlessHandler;

/**
 * AWS Lambda Entry Point for API Gateway (HTTP API v2 & REST API v1) & Lambda Function URLs.
 */
export const handler = async (event, context) => {
  // Prevent Lambda from waiting for the Node.js event loop to empty
  // Allows Mongoose connection pool to stay open across warm invocations
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  // Re-use warm MongoDB connection
  try {
    await connectDB();
  } catch (dbErr) {
    console.error('[LAMBDA] Database connection initialization failed:', dbErr.message);
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Database service temporarily unavailable' }),
    };
  }

  // Lazy-initialize serverless-http adapter with binary support
  if (!serverlessHandler) {
    serverlessHandler = serverless(app, {
      binary: [
        'image/*',
        'application/pdf',
        'application/zip',
        'application/octet-stream',
        'multipart/form-data',
      ],
    });
  }

  // Structured log for CloudWatch
  const httpMethod = event?.requestContext?.http?.method || event?.httpMethod || event?.requestContext?.httpMethod;
  const path = event?.rawPath || event?.path || event?.requestContext?.path;
  const requestId = event?.requestContext?.requestId || context?.awsRequestId;
  
  if (process.env.NODE_ENV !== 'test' && (httpMethod || path)) {
    console.log(`[LAMBDA] ${httpMethod || 'INVOKE'} ${path || '/'} (RequestId: ${requestId || 'local'})`);
  }

  return serverlessHandler(event, context);
};
