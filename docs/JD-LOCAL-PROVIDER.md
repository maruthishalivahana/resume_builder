# Development-only local JD highlights

Verified 2026-10-15. This is a limited development capability, not production readiness or a general resume rewriting model.

## Run locally

The existing ignored `backend/.env` now selects local JD generation:

```dotenv
NODE_ENV=development
TAILORING_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11435
OLLAMA_MODEL=qwen3:1.7b
OLLAMA_TIMEOUT_MS=30000
```

From the repository root, use separate terminals:

```powershell
npm --prefix backend run dev:local-ai
npm run dev:backend
npm run dev
```

Restart an already running backend to load changed environment settings. The helper starts the existing portable Windows runtime and cached model; it never installs, pulls, logs in, or enables an OS startup service. Missing runtime/model produces an error. The downloaded assets live under ignored `storage/local-ai/`; runtime verification is recorded in `runtime-verification.json` there.

JD requests use loopback HTTP only, CPU inference, cloud disabled, one runtime request at a time and a 4096-token context. The application never falls back to OpenRouter from this provider. **Conversational chat remains configured separately by `LLM_PROVIDER`; this does not make the entire application offline.** No hosted inference or paid requests were used in this verification.

To disable local JD generation safely, explicitly select `TAILORING_LLM_PROVIDER=deterministic` and restart the backend (no authored prose). Removing the override instead restores the existing global provider setting, which may be hosted. No database migration or record deletion is required.

## Contract and safeguards

The model selects only `{selection: null}` or `{selection: {candidateId}}`. Deterministic code extracts requirement-relevant literal candidates and prevalidates them with the existing LaTeX guard. Request-local candidate IDs map back to original evidence IDs and exact raw spans; unknown IDs, extra fields and duplicate input evidence IDs fail. The provider adapts valid selections to the existing highlight proposal contract. Its fixed confidence 0.5 is a placeholder, not a calibrated probability.

The provider rejects unexpected fields, incomplete output, invalid JSON, repetitive/overbroad selections, non-loopback URLs, other model tags, production mode and prompts over 3000 UTF-8 bytes. It never truncates evidence. Highlights are limited to eight words/100 characters. Existing grounding and source mapping enforce exact unique raw spans and reject labels, commands, braces, already-bold text and unsupported edits. Null stays null; failures become the existing unavailable result with deliberate UI retry. Source acceptance, revisions, autosave, conflict recovery and compilation are unchanged.

The model can still abstain unnecessarily or return an invalid candidate ID; downstream validation remains active. It cannot supply a new span. It does not author bullets, metrics, qualifications or summaries. Earlier browser observations below predate candidate selection; the current contract has deterministic and actual local-model verification, but has not been reverified in the browser. See [candidate-selection results](../backend/benchmarks/tailoring/CANDIDATE-SELECTION.md).

## Verification evidence

Real browser, real local model and real standalone MongoDB were used against a new isolated database `resume_eng_jd_audit_f3029c5b12f944bcbd069e1fb83d1eb9`, never the `resume_eng` database. A synthetic Python REST API sentence was entered through the editor and autosaved at revision 1.

- An unseen Python JD generated an exact `Python REST APIs` highlight in 4591 ms. Reject preserved revision 1 and the original source.
- A fresh analysis generated another valid highlight in 2611 ms. Accept persisted exactly the bold wrapper at revision 2, with no pending write.
- Actual MiKTeX compiled that revision successfully: compilation `6ad0be191d619ec667f33040`, 1412 ms, one page, 41406 bytes. Captured source hash matched persisted content; the requested compilation's PDF bytes matched the stored artifact hash. pypdf extracted the unique synthetic marker; pdfplumber identified the phrase in CMBX10 bold font. One overfull-box warning arose from the long synthetic marker.
- Stopping the runtime produced the browser's unavailable message and Retry Analysis button, no fallback prose. Restarting with the new helper and explicitly retrying reached the real model (14943 ms); its already-bold selection was rejected and source stayed unchanged.
- SQLite in the same evidence was classified MISSING before generation. This is an observed retrieval/classification limitation, not fixed here.

Snapshots: `backend/jd-local-provider-final-f3029c5b12f944bcbd069e1fb83d1eb9.json`, `backend/jd-local-provider-rejected-f3029c5b12f944bcbd069e1fb83d1eb9.json`, `backend/jd-local-provider-after-retry.json`, `backend/jd-local-provider-build.json`. Browser screenshots: `backend/jd-local-provider-browser-accepted.png`, `backend/jd-local-provider-browser-unavailable.png`.

Mocked/deterministic suites passed: ollama-provider, grounded, source-patch, claim-validator, highlight-generation, generation-diagnostics, jd-provider-status, jd-analysis-guards, openrouter-provider, source-mapping, m761-regression, tailoring, autosave, autosave-recovery. Source-mapping initially inherited the new local override; its fixture now explicitly selects its mocked deterministic provider, and rerun passed. No live conflict/concurrent-save stress test was repeated here.

Backend build, backend no-emit TypeScript, frontend source-only no-emit TypeScript, targeted ESLint for the provider/config, JavaScript syntax checks and targeted diff whitespace checks passed. Full Next production build was not rerun; unrelated pre-existing route export failures remain outside this task. Native browser PDF visual rendering was not verified; parsed artifact correctness is verified separately. Broader resume/JD quality, large-context usefulness, multi-user performance and production deployment remain unverified.

## Files changed for this capability

- `backend/src/modules/job-tailoring/providers/ollama-highlight.provider.ts`: local selection adapter.
- `backend/src/modules/job-tailoring/config/tailoring-provider.config.ts`: JD-specific provider override and local branch.
- `backend/.env.example`, ignored `backend/.env`: explicit development configuration.
- `backend/start-local-ai.js`, `backend/package.json`: startup/test commands.
- `backend/test-ollama-provider.js`: contract, safety, failure and alias mapping regression tests.
- `backend/test-source-mapping.js`: isolate its mocked provider from development configuration.
- This guide and retained synthetic verification artifacts. No frontend production files, save manager, compiler pipeline or database schema changed for this capability.
