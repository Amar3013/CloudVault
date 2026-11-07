# CloudVault REST API Documentation

Base URL: `http://localhost:3000/api` (Local) or `https://<lambda-id>.lambda-url.<region>.on.aws/api` (Production)

All requests expecting JSON input must include the header `Content-Type: application/json`.
All authenticated requests must include the header `Authorization: Bearer <jwt_token>`.

---

## 1. Health & Status

### `GET /api/health`
Check API service health and uptime.
- **Authentication**: None
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "timestamp": "2026-11-01T09:40:00.000Z",
  "service": "CloudVault API",
  "uptime": 124.5
}
```

---

## 2. Authentication

### `POST /api/auth/register`
Create a new user account.
- **Authentication**: None
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```
- **Response `201 Created`**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "67425f1b1a45c60a12345678",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "storageUsed": 0,
    "createdAt": "2026-11-01T09:40:00.000Z"
  }
}
```

### `POST /api/auth/login`
Authenticate existing user and issue JWT access token.
- **Authentication**: None
- **Request Body**:
```json
{
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```
- **Response `200 OK`**: (Same structure as registration)

### `POST /api/auth/logout`
Invalidate current session.
- **Authentication**: Bearer Token
- **Response `200 OK`**:
```json
{
  "message": "Logged out successfully"
}
```

### `GET /api/auth/me`
Retrieve currently logged-in user profile and storage allocation.
- **Authentication**: Bearer Token
- **Response `200 OK`**:
```json
{
  "user": {
    "_id": "67425f1b1a45c60a12345678",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "storageUsed": 1048576,
    "createdAt": "2026-11-01T09:40:00.000Z"
  }
}
```

---

## 3. Files Management

### `GET /api/files`
List active files for the authenticated user with sorting, pagination, and search.
- **Authentication**: Bearer Token
- **Query Parameters**:
  - `folderId` (string, optional): Folder ID, or empty string for root.
  - `search` (string, optional): Case-insensitive filename search keyword.
  - `sortBy` (string, optional): `createdAt` (default), `originalName`, `size`.
  - `sortDir` (string, optional): `desc` (default) or `asc`.
  - `page` (number, optional): Page number (default: 1).
  - `deleted` (boolean, optional): If `true`, returns files in trash.
- **Response `200 OK`**:
```json
{
  "files": [
    {
      "_id": "6742617a1a45c60a87654321",
      "ownerId": "67425f1b1a45c60a12345678",
      "originalName": "Project_Proposal.pdf",
      "mimeType": "application/pdf",
      "size": 2457600,
      "folderId": null,
      "isStarred": false,
      "status": "active",
      "isDeleted": false,
      "createdAt": "2026-11-01T09:42:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 50
}
```

### `POST /api/files/upload-url`
Request an S3 presigned POST policy and fields.
- **Authentication**: Bearer Token
- **Request Body**:
```json
{
  "filename": "Report.pdf",
  "mimeType": "application/pdf",
  "size": 1500000,
  "folderId": null
}
```
- **Response `200 OK`**:
```json
{
  "uploadData": {
    "url": "https://cloudvault-files-123456-us-east-1.s3.amazonaws.com",
    "fields": {
      "key": "users/67425f1b1a45c60a12345678/3f7b76a0-2f9a-4c28-98e9-4e78a6311a2f",
      "bucket": "cloudvault-files-123456-us-east-1",
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": "...",
      "X-Amz-Date": "...",
      "Policy": "...",
      "X-Amz-Signature": "..."
    }
  },
  "fileId": "6742617a1a45c60a87654321"
}
```

### `POST /api/files/confirm`
Confirm that a binary upload completed successfully to S3.
- **Authentication**: Bearer Token
- **Request Body**:
```json
{
  "fileId": "6742617a1a45c60a87654321"
}
```
- **Response `200 OK`**: Returns activated file metadata.

### `GET /api/files/:id/download`
Generate a temporary presigned download link for an owned file.
- **Authentication**: Bearer Token
- **Response `200 OK`**:
```json
{
  "url": "https://cloudvault-files-123456-us-east-1.s3.amazonaws.com/users/...?X-Amz-Expires=900"
}
```

### `PATCH /api/files/:id`
Rename a file or toggle star state.
- **Authentication**: Bearer Token
- **Request Body**:
```json
{
  "originalName": "New_Name.pdf",
  "isStarred": true
}
```

### `DELETE /api/files/:id`
Soft-delete a file (moves to trash).
- **Authentication**: Bearer Token
- **Response `200 OK`**: `{ "message": "File moved to trash" }`

### `POST /api/files/:id/restore`
Restore a soft-deleted file from trash.
- **Authentication**: Bearer Token
- **Response `200 OK`**: `{ "file": { ... } }`

### `DELETE /api/files/:id/permanent`
Permanently remove a file from both MongoDB and Amazon S3.
- **Authentication**: Bearer Token
- **Response `200 OK`**: `{ "message": "File permanently deleted" }`

---

## 4. Folders Management

### `GET /api/folders`
List folders owned by the current user.
- **Query Parameter**: `parentFolderId` (optional)
- **Response `200 OK`**: `{ "folders": [ ... ] }`

### `POST /api/folders`
Create a new folder.
- **Request Body**:
```json
{
  "name": "Documents",
  "parentFolderId": null
}
```
- **Response `201 Created`**: `{ "folder": { ... } }`

---

## 5. Sharing

### `POST /api/files/:id/share`
Create a time-limited public sharing token.
- **Request Body**:
```json
{
  "expiresIn": "24h"
}
```
- **Response `200 OK`**:
```json
{
  "shareUrl": "http://localhost:5173/share/a1b2c3d4e5f6...",
  "expiresAt": "2026-11-02T09:40:00.000Z",
  "shareId": "674263001a45c60a99998888"
}
```

### `GET /api/shares`
List all shares created by the user.
- **Authentication**: Bearer Token
- **Response `200 OK`**: `{ "shares": [ ... ] }`

### `GET /api/shares/:token`
Publicly resolve a shared file by token and obtain a presigned download link.
- **Authentication**: None
- **Response `200 OK`**:
```json
{
  "file": {
    "name": "Shared_Presentation.pdf",
    "size": 5242880,
    "mimeType": "application/pdf"
  },
  "downloadUrl": "https://cloudvault-files.s3.amazonaws.com/...",
  "expiresAt": "2026-11-02T09:40:00.000Z"
}
```
- **Error `410 Gone`**: Returned if the share link has expired or was revoked.

### `DELETE /api/shares/:shareId`
Revoke a public share link.
- **Authentication**: Bearer Token
- **Response `200 OK`**: `{ "message": "Share link revoked successfully" }`

---

## 6. Dashboard & Analytics

### `GET /api/dashboard`
Get aggregated statistics, recent uploads, and storage utilization.
- **Authentication**: Bearer Token
- **Response `200 OK`**:
```json
{
  "totalFiles": 12,
  "recentFiles": [ ... ],
  "storage": {
    "used": 15728640,
    "quota": 1073741824,
    "available": 1058013184
  }
}
```
