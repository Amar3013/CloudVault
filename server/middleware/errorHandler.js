/**
 * Sanitizes strings to prevent accidental leakage of sensitive credentials
 * (AWS access keys, secret keys, session tokens, JWTs, signatures).
 */
export function sanitizeLog(input) {
  if (!input) return input;
  if (typeof input === 'object') {
    const serialized = JSON.stringify(input, (key, value) => {
      if (typeof key === 'string' && /password|secret|key|token|credential|auth/i.test(key)) {
        return '[REDACTED]';
      }
      return value;
    });
    return JSON.parse(sanitizeString(serialized));
  }
  if (typeof input === 'string') {
    return sanitizeString(input);
  }
  return input;
}

function sanitizeString(str) {
  return str
    .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]')
    .replace(/(AWS_SECRET_ACCESS_KEY|secretAccessKey|aws_secret_access_key)\s*[:=]\s*["']?[A-Za-z0-9/+=]+["']?/gi, '$1=[REDACTED]')
    .replace(/Signature=[0-9a-fA-F]+/g, 'Signature=[REDACTED]')
    .replace(/X-Amz-Signature=[0-9a-fA-F]+/g, 'X-Amz-Signature=[REDACTED]')
    .replace(/X-Amz-Security-Token=[A-Za-z0-9/+=]+/g, 'X-Amz-Security-Token=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, 'Bearer [REDACTED_JWT]');
}

export function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';
  let status = err.status || err.statusCode || 500;
  let clientMessage = err.message || 'An error occurred';

  // Map known AWS S3 errors to clean HTTP status codes
  if (err.name === 'NoSuchKey' || err.name === 'NotFound') {
    status = 404;
    clientMessage = 'Requested file not found in storage';
  } else if (err.name === 'AccessDenied') {
    status = 403;
    clientMessage = 'Access to storage resource was denied';
  } else if (err.name === 'EntityTooLarge' || err.code === 'EntityTooLarge') {
    status = 413;
    clientMessage = 'File exceeds maximum allowed upload size';
  }

  // Sanitize error details for logging
  const sanitizedLog = sanitizeLog({
    method: req.method,
    url: req.url,
    status,
    message: err.message,
    name: err.name,
    ...(isDev && err.stack ? { stack: sanitizeString(err.stack) } : {}),
  });

  console.error('[ERROR]', sanitizedLog);

  // In production or for 500 server errors, return clean error messages
  if (status >= 500) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(status).json({ error: sanitizeString(clientMessage) });
}
