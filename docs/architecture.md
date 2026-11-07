# CloudVault Architecture & System Design

## 1. System Overview

CloudVault is an enterprise-inspired cloud storage and file-sharing platform designed with a serverless AWS backend and a single-page React frontend. The application decouples metadata management from binary storage to achieve high performance, low operating cost, and strict multi-tenant isolation.

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Layer"]
        UserBrowser["User Browser\n(React 19 + Tailwind CSS)"]
    end

    subgraph CDNAndHosting ["Hosting & Edge"]
        Amplify["AWS Amplify Hosting\n(Static Web Distribution)"]
    end

    subgraph ComputeLayer ["Serverless Compute"]
        FuncURL["AWS Lambda Function URL\n(HTTPS Entrypoint + CORS)"]
        Lambda["AWS Lambda Function\n(Express.js + Node.js 24 runtime)"]
    end

    subgraph StorageLayer ["Data & Storage"]
        S3Bucket[("Amazon S3 Private Bucket\n(AES-256 Encrypted Objects)")]
        MongoAtlas[("MongoDB Atlas M0\n(Metadata, Users, ACLs)")]
    end

    subgraph Observability ["Observability"]
        CloudWatch["Amazon CloudWatch\n(JSON Structured Logs)"]
    end

    UserBrowser -->|"1. HTTPS Web App"| Amplify
    UserBrowser -->|"2. API Requests (Bearer JWT)"| FuncURL
    FuncURL --> Lambda
    Lambda -->|"3. Read/Write Metadata"| MongoAtlas
    Lambda -->|"4. S3 HeadObject & Delete"| S3Bucket
    Lambda -->|"5. Structured Logs"| CloudWatch
    UserBrowser -->|"6. Direct Binary Upload (Presigned POST)"| S3Bucket
    UserBrowser -->|"7. Direct Binary Download (Presigned GET)"| S3Bucket
```

---

## 2. Core Flows & Protocols

### A. Direct Browser-to-S3 Upload Flow
Direct uploads protect serverless compute from large payload buffering, Lambda timeouts, memory limits, and bandwidth charges:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Browser)
    participant API as Lambda (Express API)
    participant DB as MongoDB Atlas
    participant S3 as Amazon S3 Bucket

    User->>API: POST /api/files/upload-url { filename, mimeType, size, folderId }
    Note over API: Authenticate user & check storage quota
    Note over API: Validate file extension & mime type
    API->>S3: createPresignedPost(bucket, key, conditions)
    API->>DB: Create File record (status: 'pending')
    API-->>User: Return { uploadData: { url, fields }, fileId }

    User->>S3: POST multipart/form-data with fields + binary file
    Note over S3: S3 verifies conditions & stores encrypted object (users/{userId}/{uuid})
    S3-->>User: 204 No Content

    User->>API: POST /api/files/confirm { fileId }
    API->>S3: HeadObject(key)
    Note over API: Verify object exists & get actual ContentLength
    API->>DB: Update File (status: 'active', size: actualSize)
    API->>DB: Increment User.storageUsed by actualSize
    API-->>User: 200 OK { file }
```

### B. Secure File Download Flow
```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Browser)
    participant API as Lambda (Express API)
    participant DB as MongoDB Atlas
    participant S3 as Amazon S3 Bucket

    User->>API: GET /api/files/:id/download (Authorization: Bearer <token>)
    API->>DB: Find File where _id = :id AND ownerId = req.userId AND isDeleted = false
    alt File Not Found or Not Owned
        API-->>User: 404 Not Found
    else File Verified
        API->>S3: GetSignedUrl(GetObjectCommand with attachment filename, expiresIn=900)
        API-->>User: 200 OK { url: "https://..." }
        User->>S3: GET presigned URL
        S3-->>User: 200 OK (Binary stream attachment)
    end
```

### C. Temporary Public Sharing Flow
1. **Link Creation**: The file owner requests a share token specifying an expiration (`1h`, `24h`, `7d`).
2. **Cryptographic Hashing**: A 32-byte cryptographically secure random token is generated. A SHA-256 hash of this token is stored in MongoDB along with `fileId`, `ownerId`, and `expiresAt`. The plaintext token is returned only to the owner in the share URL.
3. **Public Access**: When an unauthenticated visitor accesses `/share/:token`, the server hashes the URL token and looks up the active share link.
4. **Validation**: The system verifies:
   - Link is found.
   - File is still active and not trashed.
   - Link has not been revoked (`revokedAt == null`).
   - Link has not expired (`new Date() < expiresAt`).
5. **Signed Redirect**: If valid, a temporary S3 presigned URL is dynamically created with an expiry of 15 minutes and provided to the visitor.

---

## 3. Security Design Decisions

| Security Area | Implementation Strategy | Rationale |
| :--- | :--- | :--- |
| **S3 Access Control** | Private bucket, Block Public Access enabled on all 4 settings | Files are never publicly exposed through S3 web hosting or open ACLs. |
| **Object Key Obfuscation** | Keys formatted as `users/{userId}/{uuid}` | Prevents directory traversal, key collisions, and filename enumeration. |
| **Authentication** | Stateless HMAC-SHA256 JWTs stored in `sessionStorage` | Avoids CSRF vulnerabilities associated with ambient cookie storage. |
| **Data in Transit** | HTTPS enforcement, Helmet security headers, CORS allowlist | Protects against MITM attacks, MIME sniffing, and cross-origin hijacking. |
| **Data at Rest** | Amazon S3 SSE-S3 (AES-256) server-side encryption | Automated encryption at rest without managing custom KMS keys. |
| **Rate Limiting** | Express-rate-limit on auth and public sharing endpoints | Mitigates brute-force attacks and denial-of-wallet attempts. |
| **Input Validation** | Zod schemas on every write route | Rejects malformed requests before touching controller or DB logic. |

---

## 4. Cost Analysis (Free Academic Deployment)

CloudVault is engineered to operate strictly within the **AWS Free Tier** and **MongoDB Atlas Free Tier**:

1. **AWS Lambda**: 1,000,000 free requests per month, 3.2 million seconds of compute time.
2. **Amazon S3**: 5 GB standard storage, 20,000 GET requests, 2,000 PUT requests free for 12 months.
3. **AWS Amplify**: 1,000 build minutes/month and 15 GB served free per month.
4. **Amazon CloudWatch**: 5 GB log ingestion and 5 GB archival free per month.
5. **MongoDB Atlas**: M0 Sandbox cluster (512 MB storage, shared RAM, shared vCPU) is permanently free.
6. **Zero Cost Compute**: No continuously running EC2 instances, NAT gateways, or Application Load Balancers. Estimated AWS monthly cost for demonstration: **\$0.00**.
