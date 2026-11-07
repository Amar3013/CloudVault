# CloudVault Quality Assurance & Testing Guide

## 1. Overview

CloudVault incorporates an automated test suite executed via **Vitest** and **Supertest** along with comprehensive manual verification procedures. The automated test suite leverages isolated mock environments for AWS S3 and MongoDB, ensuring tests execute quickly, deterministically, and without incurring AWS costs or requiring active cloud credentials.

---

## 2. Automated Test Execution

### Running Server Tests
Open a terminal in the `server` directory:
```bash
cd server
npm test
```

### Test Coverage Highlights
The test suite covers:
1. **Authentication & Session Management** (`server/tests/auth.test.js`):
   - Health check endpoint `/api/health`.
   - User registration with bcrypt password hashing and email normalization.
   - Validation failures (short passwords, invalid emails).
   - Duplicate user registration rejection (`409 Conflict`).
   - Login credential verification and JWT token issuance.
   - Rejection of invalid passwords (`401 Unauthorized`).
   - Protected endpoint enforcement without Bearer tokens.
   - Authenticated user retrieval via `/api/auth/me`.

2. **File & Storage Management** (`server/tests/files.test.js`):
   - S3 presigned POST generation with content-length restrictions.
   - Rejection of dangerous file types (e.g. `.exe`).
   - User storage quota enforcement (`413 Payload Too Large`).
   - Upload confirmation via simulated `HeadObjectCommand`.
   - Multi-tenant file isolation (User B cannot access or download User A's files).
   - Star/unstar toggles.
   - Soft-delete moving to trash (`isDeleted: true`).
   - Trash restoration.
   - Permanent deletion and S3 object purge (`DeleteObjectCommand`).

3. **Time-Limited Sharing** (`server/tests/shares.test.js`):
   - Cryptographically secure 32-byte token generation.
   - SHA-256 token hashing in database (token never stored unhashed).
   - Public resolution of share links via token.
   - Rejection of expired links (`410 Gone`).
   - Rejection of revoked links (`410 Gone`).
   - Manual link revocation by file owner.
   - Unauthorized revocation denial.

---

## 3. Manual Testing & Academic Demonstration Checklist

Perform these step-by-step checks during live demonstration:

| # | Feature / Test Scenario | Step-by-Step Instructions | Expected Result |
| :--- | :--- | :--- | :--- |
| 1 | **Registration** | Navigate to `/register`. Fill name, valid email, and password. Submit. | Account created, redirected to `/dashboard`, user name displayed in top bar. |
| 2 | **Validation** | Attempt registration with a 4-character password or mismatched confirm password. | Inline error banner highlights requirement. Form is not submitted. |
| 3 | **Direct S3 Upload** | On `/files`, click "Upload" or drag a PDF/image into the window. | Upload widget shows progress bar; file appears in list after S3 confirmation. |
| 4 | **Quota Meter** | Check the progress bar on `/dashboard` and `/settings`. | Storage used reflects actual file size (e.g., `2.4 MB of 1 GB used`). |
| 5 | **Folder Organization**| Click "New Folder", name it "Academic Demo". Double-click to open. | Breadcrumbs update to `Root > Academic Demo`. Files can be uploaded inside. |
| 6 | **Starred Files** | Click the 3-dots menu on a file &rarr; "Star". Navigate to `/starred`. | File appears on Starred page with yellow star indicator. |
| 7 | **Temporary Sharing** | Click 3-dots menu &rarr; "Share". Choose "1 hour". Click "Generate secure link". Copy link. | Share link generated. Opening in an incognito window displays the public download view. |
| 8 | **Trash & Restore** | Delete a file from My Files. Check `/trash`. Click "Restore". | File disappears from My Files, appears in Trash with strikethrough, then restores back. |
| 9 | **Permanent Deletion**| In `/trash`, click the trashcan icon &rarr; confirm modal. | File is permanently purged from MongoDB and S3; storage quota decrements. |
| 10 | **Logout & Protection**| Click "Sign out". Attempt manual browser navigation to `/dashboard`. | Redirected automatically to `/login`. Token purged from `sessionStorage`. |
