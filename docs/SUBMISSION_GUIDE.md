# CloudVault: Final Submission Checklist & Evaluator Guide

## Cloud Computing Project Submission (40 Points)
- **Course**: Cloud Computing (CS / IT)
- **Instructor / Evaluator**: Prof. Bharati Mishra
- **Deadline**: November 10, 2026 — 11:59 PM
- **Team Size**: 3 Students per group

---

## 1. Deliverables Verification Matrix

| # | Required Deliverable (Per Syllabus) | Provided Artifact in Repository | Status |
| :-: | :--- | :--- | :-: |
| **1** | **Detailed Project Report** (Problem statement, objectives, architecture, cloud services, implementation, results, conclusion) | **[PROJECT_REPORT.md](file:///c:/Users/linge/Desktop/CloudVault/PROJECT_REPORT.md)** (also mirrored in `docs/PROJECT_REPORT.md`) | **Complete & Verified** |
| **2** | **Complete Source Code & Configurations** (Backend, Frontend, SAM template, Amplify config, environment templates) | Full working source in `client/`, `server/`, `template.yaml`, `amplify.yml`, `.env.example` | **Complete & Tested** |
| **3** | **Execution & Deployment Instructions** (Step-by-step local setup and AWS cloud deployment guide) | **[DEPLOYMENT.md](file:///c:/Users/linge/Desktop/CloudVault/DEPLOYMENT.md)** & Section 10 of **[PROJECT_REPORT.md](file:///c:/Users/linge/Desktop/CloudVault/PROJECT_REPORT.md)** | **Complete & Verified** |
| **4** | **10-Minute Video Demonstration Script** (10-minute timing, 3-student contribution distribution, speaking lines, live demo steps) | **[PRESENTATION_VIDEO_SCRIPT.md](file:///c:/Users/linge/Desktop/CloudVault/docs/PRESENTATION_VIDEO_SCRIPT.md)** | **Complete & Scripted** |
| **5** | **Architecture & API Technical References** (Sequence diagrams, security analysis, complete REST API endpoints) | **[architecture.md](file:///c:/Users/linge/Desktop/CloudVault/docs/architecture.md)** & **[api-documentation.md](file:///c:/Users/linge/Desktop/CloudVault/docs/api-documentation.md)** | **Complete & Documented** |

---

## 2. Fast Evaluation Guide (For Prof. Bharati Mishra)

### Step 1: Run Automated Verification Tests
To verify all backend services, S3 presigned generation, security rules, rate limiters, and quota management:
```bash
cd server
npm test
```
*Expected Result: All 3 test suites pass (23 tests passed).*

### Step 2: Start the System Locally
```bash
# Terminal 1: Backend API
cd server
npm install
npm run dev

# Terminal 2: Frontend Client
cd client
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### Step 3: Key Functional Features to Verify
1. **User Registration & Login**: Navigate to `/register`, create an account, verify instant JWT issuance and redirection to `/dashboard`.
2. **Real-Time Storage Meter**: Check dashboard storage widget showing `0 MB / 1 GB (0%)`.
3. **Direct S3 Upload**: Go to `/files`, drag and drop any PDF/image/document. Observe live progress indicator and automatic HeadObject confirmation.
4. **File Organization**:
   - Create nested folders with instant breadcrumb traversal.
   - Star/unstar files and view them under the `/starred` page.
   - Rename files and filter by search bar.
5. **Two-Stage Deletion (Trash Lifecycle)**:
   - Click "Move to Trash" &rarr; file moves to `/trash` (soft delete).
   - Click "Restore" to recover, or "Delete Permanently" to trigger an S3 `DeleteObject` command and free up storage quota.
6. **Time-Limited Public Sharing**:
   - Click "Share" on any active file and select an expiry (e.g. 1 hour or 24 hours).
   - Copy the link and open it in an Incognito / Private browser tab.
   - Verify unauthenticated public download from S3.
   - Return to the authenticated user account under `/shared` and click "Revoke Access".
   - Refresh the Incognito window and verify the link immediately returns `HTTP 410 Link Unavailable`.

---

## 3. Public Cloud Deployment Summary

The project is pre-configured with Infrastructure as Code for production deployment on AWS:
- **Serverless API**: Configured via AWS SAM in `template.yaml` for deployment to **AWS Lambda (Node.js 24 runtime)** with an **AWS Lambda Function URL**.
- **Binary Storage**: Private **Amazon S3** bucket with AES-256 server-side encryption, Block Public Access on all 4 settings, and permissive CORS for client POSTs.
- **Frontend SPA**: Build and deployment pipeline specified in `amplify.yml` for **AWS Amplify Hosting**.
- **Database**: Cloud-hosted **MongoDB Atlas M0 Sandbox** in the `us-east-1` region.
- **Cost**: Fully compliant with AWS Free Tier and MongoDB Atlas Free Tier (**\$0.00 / month**).

For detailed deployment steps with AWS CLI and SAM commands, refer to **[DEPLOYMENT.md](file:///c:/Users/linge/Desktop/CloudVault/DEPLOYMENT.md)**.
