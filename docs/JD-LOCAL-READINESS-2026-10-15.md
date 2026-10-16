# JD tailoring: local/private readiness pass

Scope selected by the user: local/private testing first, no paid requests. This pass addresses the remaining gaps in descending order of correctness risk. It does not certify general semantic rewriting or public deployment.

## High priority: matching and concurrency — fixed for tested cases

SQLite was present in source but classified MISSING. The generic classifier retained sentence punctuation (`sqlite.`); ranking and verification also used differently normalized terms and substring matching. A shared lexical utility now normalizes punctuation/known spelling aliases and tests whole tokens/phrases. Ranking, evidence verification, legacy lexical retrieval and generic classification use it. SQL/NoSQL, Java/JavaScript, Rust/robust and SQLite/SQL remain distinct. Generic experience/requirement filler is not supporting evidence.

Skills outside the technology registry can now match their explicit evidence text without adding another allowlist. Explicit skill matches do not by themselves establish production/professional experience or expertise: those qualifiers cap the result at PARTIAL when absent. Negated/introductory evidence is not promoted to STRONG. This remains lexical classification, not general semantic entailment; nuanced negation and compound requirements need further corpus expansion.

The singleton orchestrator previously owned a generation service with mutable last-rejection state. Each analysis now has its own generation service. A synchronized mocked concurrency test confirms provider failure and abstention reasons remain separate. No source-patch/revision/recovery contract changed.

## Medium priority: measured suggestion usefulness — verified in a bounded corpus

Deterministic production-pipeline corpus: **18/18 classifications**, **9/9 positive evidence paths survive**, **0/9 false STRONG classifications**. A two-evidence case checks both stable IDs survive and that the selected evidence produces exactly the intended LaTeX replacement. This measures the named fixtures, not population accuracy.

Real cached Qwen3 1.7B evaluation: **8/8 expected outcomes**, **4/4 useful supported highlights**, **0 unexpected suggestions**, **0 provider failures**. New supported cases: SQLite, Redis, Rust and Docker among multiple evidence records. Unsupported TensorFlow/production claims were stopped before inference. The model attempted already-bold/repeated selections; source guards rejected them. Thus the latter cases demonstrate guard behavior, not intelligent model abstention.

Cold request 12.3 s; subsequent measured inference roughly 2.5–3.5 s on this machine. Every accepted patch was checked for exact text preservation after removing only its bold formatting. Report: `backend/jd-local-quality-results.json`. No cloud/paid requests or database were used by this benchmark.

Full evidence-grounded bullet/summary rewriting **remains open and disabled in the local provider**. Previous trials invented claims; current claim validation deliberately rejects ambiguous paraphrases. This pass does not establish a safe rewrite capability, and did not weaken validation to increase suggestion counts. Local highlighting is usable for development; general rewrite quality is a separate acceptance gate.

## Real database verification

Used fresh database `resume_eng_local_quality_5dad741db5a5408baee57c639578f64b` on the actual standalone MongoDB deployment. Writes were monitored and asserted against that database. Existing `resume_eng` data and historical audit records were not modified or deleted.

- Concurrent analysis of two synthetic projects: A contains SQLite and gets STRONG plus one suggestion; B contains Java and gets MISSING plus zero suggestions.
- Match/project IDs checked in persisted records.
- Accepting A's suggestion against B is rejected with PROJECT_MISMATCH.
- Correct acceptance persists exactly `\\textbf{SQLite}`, increments content revision 0→1, completes recovery and marks the suggestion accepted.
- Acceptance retry returns revision 1 without applying a second change; B stays byte-identical at revision 0.

Report: `backend/jd-local-quality-db-results.json`. This is real DB/local-provider service verification, not an HTTP/browser load test. The status-race test uses mocks to force both completions into the vulnerable timing window.

## Local/private release safeguards and remaining gates

Existing local-provider development/test-only, numeric loopback, model pin, timeout, no cloud fallback, context bound, explicit approval and revision guards remain enabled and pass their suite. Public release is deferred by user decision: authentication/ownership, public hosting, retention/consent policy and production AI provider selection must be completed before exposing the app to other users. Conversational chat is independently configured and is not made offline by local JD mode.

No frontend production code changed in this pass. Previous browser acceptance/compilation and PDF-byte/text checks are recorded in `JD-LOCAL-PROVIDER.md`; browser rendering and MiKTeX were not rerun here. Long/complex resumes, unfamiliar macros, semantic paraphrases, broad user populations and sustained multi-user load remain unverified. Do not treat 8 synthetic cases as production readiness.

## Checks and changed files

Passed: new `test-tailoring-quality.js`; existing match, tailoring, grounded, source-patch, source-mapping, claim-validator, highlight-generation, m761-regression, ollama-provider, autosave, autosave-recovery, jd-analysis-guards and jd-provider-status suites. Backend build and backend/frontend source no-emit checks passed. Targeted TypeScript ESLint returned zero errors and three existing unused-parameter warnings in `providers/interfaces.ts`. Full Next production build was not rerun; known unrelated route-export failures are outside this backend change.

Production changes:

- `backend/src/modules/job-tailoring/utils/evidence-terms.util.ts` — shared lexical normalization/boundaries.
- `services/evidence-ranker.service.ts`, `services/evidence-validator.service.ts`, `providers/interfaces.ts` within the same module — consistent matching.
- `services/match-classifier.service.ts` — punctuation-safe unknown-skill matches and qualification guards.
- `services/tailoring-orchestrator.service.ts` — per-analysis generation status.
- `backend/package.json` — quality-test command.

Verification additions: `backend/test-tailoring-quality.js`, `backend/verify-local-quality.js`, `backend/verify-local-quality-db.js`, their two synthetic JSON reports and this document. No schema migration, frontend change, compiler change or save-manager change.

Run `npm --prefix backend run test:tailoring-quality` without DB/network. For deliberate live checks, start `npm --prefix backend run dev:local-ai`, then from `backend` set `JD_LOCAL_QUALITY=1` for `node verify-local-quality.js`, or `JD_LOCAL_QUALITY_DB=1` for `node verify-local-quality-db.js`. The latter creates and retains a fresh isolated database on every run; it never drops records.

Next acceptance gate: expand the fixed corpus using anonymized/synthetic examples before broadening generation. Require zero accepted invented claims, zero wrong-source patches, no project leakage, and report useful-suggestion rate separately from guard rejections. Enable semantic rewriting only after a separate evaluation demonstrates factual and source safety; no paid provider is automatically enabled.
