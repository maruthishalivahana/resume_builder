# RESUME.ENG — Backend API (Milestone 1)

Backend service for the **RESUME.ENG** LaTeX platform. This service handles file uploads, validation, and persistent storage of `.tex` documents and project metadata in MongoDB Atlas.

---

## Current Milestone

> **CURRENT MILESTONE:** `.tex` file upload and MongoDB persistence.

### Features in this milestone
- In-memory `.tex` file validation and upload via Multer (max 2 MB)
- UTF-8 text decoding of `.tex` buffer
- Automatic `LatexProject` document creation
- Associated `LatexFile` document creation with project reference
- Standardized API responses (HTTP 201) and centralized error handling (HTTP 400/500)
- Health check endpoint
- Deterministic resume evidence indexing for LaTeX projects
- Version-scoped evidence inspection with source file and line mappings

### NOT Implemented Yet (Planned for Future Milestones)
- Authentication / User accounts
- Multi-file project trees
- ZIP archives & extraction
- LaTeX compilation (`pdflatex` / Docker worker)
- PDF preview generation
- Redis caching
- BullMQ job queues
- AI resume assistant
- ATS diagnostics
- Version history

## Resume Evidence Index

The evidence index preserves the original `LatexFile` documents as the source of truth and stores
deterministic, version-scoped evidence records for future retrieval:

```text
POST /api/tailoring/resume/index
{ "projectId": "...", "versionId": "..." }

GET /api/tailoring/resume/:projectId/evidence
GET /api/tailoring/resume/:projectId/evidence?versionId=...&section=projects&type=bullet&fileId=...
```

Indexing is idempotent for the same project/version. Each record retains its source file ID,
file name, and line range. The indexer does not call external AI services, modify LaTeX files,
or mix evidence between versions.

## Semantic Resume Index

Semantic retrieval is a separate layer over indexed `ResumeEvidence`. The default local
provider is deterministic `MockEmbeddingProvider`; it is suitable for tests and local
development, not production relevance evaluation.

```text
POST /api/tailoring/resume/embeddings/index
{ "projectId": "...", "versionId": "..." }

POST /api/tailoring/resume/semantic-search
{
  "projectId": "...",
  "versionId": "...",
  "query": "Node.js backend REST API development",
  "limit": 5
}
```

Semantic search is retrieval only. It is not match classification, ATS scoring, generation,
or evidence validation.

### Providers and Atlas

Configure `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, and
`ATLAS_VECTOR_INDEX_NAME` in the backend environment. Set `VECTOR_SEARCH_PROVIDER=atlas`
to use Atlas; the default `mongo` provider performs a scoped application-side cosine
search for local development. The current implementation uses
the deterministic mock embedding provider; no real provider API key or SDK is configured
in this repository.

For Atlas Vector Search, create an index named by `ATLAS_VECTOR_INDEX_NAME` on the
`ResumeEvidence` collection with a vector field matching the configured dimensions:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 64, "similarity": "cosine" },
    { "type": "filter", "path": "projectId" },
    { "type": "filter", "path": "versionId" }
  ]
}
```

Replace `64` with the actual configured embedding dimension; do not guess it. The Atlas
provider always filters by both `projectId` and `versionId`.

Run deterministic semantic tests with:

```bash
npm run test:semantic
```

## Hybrid Resume Retrieval

Hybrid retrieval combines deterministic BM25-style lexical search with the existing
semantic retrieval service:

```text
query
  -> scoped BM25 lexical candidates
  -> scoped semantic candidates
  -> candidate union by evidenceId
  -> per-set min-max normalization
  -> weighted score fusion
  -> top-K evidence
```

API:

```text
POST /api/tailoring/resume/hybrid-search
{
  "projectId": "...",
  "versionId": "version-1",
  "query": "Node.js backend REST API development",
  "limit": 5
}
```

The response includes `lexicalScore`, `semanticScore`, and `hybridScore` for evaluation.
Default weights are configured with `HYBRID_LEXICAL_WEIGHT=0.5` and
`HYBRID_SEMANTIC_WEIGHT=0.5`; they must be non-negative and sum to `1`.

Lexical tokenization normalizes common technical spellings such as `Node.js`/`NodeJS`,
`React.js`, `REST APIs`, `React Native`, and `Spring Boot` without changing stored
evidence text. Both retrieval branches are always scoped by `projectId` and `versionId`.

Run hybrid tests and the deterministic evaluation utility with:

```bash
npm run test:hybrid
npm run build && node evaluate-hybrid.js
```

Hybrid retrieval only finds potentially relevant evidence. It does not classify whether
a requirement is satisfied, generate resume content, validate claims, or modify LaTeX.

## Requirement Match Classification

The deterministic match layer consumes hybrid retrieval results and classifies each
requirement as `STRONG`, `PARTIAL`, `WEAK`, `MISSING`, or `CONFLICT`.

```text
POST /api/tailoring/matches/analyze
{
  "projectId": "...",
  "versionId": "version-1",
  "requirementIds": ["requirement-1"]
}
```

Classification is conservative:

- Exact normalized technologies can produce `STRONG`.
- Related technologies such as React/React Native or AWS Lambda/AWS S3 produce
  at most `PARTIAL`.
- Missing requirements produce `MISSING`.
- Explicitly lower durations produce `CONFLICT`.
- A technology without the requested duration produces `PARTIAL`, not an invented
  years-of-experience claim.
- Coursework is not treated as professional experience.

Each persisted `ResumeMatch` includes confidence, evidence IDs, lexical/semantic/hybrid
evidence scores, and a deterministic explanation. Match confidence is a rule-based
ranking signal, not a calibrated probability. The classifier does not call an LLM.

Run the deterministic match evaluation with:

```bash
npm run test:match
```

## Grounded LLM Generation and Claim Validation

Grounded generation is opt-in and runs only in the backend. Set
`LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL` in the
backend environment. The key is never returned to the frontend or logged. The
default `LLM_PROVIDER=deterministic` keeps local analysis offline.

```text
POST /api/tailoring/suggestions/generate
{
  "projectId": "...",
  "versionId": "version-1",
  "requirementId": "requirement-1"
}
```

The endpoint requires a persisted deterministic match, retrieves only that match's
verified evidence, and sends requirement metadata, match classification, and source
locations to OpenRouter. It never sends the raw resume, modifies MongoDB resume data,
or modifies LaTeX files through the provider. OpenRouter output must be strict JSON;
free-form output, malformed schemas, unsupported technologies, new numbers/metrics,
unsupported durations, certifications, or responsibility claims are rejected.
Only suggestions passing deterministic claim validation are persisted with
`validation: "PASS"` and returned as safe suggestions.

The OpenRouter integration and validator are mock-tested; production credentials are
not required for the test suite:

```bash
npm run test:grounded
```

## Source-Aware Suggestion Patching

Validated suggestions can be applied with:

```text
POST /api/tailoring/suggestions/:suggestionId/accept
{
  "projectId": "...",
  "versionId": "..."
}
```

The backend derives the file and source range from `ResumeEvidence`, stores a
SHA-256 hash of the exact source text, and verifies the current file content and
hash before changing `LatexFile.content`. If the original line moved, an exact
single occurrence may be relocated; missing or ambiguous occurrences are rejected
without overwriting user edits. The affected evidence is invalidated, the project
source version is incremented, and the existing compiler state becomes stale while
the previous successful PDF remains available. The response includes the updated
content and changed line range for editor synchronization.

---

## Tech Stack

- **Runtime:** Node.js (v20+)
- **Language:** Strict TypeScript
- **Framework:** Express.js (v4)
- **Database:** MongoDB Atlas via Mongoose (v8)
- **File Ingestion:** Multer (`memoryStorage`)
- **Environment:** `dotenv`
- **Security:** `cors`

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.ts                   # Mongoose connection to MongoDB Atlas
│   ├── controllers/
│   │   └── latex.controller.ts     # uploadTexFile logic & project derivation
│   ├── middleware/
│   │   ├── error.middleware.ts     # Centralized error handler & AppError
│   │   └── upload.middleware.ts    # Multer memory storage & .tex filter
│   ├── models/
│   │   ├── LatexFile.ts            # LatexFile Mongoose schema & index
│   │   └── LatexProject.ts         # LatexProject Mongoose schema
│   ├── routes/
│   │   └── latex.routes.ts         # POST /api/latex/upload route
│   ├── app.ts                      # Express app setup, CORS & middleware
│   └── server.ts                   # Bootstrapping & server listening
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Installation & Setup

### 1. Install dependencies

From the `backend` directory:

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your values in `.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/resume_eng
CLIENT_URL=http://localhost:3000
```

> **Note:** The backend fails immediately on startup if `MONGODB_URI` is not provided.

### 3. MongoDB Atlas Setup

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Database Access**, create a user with Read/Write privileges.
3. Under **Network Access**, add your IP address (or `0.0.0.0/0` for development).
4. Go to **Clusters > Connect > Drivers** and copy your connection string.
5. Replace `<password>` with your database user password and update `MONGODB_URI` in `.env`.

---

## Running the Backend

### Development Mode (auto-reload)

```bash
npm run dev
```

Server will start on `http://localhost:5000`.

### Production Build & Run

```bash
npm run build
npm run start
```

---

## API Endpoints

### 1. Health Check

- **Method:** `GET`
- **URL:** `http://localhost:5000/api/health`
- **Response:**
  ```json
  {
    "success": true,
    "message": "RESUME.ENG backend is running"
  }
  ```

---

### 2. Upload `.tex` File

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/latex/upload`
- **Content-Type:** `multipart/form-data`
- **Body Field:**
  - `file`: (Binary `.tex` file)

#### Successful Response (`HTTP 201 Created`):

```json
{
  "success": true,
  "message": "LaTeX file uploaded successfully",
  "data": {
    "project": {
      "id": "673f8a...",
      "name": "resume",
      "compiler": "pdflatex"
    },
    "file": {
      "id": "673f8b...",
      "name": "resume.tex",
      "path": "resume.tex",
      "content": "\\documentclass{article}\n\\begin{document}\n...\n\\end{document}"
    }
  }
}
```

#### Error Responses (`HTTP 400 Bad Request`):

- **No file provided:**
  ```json
  {
    "success": false,
    "message": "No file uploaded. Please upload a .tex file using the 'file' field"
  }
  ```

- **Invalid file extension (e.g. `.txt`):**
  ```json
  {
    "success": false,
    "message": "Invalid file type. Only .tex files are allowed"
  }
  ```

- **File size exceeds 2 MB:**
  ```json
  {
    "success": false,
    "message": "File size exceeds 2 MB limit"
  }
  ```

---

## Postman / cURL Testing Instructions

### cURL Examples

#### Health check:
```bash
curl http://localhost:5000/api/health
```

#### Upload valid `.tex` file:
```bash
curl -X POST http://localhost:5000/api/latex/upload \
  -F "file=@sample_resume.tex"
```

#### Upload invalid `.txt` file (should fail with 400):
```bash
curl -X POST http://localhost:5000/api/latex/upload \
  -F "file=@notes.txt"
```

### Postman Testing:
1. Open Postman and create a new request.
2. Select **POST** and enter `http://localhost:5000/api/latex/upload`.
3. In the **Body** tab, choose **form-data**.
4. Set the key to `file`, change the dropdown from *Text* to *File*.
5. Select a `.tex` file from your disk.
6. Click **Send**.
7. Observe `201 Created` with project and file JSON.
