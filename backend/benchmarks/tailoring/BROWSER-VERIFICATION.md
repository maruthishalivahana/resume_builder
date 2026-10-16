# Candidate highlight browser verification — 2026-10-16

Scope: actual browser interactions, cached local Ollama model, isolated local MongoDB and MiKTeX. No production behavior changed. No paid/cloud calls or writes to `resume_eng`.

## Isolation and reproduction

Synthetic database: `resume_eng_browser_1cd389e365a847838bdb371b1c87c62a`.
Project: `6ad17b66853088a284df148f`; file: `6ad17b67853088a284df1491`.
Backend: port 5001; frontend: port 3001, source copy under `storage/browser-workspace-1cd389e3`. The ordinary app was left running. The source copy was required because installed Next.js rejects a second dev server in the same checkout, even with a custom build directory. A failed junction creation was unnecessary; module resolution used the parent repository dependencies.

`browser-session.js` is an opt-in synthetic harness. `JD_BROWSER_VERIFY=1` creates a fresh database; `JD_BROWSER_RESUME` can point to its saved session JSON to continue that same test database. Resumed database names must match the dedicated synthetic prefix and UUID pattern. The harness monitors database write command names and blocks fetches outside the numeric loopback model origin. This verification only changed the harness to support resuming; no application implementation was edited.

```powershell
# backend directory, separate terminal:
$env:JD_BROWSER_VERIFY='1'
$env:JD_BROWSER_RESUME='C:/Users/kumma/OneDrive/Desktop/resume_builder/storage/benchmarks/browser-1cd389e3-65a8-4783-8bdb-371b1c87c62a/session.json'
node benchmarks/tailoring/browser-session.js
# repository root, separate terminals:
$env:NEXT_PUBLIC_API_URL='http://localhost:5001'
node node_modules/next/dist/bin/next dev storage/browser-workspace-1cd389e3 --port 3001 --webpack
npm --prefix backend run dev:local-ai
```

## Verified observations

1. Browser analysis of SQLite and Docker generated two literal highlights. Rejecting Docker left exact original source/revision 0. Accepting SQLite inserted only `\textbf{SQLite}` at revision 1; the editor showed Saved and Applied.
2. Browser Compile invoked MiKTeX successfully. Build `6ad17c5a853088a284df14e6` captured revision 1, source version 1. Saved content SHA-256 `60f9b5733ac63afadade22e99a16779ff7c10e7d414380830a35ca8b75f99639` equals the captured manifest entry.
3. Browser frame requested `/api/latex/projects/6ad17b66853088a284df148f/pdf?compilationId=6ad17c5a853088a284df14e6`. Endpoint returned application/pdf, 41,055 bytes. Download SHA-256 `cb898a0b4e1e60d82688cce145b43a9c6ceddf336d4eb2b9215a3896ba8260c1` equals the stored build artifact.
4. pypdf parsed one page and found `BROWSERCANDIDATE731`. pdfplumber confirmed SQLite uses the bold CMBX font and Docker does not. Poppler rendering was visually inspected: legible text, bold SQLite, correct spacing, no clipping. Text extraction joins words adjacent to the font change (`withSQLitefor`); the visual PDF spacing is correct.
5. On continuation, the synthetic file was at revision 3 with the same accepted content. An initial hardcoded expected-revision-1 setup stopped without writing. A fresh GET then revision-checked PATCH changed only the Docker bullet to Git at revision 4. Clicking the pending Docker suggestion's Accept in the browser returned HTTP 409 and `SOURCE_CHANGED: The resume content changed and the source text was not found`. The UI retained Pending Review and refreshed to the concurrent Git content. GET confirmed exact concurrent source/revision 4 remained intact. This tests changed target text, not a rule rejecting every revision change: unchanged anchors may deliberately relocate safely under the existing service contract.
6. Stopping the exact portable local model process and analyzing Git produced zero suggestions, “Suggestion generation unavailable,” and “Retry Analysis.” No fallback prose appeared. Restarting that same cached model and clicking Retry Analysis produced exactly one pending `\textbf{Git}` proposal. GET confirmed source remained byte-identical at revision 4 through failure and retry.

## Artifact evidence

All under `storage/benchmarks/browser-1cd389e3-65a8-4783-8bdb-371b1c87c62a/`:

- `requests.jsonl`: actual API request status/content-type log, including acceptance HTTP 409.
- `after-reject.json`, `after-accept.json`: original browser review states.
- `compilation.json`, `accepted.pdf`, `pdf-verification.json`, `pdf-render.png`: exact build, bytes, parsed text/font checks and visual render.
- `concurrent-save.json`, `after-stale-accept.json`, `after-provider-retry.json`: unchanged revision-4 content after rejection/failure/retry.
- `accepted.png`, `compiled.png`, `stale-source.png`, `unavailable.png`, `retry-success.png`: browser evidence.

## Checks run during continuation

Passed:

```powershell
node backend/test-ollama-provider.js
node backend/test-source-patch.js
node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json
node node_modules/eslint/bin/eslint.js backend/benchmarks/tailoring/browser-session.js
git diff --check
```

Actual PDF parser/font assertions and source/artifact SHA-256 assertions also passed. Provider/source-patch suites are deterministic regressions; browser/API/MongoDB/model/MiKTeX observations above were live against the isolated synthetic environment.

## Remaining verification gap

The in-app browser's native PDF frame was visually blank despite the correct compilation ID, HTTP 200 application/pdf response, and valid rendered artifact. These observations do not establish whether the cause is embedded-browser PDF support or a viewer integration defect. No renderer or compiler change was justified or implemented here. Cross-check the exact build URL in a PDF-capable regular browser before declaring the visual preview verified. Broader real-user/resume generalization and production readiness are not established by this synthetic workflow.

Temporary test services are stopped after verification; the database, source copy, PDFs, logs and screenshots are retained. No commit created.
