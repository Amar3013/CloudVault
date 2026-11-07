// Production testing script for CloudVault deployed on AWS Lambda & API Gateway
import fs from 'fs';
import path from 'path';

const API_BASE = 'https://tnn1ahid34.execute-api.ap-southeast-2.amazonaws.com';

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const res = await fetch(url, options);
  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text();
  }
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    data,
  };
}

async function run() {
  const results = [];
  const timestamp = Date.now();
  const testUserEmail = `cloudvault-prod-test-${timestamp}@example.com`;
  const attackerUserEmail = `cloudvault-attacker-${timestamp}@example.com`;
  const testPassword = 'TestPassword@123456';

  console.log(`Starting Production Tests against ${API_BASE}`);

  // Test 1: Production Health Check
  {
    console.log('\n--- 1. Testing Health Endpoint ---');
    const res = await request('/api/health');
    console.log('Health response:', res.status, res.data);
    results.push({
      name: 'Production Health Check',
      endpoint: 'GET /api/health',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && res.data?.status === 'ok',
      details: res.data,
    });
  }

  // Test 2: User 1 Registration
  let token1, user1;
  {
    console.log('\n--- 2. Registering Primary Test User ---');
    const res = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Primary Test User',
        email: testUserEmail,
        password: testPassword,
      }),
    });
    console.log('Register response status:', res.status);
    token1 = res.data?.token;
    user1 = res.data?.user;
    results.push({
      name: 'Primary User Registration',
      endpoint: 'POST /api/auth/register',
      expectedStatus: 201,
      actualStatus: res.status,
      passed: res.status === 201 && Boolean(token1),
      details: { user: user1?.email, id: user1?._id },
    });
  }

  // Test 3: User 1 Login
  {
    console.log('\n--- 3. Primary User Login ---');
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserEmail,
        password: testPassword,
      }),
    });
    console.log('Login response status:', res.status);
    results.push({
      name: 'Primary User Login',
      endpoint: 'POST /api/auth/login',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && Boolean(res.data?.token),
      details: { email: res.data?.user?.email },
    });
  }

  // Test 4: User 2 (Attacker) Registration for cross-user isolation tests
  let token2, user2;
  {
    console.log('\n--- 4. Registering Second User (Attacker/Isolation) ---');
    const res = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker User',
        email: attackerUserEmail,
        password: testPassword,
      }),
    });
    token2 = res.data?.token;
    user2 = res.data?.user;
    results.push({
      name: 'Second User Registration (Isolation Test)',
      endpoint: 'POST /api/auth/register',
      expectedStatus: 201,
      actualStatus: res.status,
      passed: res.status === 201 && Boolean(token2),
      details: { user: user2?.email },
    });
  }

  // Test 5: Presigned Upload URL Request
  const testFileName = `prod-verify-${timestamp}.pdf`;
  const testFileContent = `%PDF-1.4 CloudVault Production Verification Sample File ${timestamp}`;
  const testFileSize = Buffer.byteLength(testFileContent);
  const testFileMime = 'application/pdf';
  let uploadData, fileId;

  {
    console.log('\n--- 5. Requesting Presigned Upload URL ---');
    const res = await request('/api/files/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        filename: testFileName,
        mimeType: testFileMime,
        size: testFileSize,
      }),
    });
    console.log('Upload-URL status:', res.status);
    uploadData = res.data?.uploadData;
    fileId = res.data?.fileId;
    results.push({
      name: 'Generate S3 Presigned Upload URL',
      endpoint: 'POST /api/files/upload-url',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && Boolean(uploadData?.url) && Boolean(uploadData?.fields) && Boolean(fileId),
      details: { fileId, hasUrl: Boolean(uploadData?.url), s3Url: uploadData?.url },
    });
  }

  // Test 6: Direct S3 Upload via Presigned POST Policy
  {
    console.log('\n--- 6. Direct Browser-to-S3 Upload via Presigned POST ---');
    // Prepare multipart/form-data
    const formData = new FormData();
    for (const [key, val] of Object.entries(uploadData.fields)) {
      formData.append(key, val);
    }
    const blob = new Blob([testFileContent], { type: testFileMime });
    formData.append('file', blob, testFileName);

    const s3Res = await fetch(uploadData.url, {
      method: 'POST',
      body: formData,
    });
    console.log('Direct S3 Upload status:', s3Res.status);
    const s3Body = await s3Res.text();
    if (!s3Res.ok) {
      console.error('S3 Upload Error Body:', s3Body);
    }
    results.push({
      name: 'Direct S3 Presigned Upload',
      endpoint: 'POST to S3 Presigned URL',
      expectedStatus: 204,
      actualStatus: s3Res.status,
      passed: s3Res.status === 204 || s3Res.status === 200,
      details: { status: s3Res.status, s3Error: s3Res.ok ? undefined : s3Body },
    });
  }

  // Test 7: Confirm Upload via Backend
  let confirmedFile;
  {
    console.log('\n--- 7. Confirming Upload via API Gateway ---');
    const res = await request('/api/files/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({ fileId }),
    });
    console.log('Confirm Upload status:', res.status);
    confirmedFile = res.data?.file;
    results.push({
      name: 'Confirm Upload & S3 HeadObject Verification',
      endpoint: 'POST /api/files/confirm',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && confirmedFile?.status === 'active' && confirmedFile?.size === testFileSize,
      details: {
        status: confirmedFile?.status,
        originalName: confirmedFile?.originalName,
        size: confirmedFile?.size,
      },
    });
  }

  // Test 8: List Files and Check MongoDB Metadata
  {
    console.log('\n--- 8. Listing Files & Verifying MongoDB Metadata ---');
    const res = await request('/api/files', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.log('List files status:', res.status, 'Total files:', res.data?.total);
    const found = res.data?.files?.find((f) => f._id === fileId);
    results.push({
      name: 'List Files & Metadata Verification',
      endpoint: 'GET /api/files',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && Boolean(found) && found.originalName === testFileName && found.size === testFileSize,
      details: { found: Boolean(found), metadata: found },
    });
  }

  // Test 9: File Download via Presigned GET URL
  let downloadedContent;
  {
    console.log('\n--- 9. Downloading File via Presigned GET URL ---');
    const res = await request(`/api/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.log('Download URL response status:', res.status);
    const downloadUrl = res.data?.url;
    let downloadStatus = 0;
    if (downloadUrl) {
      const s3Fetch = await fetch(downloadUrl);
      downloadStatus = s3Fetch.status;
      downloadedContent = await s3Fetch.text();
    }
    const contentMatches = downloadedContent === testFileContent;
    console.log('Downloaded content matches original:', contentMatches);
    results.push({
      name: 'File Download URL & S3 Fetch',
      endpoint: 'GET /api/files/:id/download',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && downloadStatus === 200 && contentMatches,
      details: {
        hasDownloadUrl: Boolean(downloadUrl),
        s3DownloadStatus: downloadStatus,
        contentMatches,
        bytesDownloaded: Buffer.byteLength(downloadedContent || ''),
      },
    });
  }

  // Test 10: Unauthorized User Cannot Access Another User's File
  {
    console.log('\n--- 10. Security: Cross-User Isolation (User 2 downloads User 1 file) ---');
    const res = await request(`/api/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token2}` },
    });
    console.log('Attacker access status:', res.status);
    results.push({
      name: 'Security: Cross-User File Isolation',
      endpoint: 'GET /api/files/:id/download (unauthorized user)',
      expectedStatus: 404,
      actualStatus: res.status,
      passed: res.status === 404,
      details: res.data,
    });
  }

  // Test 11: File Rename / Patch
  {
    console.log('\n--- 11. Updating File (Rename & Star) ---');
    const renamed = `renamed-${testFileName}`;
    const res = await request(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({ originalName: renamed, isStarred: true }),
    });
    console.log('Update file status:', res.status);
    results.push({
      name: 'Update File Metadata (Rename & Star)',
      endpoint: 'PATCH /api/files/:id',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && res.data?.file?.originalName === renamed && res.data?.file?.isStarred === true,
      details: res.data?.file,
    });
  }

  // Test 12: Soft Delete
  {
    console.log('\n--- 12. Soft Deleting File (Move to Trash) ---');
    const res = await request(`/api/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.log('Soft delete status:', res.status);
    results.push({
      name: 'Soft Delete File (Move to Trash)',
      endpoint: 'DELETE /api/files/:id',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && res.data?.message === 'File moved to trash',
      details: res.data,
    });
  }

  // Test 13: Verify File in Trash and Absent from Active List
  {
    console.log('\n--- 13. Verifying File in Trash ---');
    const activeRes = await request('/api/files', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const trashRes = await request('/api/files/trash', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const inActive = activeRes.data?.files?.some((f) => f._id === fileId);
    const inTrash = trashRes.data?.files?.some((f) => f._id === fileId);
    console.log('In active files:', inActive, '| In trash:', inTrash);
    results.push({
      name: 'Verify Trash & Active Separation',
      endpoint: 'GET /api/files/trash',
      expectedStatus: 200,
      actualStatus: trashRes.status,
      passed: trashRes.status === 200 && !inActive && inTrash,
      details: { inActive, inTrash },
    });
  }

  // Test 14: Restore File from Trash
  {
    console.log('\n--- 14. Restoring File from Trash ---');
    const res = await request(`/api/files/${fileId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.log('Restore status:', res.status);
    results.push({
      name: 'Restore File from Trash',
      endpoint: 'POST /api/files/:id/restore',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && res.data?.file?.isDeleted === false,
      details: res.data?.file,
    });
  }

  // Test 15: Download Restored File (Verify Content Integrity)
  {
    console.log('\n--- 15. Verifying Download of Restored File ---');
    const res = await request(`/api/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    let restoredContent = '';
    let dlStatus = 0;
    if (res.data?.url) {
      const s3Fetch = await fetch(res.data.url);
      dlStatus = s3Fetch.status;
      restoredContent = await s3Fetch.text();
    }
    const matches = restoredContent === testFileContent;
    console.log('Restored download matches original:', matches);
    results.push({
      name: 'Download Restored File',
      endpoint: 'GET /api/files/:id/download (after restore)',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && dlStatus === 200 && matches,
      details: { matches, bytes: Buffer.byteLength(restoredContent) },
    });
  }

  // Test 16: Permanent Delete (Must be trashed first)
  {
    console.log('\n--- 16. Permanent Deletion ---');
    // First soft delete to trash
    await request(`/api/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
    });
    // Permanent delete
    const res = await request(`/api/files/${fileId}/permanent`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.log('Permanent delete status:', res.status);
    results.push({
      name: 'Permanent Delete from S3 & MongoDB',
      endpoint: 'DELETE /api/files/:id/permanent',
      expectedStatus: 200,
      actualStatus: res.status,
      passed: res.status === 200 && res.data?.message === 'File permanently deleted',
      details: res.data,
    });
  }

  // Test 17: Security - Missing Authorization Header
  {
    console.log('\n--- 17. Security: Missing Authorization Header ---');
    const res = await request('/api/files');
    console.log('No auth status:', res.status);
    results.push({
      name: 'Security: Missing Authorization Header',
      endpoint: 'GET /api/files (no token)',
      expectedStatus: 401,
      actualStatus: res.status,
      passed: res.status === 401,
      details: res.data,
    });
  }

  // Test 18: Security - Invalid JWT Token
  {
    console.log('\n--- 18. Security: Invalid JWT Token ---');
    const res = await request('/api/files', {
      headers: { Authorization: 'Bearer this-is-a-completely-invalid-token' },
    });
    console.log('Invalid token status:', res.status);
    results.push({
      name: 'Security: Invalid JWT Token',
      endpoint: 'GET /api/files (bad token)',
      expectedStatus: 401,
      actualStatus: res.status,
      passed: res.status === 401,
      details: res.data,
    });
  }

  // Test 19: Security - Blocked Executable Extension (.exe)
  {
    console.log('\n--- 19. Security: Blocked Extension (.exe) ---');
    const res = await request('/api/files/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        filename: 'malicious.exe',
        mimeType: 'application/octet-stream',
        size: 1024,
      }),
    });
    console.log('Blocked extension status:', res.status);
    results.push({
      name: 'Security: Block Unsupported / Executable File (.exe)',
      endpoint: 'POST /api/files/upload-url (malicious.exe)',
      expectedStatus: 400,
      actualStatus: res.status,
      passed: res.status === 400,
      details: res.data,
    });
  }

  // Test 20: Security - File Exceeding 25 MB Limit
  {
    console.log('\n--- 20. Security: File Exceeding 25 MB Limit ---');
    const oversize = 26 * 1024 * 1024; // 26 MB
    const res = await request('/api/files/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        filename: 'huge-file.pdf',
        mimeType: 'application/pdf',
        size: oversize,
      }),
    });
    console.log('Oversize file status:', res.status);
    results.push({
      name: 'Security: Enforce 25 MB Upload Limit',
      endpoint: 'POST /api/files/upload-url (oversize file)',
      expectedStatus: 400,
      actualStatus: res.status,
      passed: res.status === 400,
      details: res.data,
    });
  }

  // Test 21: Security - Invalid / Non-existent File ID
  {
    console.log('\n--- 21. Security: Invalid File ID ---');
    const res = await request('/api/files/507f1f77bcf86cd799439011/download', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    console.log('Invalid file ID status:', res.status);
    results.push({
      name: 'Security: Non-existent File ID Access',
      endpoint: 'GET /api/files/:id/download (non-existent id)',
      expectedStatus: 404,
      actualStatus: res.status,
      passed: res.status === 404,
      details: res.data,
    });
  }

  // Test 22: Security - Invalid Upload Confirmation
  {
    console.log('\n--- 22. Security: Invalid Upload Confirmation ---');
    const res = await request('/api/files/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({ fileId: '507f1f77bcf86cd799439011' }),
    });
    console.log('Invalid confirm status:', res.status);
    results.push({
      name: 'Security: Invalid Upload Confirmation',
      endpoint: 'POST /api/files/confirm (non-existent fileId)',
      expectedStatus: 404,
      actualStatus: res.status,
      passed: res.status === 404,
      details: res.data,
    });
  }

  console.log('\n=============================================');
  console.log('          PRODUCTION TEST SUMMARY            ');
  console.log('=============================================');
  let passCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✓ PASS' : '✗ FAIL';
    if (r.passed) passCount++;
    console.log(`[${symbol}] ${r.name} (Status: ${r.actualStatus}, Expected: ${r.expectedStatus})`);
  }
  console.log(`\nTotal Passed: ${passCount}/${results.length}`);

  // Write full JSON results to disk for artifact/report generation
  fs.writeFileSync('production-test-results.json', JSON.stringify({ timestamp, results }, null, 2));
}

run().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
