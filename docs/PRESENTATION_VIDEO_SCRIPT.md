# CloudVault: 10-Minute Presentation & Video Demonstration Script

## Cloud Computing Project Submission Guide (40 Points)
- **Course**: Cloud Computing
- **Faculty / Evaluator**: Prof. Bharati Mishra
- **Target Video Length**: Exactly 10 minutes (600 seconds)
- **Format**: Screen recording with audio and webcam / group presenter tiles (using OBS Studio, Zoom, or Loom)
- **Group Structure**: 3 Students per group (Each student speaks for ~3 minutes and 20 seconds)

---

## Group Speaker Breakdown & Timeline

| Timeline | Presenter | Section | Topics Covered |
| :--- | :--- | :--- | :--- |
| **0:00 – 3:15** (3m 15s) | **Student 1** | **Introduction, Problem Statement & Cloud Architecture** | Group intro, traditional storage bottlenecks, project objectives, and multi-tier serverless cloud architecture. |
| **3:15 – 6:30** (3m 15s) | **Student 2** | **Public Cloud Services, Security & Deep-Dive Workflows** | AWS S3, AWS Lambda, Amplify, IAM, CloudWatch, MongoDB Atlas, Presigned POST handshake, and SHA-256 link security. |
| **6:30 – 10:00** (3m 30s) | **Student 3** | **Live End-to-End Demo, Test Verification & Conclusion** | Live web app walkthrough (upload, share, trash), running automated Vitest tests (23/23 passing), cost review, and conclusion. |

---

## Phase 1: Introduction, Problem Statement & System Architecture (0:00 – 3:15)
**Presenter**: Student 1  
**Visual on Screen**: Title Slide &rarr; Problem Comparison Diagram &rarr; System Architecture Diagram

---

### [0:00 – 0:45] Greeting & Project Overview
> *"Hello respected Professor Bharati Mishra and fellow evaluators. We are Group [Number], presenting our Cloud Computing final project: **CloudVault — a Secure Multi-Tenant Cloud Storage and Ephemeral File Sharing Platform**.*
>
> *My name is [Student 1 Name], and presenting with me today are my group members, [Student 2 Name] and [Student 3 Name]. Over the next 10 minutes, our team will walk you through the problem statement, system architecture, public cloud services utilized, technical implementation, and a live demonstration of our deployed application."*

### [0:45 – 2:00] Problem Statement & Motivation
> *"Modern web applications handle vast amounts of documents, media, and data files. However, traditional monolithic web architectures suffer from severe structural bottlenecks when handling file storage:*
> 
> 1. *First, **Memory and Bandwidth Saturation**: In standard setups, file uploads stream through the application backend before reaching storage. This consumes server RAM, ties up event loop threads, and causes connection starvation or timeout errors for regular API users.*
> 2. *Second, **Serverless Payload Limits**: Modern serverless engines like AWS Lambda enforce strict payload limits—specifically 6 megabytes for synchronous invocations. Passing large binary files through Lambda is both costly and architecturally flawed.*
> 3. *Third, **Cloud Security Misconfigurations**: Many systems either unsafely open public S3 bucket policies or expose long-lived AWS IAM access keys in frontend code, leading to unauthorized data exposure.*
> 4. *Lastly, **Lack of Ephemeral Access**: Most platforms do not provide time-limited, revocable sharing links, leaving sensitive corporate documents permanently exposed.*
>
> *To solve these challenges, we engineered CloudVault: a fully serverless, multi-tenant cloud storage platform built on Amazon Web Services and MongoDB Atlas."*

### [2:00 – 3:15] System Architecture & Cloud Primitives
> *(Display the Mermaid System Architecture Diagram on screen)*
>
> *"Here is the high-level architecture of CloudVault. We adopted a completely decoupled design separating binary object storage from application metadata:*
>
> - *At the **Client Layer**, we have a reactive Single Page Application built with React 19 and Tailwind CSS, deployed globally via **AWS Amplify Hosting**.*
> - *For **Compute**, we run an Express.js REST API on **AWS Lambda** using the latest Node.js 24 runtime, exposed through an **AWS Lambda Function URL** with managed HTTPS and CORS.*
> - *For **Object Storage**, we use a private **Amazon S3** bucket protected by AES-256 server-side encryption, with all public access strictly blocked.*
> - *For **Metadata & Authorization**, we leverage **MongoDB Atlas Cloud** in the AWS us-east-1 region to store file records, user schemas, and cryptographic share links.*
> - *And for **Observability**, all application telemetry streams into **Amazon CloudWatch**.*
>
> *The crucial architectural breakthrough here is our **Direct Browser-to-S3 Upload Pipeline**: files are uploaded directly from the user's browser to Amazon S3 using signed Presigned POST policies, completely bypassing our Lambda backend.*
>
> *I will now hand over to [Student 2 Name] to explain the cloud services and deep technical implementation."*

---

## Phase 2: Public Cloud Services, Security & Technical Implementation (3:15 – 6:30)
**Presenter**: Student 2  
**Visual on Screen**: AWS Architecture Slides &rarr; Upload Sequence Diagram &rarr; Security Specifications

---

### [3:15 – 4:30] Public Cloud Services Breakdown
> *"Thank you, [Student 1 Name]. My name is [Student 2 Name], and I will discuss the specific public cloud services and architectural patterns powering CloudVault:*
>
> 1. ***Amazon S3 (Simple Storage Service)**: Amazon S3 serves as our resilient binary store, offering 99.999999999% durability. We enabled **SSE-S3 AES-256 server-side encryption** at rest and strictly enabled **Block All 4 Public Access Settings**. S3 is configured with Cross-Origin Resource Sharing (CORS) rules to accept authorized HTTP POST requests directly from our web application.*
> 2. ***AWS Lambda & Function URLs**: By running our REST API on AWS Lambda, we achieve true serverless elasticity. Lambda scales automatically from zero to thousands of concurrent requests, meaning we pay zero dollars during idle periods. Instead of adding the cost and complexity of API Gateway, we utilized native **Lambda Function URLs** with HTTPS and built-in CORS.*
> 3. ***AWS Amplify Hosting**: Amplify handles automated builds and hosts our static React 19 bundle at AWS CloudFront edge locations worldwide, giving sub-100-millisecond asset loading.*
> 4. ***AWS Identity and Access Management (IAM)**: We adhere strictly to the Principle of Least Privilege. The Lambda function execution role is granted only three S3 actions—`GetObject`, `PutObject`, and `DeleteObject`—restricted exclusively to the CloudVault bucket ARN.*
> 5. ***Amazon CloudWatch**: CloudWatch ingests structured JSON log events from Lambda, providing real-time error auditing, latency profiling, and cold-start tracking.*
> 6. ***MongoDB Atlas**: Hosted in the same AWS us-east-1 region, Atlas provides fast metadata indexing, tenant filtering, and atomic storage quota counters."*

### [4:30 – 5:30] Core Technical Workflows: Direct S3 Upload & Confirmation Handshake
> *(Display the Direct Upload Sequence Diagram on screen)*
>
> *"Let's examine how file uploads work in CloudVault without buffering any data on the server:*
>
> 1. *When a user selects a file, the browser sends a lightweight JSON request to `POST /api/files/upload-url`.*
> 2. *The backend validates the user's JWT token, verifies that the file type is allowed, and checks whether the incoming file size fits within the user's **1 GB storage quota**.*
> 3. *Using the AWS SDK v3 `@aws-sdk/s3-presigned-post`, Lambda calculates a cryptographic HMAC signature and policy conditions restricting the upload to a specific object key (`users/{userId}/{uuid}`), a maximum size of 25 megabytes, and a 15-minute validity window.*
> 4. *The browser receives the signed policy fields and executes an asynchronous `FormData` POST directly to Amazon S3.*
> 5. *Once S3 returns HTTP 204 No Content, the browser triggers a **Confirmation Handshake** to `POST /api/files/confirm`.*
> 6. *Our server executes an S3 `HeadObject` command to verify that the file physically landed in S3 and reads its exact byte length. Only then does it activate the file record in MongoDB and atomically increment the user's storage consumption.*
>
> *This two-phase commit ensures 100% data consistency between S3 and our database."*

### [5:30 – 6:30] Security, Cryptography & Ephemeral Sharing
> *"Security was our paramount design priority:*
>
> - ***Authentication**: User passwords are encrypted with `bcrypt` using 12 salt rounds. Authenticated sessions use stateless JWT tokens stored securely in `sessionStorage` to mitigate CSRF risks.*
> - ***Ephemeral Public Sharing**: When a user creates a share link, the system generates a 32-byte cryptographically secure random token. The plaintext token is provided only in the share URL, while a **SHA-256 hash** of the token is stored in MongoDB Atlas with an expiration timestamp (`1h`, `24h`, or `7d`).*
> - *When a public visitor accesses the share URL, the server verifies the hash, confirms the link has not been revoked or expired, and generates a dynamic 15-minute S3 presigned download URL.*
> - ***Two-Stage Soft Deletion**: Deleting a file moves it to Trash (`isDeleted: true`). If the user clicks 'Permanently Delete', the server issues an S3 `DeleteObjectCommand`, removes the database record, and restores the user's 1 GB quota.*
>
> *Now, [Student 3 Name] will demonstrate the live application and automated test suites."*

---

## Phase 3: Live Application Demonstration, Test Verification & Conclusion (6:30 – 10:00)
**Presenter**: Student 3  
**Visual on Screen**: Browser at `http://localhost:5173` (or deployed Amplify URL) &rarr; Terminal running `npm test` &rarr; Closing Slide

---

### [6:30 – 7:30] Live Demo Part 1: Authentication & Dashboard
> *(Screen recording: Open CloudVault web application in browser)*
>
> *"Thank you, [Student 2 Name]. My name is [Student 3 Name], and I am excited to demonstrate CloudVault in action.*
>
> *We start at the CloudVault landing page, highlighting our cloud features. Let's register a new account: I'll enter a name, email address, and a secure password.*
>
> *(Click Register &rarr; Navigates to Dashboard)*
>
> *Instantly, we are authenticated with a JWT token and directed to our personalized Dashboard. Notice our **Real-Time Storage Meter** at the top: it indicates 0 MB used out of our allocated 1 GB quota. The navigation sidebar allows quick access to My Files, Starred Files, Shared Links, Trash, and Account Settings."*

### [7:30 – 8:30] Live Demo Part 2: Folder Creation & Direct S3 Upload
> *(Click 'My Files' in the sidebar)*
>
> *"Now let's navigate to 'My Files'. Let's create a new folder named `Cloud Computing Project`. Inside the folder, we have instant breadcrumb navigation.*
>
> *Now, let's test our direct-to-S3 file upload. I will drag and drop a PDF project report and an image.*
>
> *(Drag and drop files &rarr; Upload progress bar fills &rarr; Success toast appears)*
>
> *Notice how fast that completed! The binary stream was sent directly to Amazon S3 via the presigned POST policy. Upon completion, the confirmation handshake updated our UI.*
>
> *Let's test file management:*
> - *We can toggle the **Star** icon to favorite this file—visiting 'Starred' in the sidebar displays it immediately.*
> - *We can **Rename** the file.*
> - *We can click **Download**: the backend issues a 15-minute presigned GET URL with `Content-Disposition: attachment`, securely streaming the file from S3.*
> - *Now let's move one file to **Trash**. In the Trash view, we can either click **Restore** to bring it back, or click **Delete Permanently**, which executes an S3 `DeleteObject` command and frees up the user's quota."*

### [8:30 – 9:15] Live Demo Part 3: Ephemeral Public Link Sharing
> *(Go back to My Files &rarr; Click 'Share' on a file)*
>
> *"Next, let's demonstrate our ephemeral public sharing feature. On this document, I click 'Share' and choose an expiration of '24 hours'.*
>
> *(Click Generate Link &rarr; Copy share link)*
>
> *CloudVault generates a unique link containing the cryptographic token. Let's open a new Incognito / Private window and paste this link.*
>
> *(Paste URL in Incognito window &rarr; Shared file preview loads)*
>
> *Notice that as an unauthenticated guest, I can see the file name, size, and expiration time. Clicking 'Download File' streams the file directly from S3 without logging in.*
>
> *Now let's return to our authenticated account, visit the **Shared** tab, and click **Revoke Access**.*
>
> *(Click Revoke &rarr; Refresh Incognito window)*
>
> *When we refresh the guest window, the link immediately returns `HTTP 410 Link Unavailable: This share link has been revoked by the owner`. This proves instantaneous access revocation without touching S3 bucket permissions."*

### [9:15 – 9:45] Automated Test Verification (23 Tests Passing)
> *(Switch screen to Terminal in `server/` directory)*
>
> *"To ensure enterprise quality and reliability, we wrote comprehensive automated test suites using Vitest and Supertest covering authentication, S3 presigned generation, quota limits, and security.*
>
> *Let me run `npm test` live right now:*
>
> *(Type `npm test` and execute)*
>
> *As you can see, all **3 test suites** and **23 individual tests** pass cleanly in under 2 seconds:*
> - *All 8 authentication and rate-limiting tests passed.*
> - *All 9 file management, presigned S3 generation, and quota tests passed.*
> - *All 6 ephemeral sharing, token verification, and revocation tests passed."*

### [9:45 – 10:00] Cloud Cost Analysis & Conclusion
> *(Switch to Summary Slide / Web app dashboard)*
>
> *"Finally, from a cost standpoint, CloudVault was engineered to run 100% within the **AWS Free Tier** and **MongoDB Atlas Free Tier**. With 1,000,000 free Lambda requests and 5 GB of free S3 storage, our total monthly operational cost for this project is exactly **\$0.00**.*
>
> *In conclusion, CloudVault demonstrates how modern serverless cloud architectures solve traditional file storage bottlenecks through direct-to-S3 transfers, least-privilege IAM security, and resilient elasticity.*
>
> *Thank you very much, Professor Bharati Mishra, for your guidance and time. We welcome any questions!"*

---

## Practical Recording Checklist for the Team

- [ ] **Microphone & Camera Check**: Ensure all 3 students have clear audio (use a headset or quiet room).
- [ ] **Screen Resolution**: Set display scaling to 100% and resolution to 1920x1080 (1080p).
- [ ] **Browser Prep**: Clear test files or register a fresh user (e.g., `demo@cloudvault.com`) so the dashboard starts with clean 0 MB quota.
- [ ] **Incognito Window**: Have an Incognito browser window ready on your taskbar for testing the public share link.
- [ ] **Terminal Ready**: Keep the terminal open in `CloudVault/server` ready to run `npm test`.
- [ ] **Timer Running**: Keep a stopwatch or phone timer visible to hit the 10-minute mark precisely.
