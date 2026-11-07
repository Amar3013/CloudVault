import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import {
  uploadObject,
  createDownloadUrl,
  deleteObject,
  headObject,
  createPresignedUploadPost,
} from '../services/s3Service.js';
import { BUCKET_NAME } from '../config/aws.js';

const hasAwsConfig = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET_NAME
);

describe.runIf(hasAwsConfig)('Live AWS S3 Storage Integration', () => {
  const testUserId = 'test-user-integration-001';
  const testFilename = 'integration-test.txt';
  const testKey = `users/${testUserId}/test-file-${Date.now()}.txt`;
  const fileContent = 'CloudVault AWS S3 Integration Test Content';

  it('uploads a private file to S3 using PutObjectCommand', async () => {
    const uploadRes = await uploadObject({
      objectKey: testKey,
      body: Buffer.from(fileContent),
      mimeType: 'text/plain',
    });

    expect(uploadRes).toBeDefined();
    expect(uploadRes.$metadata.httpStatusCode).toBe(200);
  });

  it('verifies the uploaded file exists and retrieves metadata via headObject', async () => {
    const headRes = await headObject(testKey);

    expect(headRes).toBeDefined();
    expect(headRes.ContentLength).toBe(Buffer.byteLength(fileContent));
    expect(headRes.ContentType).toBe('text/plain');
    expect(headRes.ServerSideEncryption).toBe('AES256');
  });

  it('generates a secure presigned download URL and downloads file content', async () => {
    const downloadUrl = await createDownloadUrl(testKey, testFilename, 60);

    expect(downloadUrl).toBeDefined();
    expect(downloadUrl).toContain(encodeURIComponent(testFilename));

    // Verify content download via the presigned URL
    const response = await fetch(downloadUrl);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe(fileContent);
  });

  it('ensures direct unauthenticated public access is rejected (Bucket is Private)', async () => {
    const publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${testKey}`;
    const response = await fetch(publicUrl);
    // Unsigned public request MUST be denied (403 or 400 redirect/block)
    expect([400, 403, 404]).toContain(response.status);
  });

  it('generates valid presigned upload POST data with security conditions', async () => {
    const postData = await createPresignedUploadPost(testUserId, 'upload.pdf', 'application/pdf', 1024);

    expect(postData.url).toBeDefined();
    expect(postData.fields).toHaveProperty('bucket', BUCKET_NAME);
    expect(postData.fields).toHaveProperty('X-Amz-Signature');
    expect(postData.objectKey).toMatch(new RegExp(`^users/${testUserId}/`));
  });

  it('permanently deletes the file from S3 via DeleteObjectCommand', async () => {
    const deleteRes = await deleteObject(testKey);
    expect(deleteRes.$metadata.httpStatusCode).toBe(204);

    // Verify object is gone
    await expect(headObject(testKey)).rejects.toThrow();
  });
});
