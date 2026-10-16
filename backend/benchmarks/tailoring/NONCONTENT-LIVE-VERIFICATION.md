# Live non-content evidence verification — 2026-10-16

**Result: label-only browser analysis, visible-text positive control, and scoped live reindexing passed.** This closes the specific browser/persistence gap documented in `NONCONTENT-EVIDENCE-FIX.md`; it does not establish general production readiness.

## Environment and isolation

- Fresh local MongoDB database: `resume_eng_browser_21e18500b42d4687a9588f10fc94e653`.
- Synthetic project/file: `6ad1ec05834d2552bbb910d1` / `6ad1ec05834d2552bbb910d3`.
- Updated real Express backend on loopback port 5001; existing isolated frontend copy on port 3001; actual in-app browser interaction.
- Actual cached qwen3:1.7b model through local Ollama, cloud disabled. The backend harness blocks fetches outside the numeric loopback model origin. Conversational provider is deterministic in this harness.
- Database command monitoring asserts writes remain in the fresh synthetic database. No real resume data or `resume_eng` writes. No migration or production code changes in this verification.

## Verified results

1. Saved the exact source `\item \label{Python} Wrote Perl tools.` using the revision-checked file API. Seeded an intentionally stale evidence record containing normalized `Python Wrote Perl tools.` and Python technology metadata, plus separate project/version controls.
2. Submitted `Required: Python.` through the browser JD Tailor interface. The browser displayed MISSING, zero safe suggestions and the no-safe-suggestions state. Persisted match/suggestion queries confirmed the same outcome. Source content and revision remained unchanged by analysis.
3. The ordinary browser analysis flow automatically called `/api/tailoring/resume/index` before embedding/index/analysis. The stale evidence record was already removed. Code inspection confirms `analyzeJobDescription` calls `indexTailoringResume` in `hooks/use-resume.tsx`, which posts this existing endpoint through `lib/api/tailoring.ts`.
4. Independently reseeded the synthetic stale record, verified its existence, and called `/api/tailoring/resume/index` explicitly. The record was removed; replacement text was `Wrote Perl tools.` with no Python technology metadata. Its original raw `\label{Python}` source and line-5 anchor were retained. Source content/revision stayed unchanged. Other-project and other-version evidence controls both survived.
5. Changed source through the actual browser CodeMirror editor to `\item \label{work} Wrote Python tools.` and observed Saved. The neutral label keeps Python's editable raw span unique; no duplicate-span safeguard was weakened.
6. Submitted the same Python requirement again. Actual local-model generation returned a STRONG match and one pending suggestion. Before/after assertions confirmed the only proposed change was `Python` to `\textbf{Python}`; `\label{work}` was unchanged. GET confirmed the proposal remained unapplied and saved source was exact.

An initial verification-script assertion expected the seeded record to survive the first browser analysis. It failed because normal analysis already reindexes. Inspection of actual request logs and frontend code corrected this harness assumption. The error is preserved in `previousHarnessErrors`; the negative check was rerun successfully, and a freshly seeded record demonstrated explicit endpoint recovery independently. Production behavior and gold expectations were not changed to pass a test.

## Files and evidence

- Added `backend/benchmarks/tailoring/noncontent-live.js`: opt-in synthetic preparation, persisted browser-result assertions, and explicit reindex verification.
- Added `backend/benchmarks/tailoring/noncontent-live-results.json`: saved actual results, including the initial harness assumption error.
- Added this report. No production implementation changed in this task.

Retained under `storage/benchmarks/browser-21e18500-b42d-4687-a958-8f10fc94e653/`: `session.json`, `requests.jsonl`, `noncontent-live.json`, `label-missing.png`, `visible-python-strong.png`. The synthetic database is retained; no cleanup deletion was performed. Temporary test backend and model were stopped/unloaded; the pre-existing frontend was left running.

## Commands and checks

From `backend`, with the fresh isolated browser-session backend running:

```powershell
$env:JD_NONCONTENT_LIVE='1'
node benchmarks/tailoring/noncontent-live.js ../storage/benchmarks/browser-21e18500-b42d-4687-a958-8f10fc94e653/session.json prepare
# After submitting the label-only Python JD in the browser:
node benchmarks/tailoring/noncontent-live.js ../storage/benchmarks/browser-21e18500-b42d-4687-a958-8f10fc94e653/session.json negative
node benchmarks/tailoring/noncontent-live.js ../storage/benchmarks/browser-21e18500-b42d-4687-a958-8f10fc94e653/session.json reindex
# After editing/saving the positive control and submitting the JD in the browser:
node benchmarks/tailoring/noncontent-live.js ../storage/benchmarks/browser-21e18500-b42d-4687-a958-8f10fc94e653/session.json positive
```

The session must be a fresh dedicated synthetic database for preparation; do not replay `prepare` or point this at real data. Positive/negative modes inspect analyses actually submitted through the UI. All final mode checks exited 0; the superseded initial negative assertion exited 1 as described above. Positive verification was repeated with exact source/patch assertions and passed.

Also passed from root:

```powershell
node backend/test-noncontent-evidence.js
node backend/test-source-mapping.js
node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json
node node_modules/eslint/bin/eslint.js backend/benchmarks/tailoring/noncontent-live.js
git diff --check -- backend/benchmarks/tailoring/noncontent-live.js
```

Lint reported zero errors/warnings. Parser/source-mapping checks are deterministic; MongoDB indexing, saved browser analysis, and positive generation above were live. Compilation/PDF preview and arbitrary macro expansion were not retested in this task. Historical completed analyses remain historical; rerunning ordinary JD analysis performs the existing reindex step. No commit created and no rewriting feature started.
