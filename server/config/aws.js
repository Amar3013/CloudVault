import 'dotenv/config';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

// Read S3 bucket region and configuration exclusively from S3_REGION & S3_BUCKET_NAME
// Do not override AWS_REGION as it is reserved by the AWS Lambda runtime (e.g. ap-southeast-2)
export const S3_REGION = process.env.S3_REGION || 'us-east-1';
export const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

const clientConfig = {
  region: S3_REGION,
  followRegionRedirects: true,
};

// In local development: supply credentials if provided in .env
// In AWS Lambda production: rely on the IAM execution role via the AWS SDK default credential chain
if (!isLambda && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN.trim() } : {}),
  };
}

export const s3Client = new S3Client(clientConfig);

// Regional client pool for presigned URLs
const regionalClients = new Map();
regionalClients.set(S3_REGION, s3Client);

export function getS3Client(region = S3_REGION) {
  if (!regionalClients.has(region)) {
    regionalClients.set(region, new S3Client({
      ...clientConfig,
      region,
    }));
  }
  return regionalClients.get(region);
}

// Cached resolved bucket regions by bucket name
const resolvedBucketRegions = new Map();

export async function getBucketRegion(bucket = BUCKET_NAME) {
  if (!bucket) return S3_REGION;
  if (resolvedBucketRegions.has(bucket)) {
    return resolvedBucketRegions.get(bucket);
  }

  try {
    const res = await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    const detected = res.BucketRegion || res['$metadata']?.bucketRegion || S3_REGION;
    resolvedBucketRegions.set(bucket, detected);
    return detected;
  } catch (err) {
    if (err.$response?.headers?.['x-amz-bucket-region']) {
      const detected = err.$response.headers['x-amz-bucket-region'];
      resolvedBucketRegions.set(bucket, detected);
      return detected;
    }
  }
  return S3_REGION;
}

// Export backward compatibility alias
export { S3_REGION as AWS_REGION };

if (!BUCKET_NAME && process.env.NODE_ENV !== 'test') {
  console.warn('[AWS] S3_BUCKET_NAME is not set in environment variables');
}
