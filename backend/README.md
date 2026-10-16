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

## Revision-checked editor saves

`PATCH /api/latex/files/:fileId` requires `{ "content": "...", "expectedRevision": 0 }`.
File read/list/create/upload responses include `contentRevision`; successful saves return
the incremented revision. A stale revision returns HTTP 409 with `FILE_REVISION_CONFLICT`.
Requests without an integer `expectedRevision` return HTTP 400. External callers must
read and submit the revision; never advance it locally after a failed request.

Existing files without `contentRevision` are treated as revision zero and gain the field
on their first successful save or suggestion patch. No database migration is required.
The editor retains dirty buffers on failures/conflicts and serializes saves per file.
Compilation waits for all active-project buffers to save; manual Save retries failures.
Stale edits are never automatically rebased. The editor shows local/server content and
offers explicit local, server, or reconciled choices; resolution reloads and checks the
displayed revision before making another conditional save. Ordinary Save does not resend
an unresolved conflict. Lost acknowledgments are reconciled by reading authoritative
content/revision; a different server state requires explicit conflict resolution.

Dirty drafts are written synchronously to per-tab `sessionStorage` on changes (maximum
100 files / 2 MiB). They survive reloads in the same tab; closed-tab/browser restoration
depends on browser behavior and is not guaranteed. Storage failures/limits are visible;
existing drafts are not evicted to make room. Recovery retains file/project identity and
the original base revision; restored drafts require an explicit review, including when
the server revision is unchanged. Drafts for missing
files remain visible for copying or deliberate discard. `beforeunload` requests a browser
warning while work is pending; it does not promise a final network save. Provider cleanup
stops debounce timers and late callbacks from replacing a new session's recovery data.

Standalone MongoDB recovery semantics (no transaction/topology requirement): each content
write atomically stores content, incremented revision, and a `pendingWrite` journal. Metadata
finalization updates suggestion acceptance/evidence when applicable, bumps project source
version, then clears the marker conditionally. Failures return committed content/revision
with `recoveryPending: true`; reads and retries resume finalization. Repeated recovery may
bump sourceVersion more than once, which conservatively invalidates PDFs. Writes and
compilation reject unfinished markers. AI acceptance retries recover an existing commit
or return current authoritative file state for an already accepted suggestion; they do
not reapply its patch. A committed acceptance wins a concurrent suggestion-status change.

File deletion now also requires `{ "expectedRevision": N }`. UI decisions are Save and
delete or Discard edits and delete. The client waits for pending saves/AI operations;
failed saves leave the file intact. Deletion first conditionally marks `pendingDelete`,
finalizes entry selection/source metadata, and physically deletes last. Recovery retries
are idempotent; a missing file confirms completed deletion. Unfinished deletion markers
also block writes/compilation. Draft buffers are removed only after confirmed deletion.

Compilation awaits this client's active-project saves and accepted-patch operations and
reconstructs persisted MongoDB content. It is **not** a transactional multi-file snapshot:
another client can update files between the project/files reads. This task adds recovery
guards, not a compiler snapshot redesign. No migration is required: optional recovery
fields are introduced only by new operations, and absent revisions remain zero.

Run `npm run test:autosave` from `backend/`. These regressions use the existing tsx loader
and stub database methods; they do not connect to MongoDB.

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

## Tree rename integrity and standalone recovery

The configured development MongoDB was verified with `hello` to be standalone,
so namespace mutations use a durable project journal rather than transactions.
Optional `treeVersion` fields on projects/files/folders and `treeOperation` on
projects are additive; absent versions behave as zero. No migration or unique
index is introduced. Before each operation, the entire project namespace is
inventoried. Missing/cross-project parents, inconsistent paths, cycles, and shared
file/folder collisions (NFC-normalized, case-insensitive) reject the operation
before node writes. Existing inconsistent records require deliberate repair;
they are never silently deleted or reparented.

Folder rename uses literal prefix slicing and preflights every destination.
The immutable manifest is persisted before any node update, and replay changes
only names/paths/tree versions. IDs, content revisions, content, and entry IDs
are preserved. Creates, uploads into projects, and deletes use the same project
gate so they cannot invalidate a prepared rename. File deletion retains its
expected-content-revision check and Priority 1 recovery protections. Tree reads
and compilation reject unresolved journals; tree reads also reject namespace
version changes during their snapshot. This does not redesign compilation's
content snapshot behavior or rewrite LaTeX include references.

On `TREE_RECOVERY_PENDING` (503), retry the identical mutation, or call
`POST /api/latex/projects/:projectId/tree/recovery`. Replay is idempotent, including
an interruption after all node writes. A missing node's delete retry completes
its remaining journal before acknowledging success. A changed request cannot
replace an unfinished journal. Preflight failures release their unprepared
intent without touching nodes.

Recovery in the same backend instance is serialized. Another instance may take
ownership only on the same host after the former process is confirmed dead.
Live workers, other hosts, PID reuse, and unverifiable liveness block takeover
with 503; no time-based lease can overwrite a live worker. Multi-host deployment
needs an explicit operational recovery/fencing policy before rollout. Do not
manually clear a prepared journal or run an old backend that bypasses this gate.

`npm run test:tree` uses mocked MongoDB and checks exact paths, content revisions,
entry references, collisions, worker fencing, and interruptions. The opt-in
`test-tree-rename-live.js` refuses application database addresses; it accepts only
`TREE_TEST_MONGODB_URI=mongodb://127.0.0.1:27139/resume_eng_tree_verification`.
Run it against a fresh isolated standalone instance to test real MongoDB CAS and
recovery after a child process exits. It leaves its fixtures in that temporary
database for inspection and never loads the application `.env`.

## Project-specific workspace restoration

The frontend provider reads the current `/resume/[id]/*` route parameter and
restores that project using the existing project metadata, tree, single-file,
and project compilation-state endpoints. Startup no longer calls `/api/latex/latest`.
Invalid IDs and missing projects produce a visible load error with a retry action;
there is no fallback to another project. Empty and folder-only projects restore
with no active file and no invented entry selection. Pending tree journals remain
a load/compile barrier and their backend message is displayed.

`/resume/demo/*` remains an in-memory demo alias. On a fresh session its LaTeX
workspace is empty until explicit creation/upload; it does not discover persisted
projects through `/latest`. If a project is already active in memory, demo keeps
it. Workspace navigation uses the actual route/project ID; marketing links still
open the demo. Editor view preferences are persisted separately as described below.

Each load changes the requested project identity before awaiting responses and
checks a request sequence at every asynchronous stage. Dirty buffers, revisions,
conflicts, and recovery drafts stay in the existing save manager when the visible
tree changes. Load failure clears the visible project without deleting buffers.
Late rename acknowledgments and asynchronous sidebar redirects cannot reactivate
the previous project. Compilation entry selection and the compiler remain unchanged.

`npm run test:restoration` exercises actual hook callbacks, API adapters, route
effect, navigation callbacks, and the save manager with mocked network/state.
It does not mount React or verify browser history, hydration, or live MongoDB.

## Project file-tree rendering

The sidebar builds its hierarchy exclusively from `parentFolderId` and `folderId`.
Names and paths are labels, never ancestry heuristics. An iterative depth-first
walk renders every visible node once and skips the whole subtree of a collapsed
folder. Nesting has no fixed depth limit; indentation is capped to keep deep rows
readable while ARIA levels retain the actual depth. Duplicate names in different
branches keep independent IDs, expansion state, and actions.

Missing parent references and folder cycles appear under "Inaccessible records"
with diagnostics naming the IDs. One display edge per cycle is cut to allow safe
traversal. This changes neither persisted parents nor the original input objects.
Normal backend integrity validation and rename recovery still apply; the fallback
is not a data-repair operation. Child-folder actions and the folder dialog pass
the selected parent ID, with an explicit project-root option.

`npm run test:file-tree` renders the actual tree/rows through React server rendering
and checks nesting, exactly-once display, collapse, entry/action IDs, empty folders,
orphans, cycles, 200 rendered levels, and a 20,000-level traversal. Actual modal and
tree-refresh callbacks are also exercised with mocked state and save transport,
including dirty/empty/in-flight edits. Interactive browser behavior remains a
separate verification step.

## Per-project editor view preferences

The client stores only the active file ID and expanded folder IDs in versioned
localStorage keys (`resume_eng_project_view_v1:<projectId>`). Fresh tree IDs validate
restored preferences before selecting or opening a file. An absent/deleted active
file falls back to the first existing file; empty and folder-only projects remain
unselected. Unknown folder IDs are removed, and collapsed folders stay collapsed.
New or corrupt preference records default to collapsed folders.

Persistence is gated by the loaded tree's project identity and loading/error state.
Temporary cleared trees, failed loads, and stale requests cannot overwrite another
project's preferences. Existing dirty buffers and draft recovery remain in the save
manager/sessionStorage; these preferences contain no source, revision, or entry-file
configuration. Storage errors fall back to session memory, so browser-restart
persistence is unavailable when localStorage is blocked/full. Preferences are local
to the browser profile, not synchronized across devices; concurrent tabs use the
last stored view. Browser teardown does not guarantee a final preference write.

`npm run test:view-state` executes the real load/toggle/persistence callbacks and
save manager with mocked storage, network, and React state. It checks fresh store
instances (restart simulation), independent projects, deleted IDs, selected-file
content loading, empty/folder-only projects, collapsed nesting, corrupt/blocked/
quota storage, failed loads, and switching during pending saves/late responses.
Real browser restart and interactive React behavior require browser verification.

## Explicit compilation entry

Opening/editing a file does not select it as the compilation entry. The LaTeX
editor's "Compilation entry" selector and the existing sidebar entry action both
use `PATCH /api/latex/projects/:projectId/entry-file` with `{ entryFileId }`.
That endpoint validates project membership and a safe project-relative `.tex`
path, then atomically updates the persisted entry and project source version,
fenced against tree mutations/recovery. Project metadata restores this selection.
Uploading a file leaves the entry unchanged, including when no entry is set;
the user must explicitly select an entry before compiling in that case.

`POST /api/latex/projects/:projectId/compile` always uses the persisted entry.
Its optional `entryFileId` is an expected-selection assertion: a mismatch returns
409 `ENTRY_FILE_CHANGED`, and it cannot override project configuration. Missing,
deleted, out-of-project, or invalid entries fail without trying `main.tex`, the
first root file, the active file, or the latest file. Legacy projects with no
persisted entry also require explicit selection; no migration is needed.

Nested entries are permitted. The compiler reconstructs the project paths and
runs from the temporary project root, so dependency references remain relative
to that root (e.g. `\input{nested/part}`). No include rewriting or implicit change
of working directory occurs. PDF storage, preview URLs, and artifact metadata
continue through the existing pipeline; uppercase `.TEX` paths use the correct
PDF basename. Saves must flush successfully and entry selection must finish
before compilation. Write/delete recovery and tree recovery still block it.

Compilation records describe the fetched persisted source and entry, not a
transactional snapshot across all files. Concurrent changes after preparation
can make an artifact stale; the existing source-version/entry checks remain.
This change does not introduce a full compiler snapshot protocol.

`npm run test:entry` exercises actual controller/hook callbacks and compiler
service with mocked MongoDB/state and a process-level compiler fixture. Set
`RESUME_ENTRY_LIVE=1` to use real pdflatex PDFs and pdftotext, optionally supplying
absolute `RESUME_ENTRY_LATEX` and `RESUME_ENTRY_PDFTOTEXT` executable paths. That
mode disables MiKTeX package installation, uses isolated temporary artifacts,
and retains mocked database records. It checks PDF text for A/B selection, saved
B edits, and a nested dependency; it does not start the app or verify live MongoDB.

Compile buttons display the configured entry path. When the open file differs,
the editor explains which entry is compiled and offers an explicit "Use open file
as entry" action; no selection changes happen automatically. A metadata refresh
for a different build cannot replace a successful compile's preview URL.

PDF requests with `compilationId` are scoped to that exact successful compilation
and project. Invalid IDs return 400; failed builds, absent artifacts (including
missing disk files), and IDs outside the project return 404. They never fall back
to the latest PDF. Requests omitting the ID retain the existing latest-success
behavior for compatibility; the preview supplies the selected build's ID.

The entry suite includes the root-editor/nested-entry Technical Skills scenario,
older-build retrieval after a newer success, failed/missing/cross-project artifacts,
and stale metadata refreshing another build. React server-rendering assertions
verify compile target labels and the mismatch notice. Optional
`RESUME_ENTRY_BROWSER=1` with live mode serves only temporary PDFs on a localhost
port through the actual PDF controller and preview renderer. Provider/database
state remains mocked, and the harness closes through its finish link.

`npm run test:pdf-preview` checks the actual preview renderer's newer/older iframe
URLs using mocked provider state. Live entry tests with `RESUME_ENTRY_DELIVERY=1`
also exercise the real HTTP endpoint, verifying content type/length, `%PDF-`
signature, exact artifact SHA-256, parsed text, and byte-range delivery for both
builds. `RESUME_ENTRY_BROWSER=1` additionally mounts the actual React preview
with an isolated provider so build switching can be tested without page reloads.
These modes retain mocked database records and temporary MiKTeX artifacts.

The product preview currently uses the browser's native PDF renderer through an
iframe, not a blob/object URL or PDF.js. No object URLs are created or revoked.
It has no dedicated PDF loading/error handler; native renderer failures may remain
blank. Successful byte delivery and `navigator.pdfViewerEnabled === true` do not
prove that this browser can display a PDF. Direct-PDF navigation is a useful
control for separating application behavior from browser rendering limitations.

# Explicit compilation targets (Phase 1)

`POST /api/latex/projects/:projectId/compile` accepts `{ "entryFileId": "<file ID>" }` as an explicit target, even when it differs from the project's default. This does not update `LatexProject.entryFileId` or sourceVersion. Omitting the field uses the configured default. Invalid IDs (including null/empty), missing or cross-project entries, unsafe paths, invalid project trees, and pending recovery are rejected without fallback.

Build responses add `entryFileId` and `entryFilePath`, alongside `compilationId`; successful `pdf.url` includes that compilation ID. Workspace assembly, artifact storage, project-wide build queries, autosave flushing, and the existing confirmation UI are retained. The UI's **Set open file as entry and compile** still deliberately updates the default; per-target UI/history is a later phase. SourceVersion is not an immutable snapshot.

## Target-specific state and history (Phase 2)

The editor now separates **Default entry** from **Compile target**. Opening a file changes neither. The compile confirmation can explicitly compile the open file without updating the default. The selected target is a browser-local, per-project preference, validated against the fresh tree; missing/corrupt/unavailable preferences use the project default.

`GET /api/latex/projects/:projectId/compilation/latest?entryFileId=<id>` filters both the latest attempt and latest successful artifact by target. Omission retains legacy project-wide queries. `GET /api/latex/projects/:projectId/compilations?entryFileId=<id>&page=1` returns at most 20 builds plus `page` and `hasMore`. Missing/invalid target IDs or invalid page numbers are rejected. A non-unique target/history index is added; no record migration or target collection is needed.

Preview labels identify the actual displayed build's entry path and compilation ID. History selects exact build artifacts; failed historical builds show diagnostics without another build's PDF. Current target failures may retain only that target's previous successful PDF. Project/load/target sequence guards prevent late loads and compile acknowledgments from replacing a newer target. History/metadata failures are visible and retryable, and do not turn a successful compilation into a reported failure. At narrow widths, **Show PDF preview / Show editor** exposes the existing viewer.

Run `npm run test:targets` for mocked target-state/history/preference regressions and `npm run test:entry` for actual hook/compiler flow, including a late A compile acknowledgment after selecting B. These do not prove production concurrency, database durability or native PDF rendering. SourceVersion remains conservative project-wide invalidation; consistent source snapshots remain Phase 3.

## Consistent saved-source capture (Phase 3)

New builds include optional `sourceCapture` provenance in the compilation record and response: capture format version, SHA-256 manifest hash, capture time, entry ID, project source/tree versions, and every file's ID/path/parent, content revision, UTF-8 hash and byte count. Folder IDs/paths/parents are included. Old builds retain no capture metadata; no migration or fabricated backfill occurs.

Before compiler execution, primary/majority reads collect complete project inventories twice. They must agree in revisions, content hashes, topology, and project versions. Source churn allows at most three capture attempts, then fails with HTTP 409 `SOURCE_CAPTURE_CHANGED`. Tree/default-entry changes and pending write/delete/rename recovery remain explicit barriers. Content revisions are monotonic under the existing save/AI-patch contracts, and namespace changes are fenced by treeVersion/journals. No MongoDB transaction or lock is held during compilation.

Workspace assembly uses copied captured file contents exclusively, not subsequent database reads. Writes after capture may proceed, but cannot change that build's input; completed source-version updates mark its PDF stale through the existing target state query. `sourceVersion` remains conservative project-wide invalidation. Capture failures release the in-process compile gate so a retry is possible.

This phase retains a revision/hash manifest, not historical source text or a source archive. Existing immutable build PDFs remain compilation-ID scoped. Rebuilding old source would require a separately approved retention policy. External writes that bypass revision/journal contracts are outside the consistency guarantee.

Run `npm run test:capture` for capture races and manifest invariants. `node test-entry-compilation.js` tests a concurrent save after capture against the actual assembled artifact, stale-state detection, and failed-build provenance. Enable the existing `RESUME_ENTRY_LIVE` flags for real MiKTeX plus PDF text extraction. Unit/model tests use mocked MongoDB; the opt-in deployment audit below verifies controlled live interleavings. Stress, crash durability, and failover require separate qualification.

### Opt-in live deployment audit

Set `CAPTURE_LIVE_AUDIT=1` and run `npm run test:capture-live`. This connects to the configured server but overrides the database name with a freshly generated `resume_eng_capture_audit_<uuid>`. Automatic index/collection creation is disabled in Mongoose; test inserts create only the new database's collections. Driver monitoring asserts every write stays in that namespace. Existing application documents and build histories are not modified. Audit records and temporary compiler-input reports/PDFs are retained for inspection; the test never drops a database.

The harness uses real controllers, journal operations and autosave manager writes, scheduling them at capture-read boundaries without substituting database responses. It checks edits, additions, deletions, file/folder renames, nested/empty folder changes, same-revision CAS writers, and three-attempt churn through a real temporary HTTP route. A test-only process wrapper hashes every reconstructed file immediately before invoking real MiKTeX, then compares those bytes/revisions with the saved manifest and extracts PDF text.

Verified on the configured MongoDB 8.0.13 standalone deployment: primary/majority reads were observed and accepted, all controlled interleavings passed, persistent edits returned HTTP 409 after six file collections with zero build records, and compiler-input hashes (including Unicode) matched the stored manifest. This is not a load/crash/failover qualification. Default-concern administration was unavailable on the standalone server; no explicit client write concern was configured. Replica-set durability/failover behavior and browser-native PDF rendering are not established by this audit.

The aggregate entry suite's native-preview test now asserts the actual iframe and exact build-specific URL. Its stale canvas-renderer expectation came from interrupted viewer work; no production viewer implementation changed during this audit.
