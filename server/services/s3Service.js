import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, getBucketRegion, getS3Client } from '../config/aws.js';
import { v4 as uuidv4 } from 'uuid';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'text/x-csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/zip',
  'application/x-zip',
  'application/x-zip-compressed',
];

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

// Configure upload limit: strictly defaults to 25 MB if not specified
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 25 * 1024 * 1024;

const BLOCKED_EXTENSIONS = [
  '.exe', '.sh', '.bat', '.ps1', '.cmd', '.msi', '.app',
  '.html', '.htm', '.js', '.mjs', '.cjs', '.php', '.vbs',
  '.jar', '.scr', '.pif', '.com'
];

/**
 * Validates file type and enforces upload size limit.
 */
export function validateFileMetadata(filename, mimeType, size) {
  // Block dangerous executable/script extensions regardless of reported MIME type
  const ext = filename?.toLowerCase().split('.').pop();
  if (ext && BLOCKED_EXTENSIONS.includes(`.${ext}`)) {
    throw Object.assign(new Error('File type not allowed'), { status: 400 });
  }

  const isValidMime = ALLOWED_MIME_TYPES.includes(mimeType);
  const isValidExt = ext && Boolean(EXT_TO_MIME[ext]);

  if (!isValidMime && !isValidExt) {
    throw Object.assign(new Error('File type not allowed'), { status: 400 });
  }
  if (size > MAX_FILE_SIZE) {
    const limitMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    throw Object.assign(new Error(`File exceeds maximum size of ${limitMB} MB`), { status: 400 });
  }
  if (size <= 0) {
    throw Object.assign(new Error('File size must be greater than 0'), { status: 400 });
  }
}

/**
 * Generates a presigned POST policy for direct browser-to-S3 upload.
 * Uploads are user-partitioned and strictly private.
 */
export async function createPresignedUploadPost(userId, filename, mimeType, size) {
  validateFileMetadata(filename, mimeType, size);

  if (!BUCKET_NAME) {
    throw Object.assign(new Error('Storage service is not configured'), { status: 503 });
  }

  // User-partitioned object key
  const objectKey = `users/${userId}/${uuidv4()}`;

  const region = await getBucketRegion();
  const signingClient = getS3Client(region);

  const { url, fields } = await createPresignedPost(signingClient, {
    Bucket: BUCKET_NAME,
    Key: objectKey,
    Conditions: [
      ['content-length-range', 1, MAX_FILE_SIZE],
      ['eq', '$Content-Type', mimeType],
    ],
    Fields: {
      'Content-Type': mimeType,
    },
    Expires: 300, // 5 minutes
  });

  return { url, fields, objectKey };
}

/**
 * Direct file upload helper using PutObjectCommand.
 * Keeps objects private and applies AES256 server-side encryption.
 */
export async function uploadObject({ objectKey, body, mimeType }) {
  if (!BUCKET_NAME) {
    throw Object.assign(new Error('Storage service is not configured'), { status: 503 });
  }

  const region = await getBucketRegion();
  const client = getS3Client(region);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
    Body: body,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256',
  });

  return client.send(command);
}

/**
 * Fetches object metadata from S3 to verify existence and size.
 */
export async function headObject(objectKey) {
  if (!BUCKET_NAME) {
    throw Object.assign(new Error('Storage service is not configured'), { status: 503 });
  }

  const region = await getBucketRegion();
  const client = getS3Client(region);

  const command = new HeadObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
  });

  return client.send(command);
}

/**
 * Generates a secure, time-limited presigned GET URL for downloading files.
 * Forces attachment disposition with the original filename.
 */
export async function createDownloadUrl(objectKey, filename, expiresIn = 900) {
  if (!BUCKET_NAME) {
    throw Object.assign(new Error('Storage service is not configured'), { status: 503 });
  }

  const region = await getBucketRegion();
  const client = getS3Client(region);

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });

  return getSignedUrl(client, command, { expiresIn }); // 15 minutes by default
}

/**
 * Deletes an object from S3.
 */
export async function deleteObject(objectKey) {
  if (!BUCKET_NAME) {
    throw Object.assign(new Error('Storage service is not configured'), { status: 503 });
  }

  const region = await getBucketRegion();
  const client = getS3Client(region);

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
  });

  return client.send(command);
}
