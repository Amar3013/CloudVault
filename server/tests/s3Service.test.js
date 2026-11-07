import { describe, it, expect, vi } from 'vitest';
import {
  validateFileMetadata,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  createPresignedUploadPost,
  uploadObject,
  headObject,
  createDownloadUrl,
  deleteObject,
} from '../services/s3Service.js';
import { sanitizeLog } from '../middleware/errorHandler.js';

describe('S3 Service & Metadata Validation', () => {
  it('enforces 25 MB maximum upload limit', () => {
    expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024);
    
    // Exactly 25 MB should pass
    expect(() => {
      validateFileMetadata('sample.pdf', 'application/pdf', 25 * 1024 * 1024);
    }).not.toThrow();

    // 25 MB + 1 byte must fail
    expect(() => {
      validateFileMetadata('sample.pdf', 'application/pdf', 25 * 1024 * 1024 + 1);
    }).toThrow(/exceeds maximum size/i);
  });

  it('rejects files with zero or negative size', () => {
    expect(() => {
      validateFileMetadata('empty.txt', 'text/plain', 0);
    }).toThrow(/greater than 0/i);

    expect(() => {
      validateFileMetadata('negative.txt', 'text/plain', -50);
    }).toThrow(/greater than 0/i);
  });

  it('allows supported MIME types', () => {
    const validSamples = [
      { name: 'document.pdf', type: 'application/pdf' },
      { name: 'photo.jpg', type: 'image/jpeg' },
      { name: 'logo.png', type: 'image/png' },
      { name: 'image.webp', type: 'image/webp' },
      { name: 'log.txt', type: 'text/plain' },
      { name: 'data.csv', type: 'text/csv' },
      { name: 'doc.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'sheet.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'archive.zip', type: 'application/zip' },
    ];

    for (const sample of validSamples) {
      expect(() => validateFileMetadata(sample.name, sample.type, 1024)).not.toThrow();
    }
  });

  it('rejects forbidden file extensions even if MIME type is disguised', () => {
    const dangerousNames = [
      'virus.exe',
      'script.sh',
      'runner.bat',
      'attack.ps1',
      'cmd.cmd',
      'installer.msi',
      'page.html',
      'index.htm',
      'payload.js',
      'code.php',
    ];

    for (const name of dangerousNames) {
      expect(() => {
        validateFileMetadata(name, 'application/pdf', 2048);
      }).toThrow(/not allowed/i);
    }
  });

  it('redacts sensitive credentials and tokens in logs', () => {
    const logData = {
      message: 'Failed to authenticate with AKIAIOSFODNN7EXAMPLE',
      secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak',
      url: 'https://bucket.s3.amazonaws.com?X-Amz-Signature=abcdef1234567890',
    };

    const sanitized = sanitizeLog(logData);
    expect(sanitized.message).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(sanitized.message).toContain('[REDACTED_AWS_KEY]');
    expect(sanitized.secret).toBe('[REDACTED]');
    expect(sanitized.auth).toBe('[REDACTED]');
    expect(sanitized.url).not.toContain('abcdef1234567890');
    expect(sanitized.url).toContain('X-Amz-Signature=[REDACTED]');
  });
});
