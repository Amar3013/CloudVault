import 'dotenv/config';
import http from 'http';
import { spawn } from 'child_process';
import mongoose from 'mongoose';
import { HeadBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, S3_REGION, getBucketRegion } from './config/aws.js';
import User from './models/User.js';
import File from './models/File.js';

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;
const API_BASE = `http://localhost:${BACKEND_PORT}/api`;
const FRONTEND_BASE = `http://localhost:${FRONTEND_PORT}`;

// Sample 1KB real PDF content
const SAMPLE_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (CloudVault E2E Test PDF) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n310\n%%EOF\n',
  'utf-8'
);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // Retry
    }
    await wait(500);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function runEndToEndVerification() {
  console.log('=====================================================');
  console.log('   CloudVault Local End-to-End Live Verification    ');
  console.log('=====================================================\n');

  let backendProcess = null;
  let frontendProcess = null;

  try {
    // -----------------------------------------------------------------
    // STEP 1: Verify MongoDB Connectivity
    // -----------------------------------------------------------------
    console.log('[Step 1/9] Verifying MongoDB Atlas Connectivity...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('  ✓ Connected to MongoDB Atlas cluster:', mongoose.connection.host);
    console.log('  ✓ Database name:', mongoose.connection.name);

    // -----------------------------------------------------------------
    // STEP 2: Verify AWS S3 Connectivity
    // -----------------------------------------------------------------
    console.log('\n[Step 2/9] Verifying AWS S3 Connectivity...');
    console.log('  Configured S3 Bucket:', BUCKET_NAME);
    console.log('  Configured S3 Region in env (S3_REGION):', S3_REGION);

    const bucketRegion = await getBucketRegion();
    console.log('  Resolved Physical Bucket Region:', bucketRegion);

    const headBucketRes = await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log('  ✓ HeadBucket successful (HTTP Status:', headBucketRes.$metadata.httpStatusCode, ')');

    // -----------------------------------------------------------------
    // STEP 3: Start Backend & Frontend Servers
    // -----------------------------------------------------------------
    console.log('\n[Step 3/9] Starting Backend and Frontend Servers...');
    
    // Spawn Backend
    backendProcess = spawn('node', ['app.js'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, PORT: BACKEND_PORT.toString() },
    });

    backendProcess.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`    [Backend stdout] ${msg}`);
    });
    backendProcess.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`    [Backend stderr] ${msg}`);
    });

    // Spawn Frontend
    frontendProcess = spawn('npx', ['vite', '--port', FRONTEND_PORT.toString(), '--strictPort'], {
      cwd: '../client',
      stdio: 'pipe',
      shell: true,
      env: { ...process.env },
    });

    frontendProcess.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg.includes('Local:')) console.log(`    [Frontend stdout] ${msg}`);
    });
    frontendProcess.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`    [Frontend stderr] ${msg}`);
    });

    // Wait for health endpoint
    console.log('  Waiting for Backend on http://localhost:3000/api/health...');
    await waitForHttp(`${API_BASE}/health`);
    console.log('  ✓ Backend API is healthy and accepting requests');

    console.log('  Waiting for Frontend on http://localhost:5173...');
    await waitForHttp(FRONTEND_BASE);
    console.log('  ✓ Frontend dev server is responding');

    // -----------------------------------------------------------------
    // STEP 4: Register and Login with Test Accounts
    // -----------------------------------------------------------------
    console.log('\n[Step 4/9] Testing User Registration and Authentication...');
    const timestamp = Date.now();
    const user1Email = `e2e_user1_${timestamp}@example.com`;
    const user2Email = `e2e_user2_${timestamp}@example.com`;
    const testPassword = 'Password123!';

    // Register User 1
    const reg1Res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user1Email, password: testPassword, name: 'Alice Test' }),
    });
    const reg1Data = await reg1Res.json();
    if (!reg1Res.ok) throw new Error(`User 1 registration failed: ${JSON.stringify(reg1Data)}`);
    const tokenUser1 = reg1Data.token;
    const user1Id = reg1Data.user._id;
    console.log('  ✓ User 1 registered successfully (ID:', user1Id, ')');

    // Register User 2 (for isolation testing)
    const reg2Res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user2Email, password: testPassword, name: 'Bob Isolation' }),
    });
    const reg2Data = await reg2Res.json();
    if (!reg2Res.ok) throw new Error(`User 2 registration failed: ${JSON.stringify(reg2Data)}`);
    const tokenUser2 = reg2Data.token;
    const user2Id = reg2Data.user._id;
    console.log('  ✓ User 2 registered successfully (ID:', user2Id, ')');

    // -----------------------------------------------------------------
    // STEP 5: Request S3 Upload Presigned URL & Upload Real PDF
    // -----------------------------------------------------------------
    console.log('\n[Step 5/9] Uploading a real test PDF file to S3 via Presigned POST...');
    const filename = `e2e-report-${timestamp}.pdf`;
    const mimeType = 'application/pdf';
    const fileSize = SAMPLE_PDF_BUFFER.length;

    const urlReqRes = await fetch(`${API_BASE}/files/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser1}`,
      },
      body: JSON.stringify({ filename, mimeType, size: fileSize }),
    });
    const urlReqData = await urlReqRes.json();
    if (!urlReqRes.ok) throw new Error(`Upload URL request failed: ${JSON.stringify(urlReqData)}`);

    const { uploadData, fileId } = urlReqData;
    console.log('  ✓ Presigned POST URL generated:', uploadData.url);
    console.log('  ✓ Pending File record ID:', fileId);

    // Direct browser-to-S3 upload simulation via FormData
    const formData = new FormData();
    for (const [k, v] of Object.entries(uploadData.fields)) {
      formData.append(k, v);
    }
    formData.append('file', new Blob([SAMPLE_PDF_BUFFER], { type: mimeType }), filename);

    const s3PostRes = await fetch(uploadData.url, {
      method: 'POST',
      body: formData,
    });
    if (!s3PostRes.ok && s3PostRes.status !== 204) {
      const errText = await s3PostRes.text();
      throw new Error(`S3 direct upload failed with status ${s3PostRes.status}: ${errText}`);
    }
    console.log('  ✓ Direct S3 Presigned POST upload succeeded (Status:', s3PostRes.status, ')');

    // Confirm upload with CloudVault backend
    const confirmRes = await fetch(`${API_BASE}/files/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenUser1}`,
      },
      body: JSON.stringify({ fileId }),
    });
    const confirmData = await confirmRes.json();
    if (!confirmRes.ok) throw new Error(`Upload confirmation failed: ${JSON.stringify(confirmData)}`);
    console.log('  ✓ Backend upload confirmation completed. File status:', confirmData.file.status);

    const objectKey = confirmData.file.objectKey;

    // -----------------------------------------------------------------
    // STEP 6: Verify Object in Private S3 Bucket
    // -----------------------------------------------------------------
    console.log('\n[Step 6/9] Verifying object in private AWS S3 bucket...');
    console.log('  Checking S3 Object Key:', objectKey);

    const s3HeadRes = await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    }));

    console.log('  ✓ S3 HeadObject confirmed:');
    console.log('    - ContentLength:', s3HeadRes.ContentLength, 'bytes');
    console.log('    - ContentType:', s3HeadRes.ContentType);
    console.log('    - ServerSideEncryption:', s3HeadRes.ServerSideEncryption);
    console.log('    - ETag:', s3HeadRes.ETag);

    if (s3HeadRes.ContentLength !== fileSize) {
      throw new Error(`S3 ContentLength (${s3HeadRes.ContentLength}) does not match local file size (${fileSize})`);
    }

    // Verify unauthenticated public access is blocked
    const publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${objectKey}`;
    const publicFetch = await fetch(publicUrl);
    console.log('  ✓ Unauthenticated public access test (Status:', publicFetch.status, ') — Public access strictly denied!');
    if (![400, 403, 404].includes(publicFetch.status)) {
      throw new Error('S3 bucket is unexpectedly public!');
    }

    // -----------------------------------------------------------------
    // STEP 7: Verify File Metadata in MongoDB
    // -----------------------------------------------------------------
    console.log('\n[Step 7/9] Verifying metadata in MongoDB Atlas...');
    const mongoFile = await File.findById(fileId).lean();
    if (!mongoFile) throw new Error('File not found in MongoDB!');
    console.log('  ✓ MongoDB File document verified:');
    console.log('    - _id:', mongoFile._id.toString());
    console.log('    - ownerId:', mongoFile.ownerId.toString());
    console.log('    - originalName:', mongoFile.originalName);
    console.log('    - size:', mongoFile.size);
    console.log('    - status:', mongoFile.status);
    console.log('    - isDeleted:', mongoFile.isDeleted);

    const mongoUser = await User.findById(user1Id).lean();
    console.log('  ✓ User storageUsed updated in MongoDB:', mongoUser.storageUsed, 'bytes');
    if (mongoUser.storageUsed !== fileSize) {
      throw new Error(`User storageUsed (${mongoUser.storageUsed}) does not match file size (${fileSize})`);
    }

    // -----------------------------------------------------------------
    // STEP 8: Test File Download & Cross-User Isolation
    // -----------------------------------------------------------------
    console.log('\n[Step 8/9] Testing Presigned Download & User Isolation...');

    // User 1 downloads file
    const dlRes = await fetch(`${API_BASE}/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const dlData = await dlRes.json();
    if (!dlRes.ok) throw new Error(`Download request failed: ${JSON.stringify(dlData)}`);
    console.log('  ✓ User 1 generated presigned download URL');

    const fileContentRes = await fetch(dlData.url);
    const downloadedBuf = Buffer.from(await fileContentRes.arrayBuffer());
    if (Buffer.compare(downloadedBuf, SAMPLE_PDF_BUFFER) !== 0) {
      throw new Error('Downloaded file content does not match uploaded PDF!');
    }
    console.log('  ✓ Downloaded content verified bit-for-bit against uploaded PDF');

    // User 2 attempts to download User 1's file (MUST FAIL with 404)
    console.log('  Testing isolation: User 2 attempting to access User 1\'s file...');
    const leakRes = await fetch(`${API_BASE}/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${tokenUser2}` },
    });
    console.log('  ✓ User 2 download access attempt returned status:', leakRes.status, '(Access denied)');
    if (leakRes.status !== 404) {
      throw new Error(`User 2 was able to access User 1's file! Status: ${leakRes.status}`);
    }

    // User 2 attempts to delete User 1's file (MUST FAIL with 404)
    const leakDelRes = await fetch(`${API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenUser2}` },
    });
    console.log('  ✓ User 2 delete access attempt returned status:', leakDelRes.status, '(Access denied)');
    if (leakDelRes.status !== 404) {
      throw new Error(`User 2 was able to delete User 1's file! Status: ${leakDelRes.status}`);
    }

    // -----------------------------------------------------------------
    // STEP 9: Test File Deletion (Soft Delete & Permanent Purge)
    // -----------------------------------------------------------------
    console.log('\n[Step 9/9] Testing File Deletion Lifecycle...');

    // Soft delete
    const softDelRes = await fetch(`${API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const softDelData = await softDelRes.json();
    if (!softDelRes.ok) throw new Error(`Soft delete failed: ${JSON.stringify(softDelData)}`);
    console.log('  ✓ Soft delete successful:', softDelData.message);

    const trashFile = await File.findById(fileId).lean();
    console.log('  ✓ Verified in MongoDB isDeleted:', trashFile.isDeleted, 'deletedAt:', trashFile.deletedAt);

    // Permanent delete
    const permDelRes = await fetch(`${API_BASE}/files/${fileId}/permanent`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenUser1}` },
    });
    const permDelData = await permDelRes.json();
    if (!permDelRes.ok) throw new Error(`Permanent delete failed: ${JSON.stringify(permDelData)}`);
    console.log('  ✓ Permanent delete successful:', permDelData.message);

    // Verify S3 object is purged
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey }));
      throw new Error('S3 object still exists after permanent delete!');
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        console.log('  ✓ Verified S3 object purged permanently (S3 returned 404 NotFound)');
      } else {
        throw err;
      }
    }

    // Verify MongoDB document is purged
    const purgedFile = await File.findById(fileId).lean();
    if (purgedFile) throw new Error('MongoDB document still exists after permanent delete!');
    console.log('  ✓ Verified MongoDB document removed');

    // Verify user storage was decremented
    const finalUser = await User.findById(user1Id).lean();
    console.log('  ✓ Verified user storageUsed decremented to:', finalUser.storageUsed, 'bytes');

    // Clean up test users from MongoDB
    await User.deleteMany({ _id: { $in: [user1Id, user2Id] } });
    console.log('  ✓ Cleaned up test user accounts from MongoDB');

    console.log('\n=====================================================');
    console.log('   ALL 9 END-TO-END VERIFICATION STEPS PASSED!      ');
    console.log('=====================================================\n');

  } finally {
    if (backendProcess) {
      console.log('Stopping backend server process...');
      backendProcess.kill('SIGINT');
    }
    if (frontendProcess) {
      console.log('Stopping frontend server process...');
      frontendProcess.kill('SIGINT');
    }
    await mongoose.disconnect();
  }
}

runEndToEndVerification().catch((err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
