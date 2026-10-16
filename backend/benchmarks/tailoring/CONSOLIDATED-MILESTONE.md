# Consolidated benchmark reliability milestone — 2026-10-15

All final deterministic acceptance gates pass. No bullet/summary rewriting, external inference, application startup, database write, or real-resume modification was performed.

## Baseline and sequence

Stage 0 used the actual working tree, which already contained an in-progress negation fix. It was not reverted to manufacture the older failure. The historical v1 `baseline.json` had 13/15 classifications; the actual Stage 0 had 14/15 because "No Python experience" was already CONFLICT/non-supporting. A separate Stage 0 reproduction found **"Python experience: none" still STRONG and supports=true**. Stage 1 fixes that remaining form, including structured-field and legacy-match bypasses.

| Measurement | Stage 0 | After Stage 1 | After Stage 2 | Final Stage 3 |
|---|---:|---:|---:|---:|
| Existing/new case IDs | 44/0 | 44/0 | 44/0 | 44/40 |
| Diagnostic observations passing | 44/45 (97.8%) | 44/45 (97.8%) | 45/45 (100%) | 85/85 (100%) |
| Exact classification | 14/15 | 14/15 | 15/15 | 40/40 |
| Retrieval recall / recall@3 | 12/13 | 12/13 | 13/13 | 33/33 |
| Retrieval precision | 12/12 | 12/12 | 13/13 | 33/34 (97.1%) |
| Verified STRONG recall | 9/10 | 9/10 | 10/10 | 21/21 |
| False-positive STRONG | 0/6 | 0/6 | 0/6 | 0/20 |
| False-negative STRONG | 1/9 | 1/9 | 0/9 | 0/20 |
| Missed contradictions | 0/1 | 0/1 | 0/1 | 0/5 |
| Unsupported semantic claims accepted | 0/7 | 0/7 | 0/7 | 0/11 |
| Invalid-reference probes accepted | 0/5 | 0/5 | 0/5 | 0/10 |
| Safe patches exact | 5/5 | 5/5 | 5/5 | 8/8 |
| Unsafe spans accepted | 0/4 | 0/4 | 0/4 | 0/5 |
| Stale-source patches rejected | 5/5 | 5/5 | 5/5 | 8/8 |
| Outcome distinctions correct | 5/5 | 5/5 | 5/5 | 5/5 |

The observation count is a diagnostic check count across separate stages, not a weighted quality score. One original fixture yields two requirements; one paraphrase failure affects multiple reported metrics but counts once in diagnostic observations. The new colon-negation probe was not in the original 44 fixtures, so Stage 1's unchanged original-corpus totals do not imply that no defect was fixed.

Stage 0/1 retained the known CI/CD paraphrase miss. Stage 1 safety suites passed before Stage 2 began. Stage 2 passed the full original-corpus gate before the dataset was expanded. Stage 3 initially exposed action-only overlap (staff schedules vs CI/CD pipelines: WEAK instead of MISSING); the classifier now requires a substantive matching term for related evidence. Its existing/new gold label was not changed. During test authoring, an initial new dashboard-viewing probe incorrectly expected support for pipeline maintenance; it was corrected to non-support on semantic grounds before the expanded corpus was created. No original gold assertion or expectation was altered.

Snapshots `milestone-results/stage0.json` through `stage3.json` retain each actual run. `dataset.js` and its SHA-256 `fbbfe5e9e8ffdb42339f58c4d11a4a10c2190326521c6eaa318626992387381e` remain unchanged. The runner verifies that hash against the original snapshot on every invocation.

## Changes by stage

**Stage 1:** `utils/evidence-negation.util.ts` recognizes explicit denied subjects, contractions, passive statements and `experience: none/nil`. Clause scope, exact technology boundaries and qualification checks avoid conflicts for unrelated technologies, prerequisites, double negatives and incidental phrases. `match-classifier.service.ts` reports CONFLICT with the contradictory evidence IDs retained. `evidence-validator.service.ts` excludes explicit denials from support. `grounded-generation.service.ts` repeats this check for older stored matches. `claim-validator.service.ts` prevents structured technology fields from laundering colon-form denials into bare positive skills. `test-evidence-negation.js` exercises real services, mixed evidence, stale classifications and LF/CRLF source preservation.

**Stage 2:** `utils/evidence-terms.util.ts` adds bounded lexical aliases for the explicitly paired integration/delivery concept and maintenance wording. It does not equate integration alone, deployment, a related product or expertise with CI/CD. `bm25-lexical-search.provider.ts` reuses the same normalization. Generic responsibility classification requires both the action and the relevant object terms; verification rejects action-only overlap. `test-paraphrase-retrieval.js` covers both directions, technology distinctions, negative aliases, irrelevant action overlap, BM25 ranking and continued strict rejection of semantic rewrites.

**Stage 3:** `expanded-dataset.js` appends 25 resume/JD fixtures, 11 claim/reference probes and 4 mapping probes: 40 new case IDs, 84 total, 40 requirements. Structures include categorized skills, experience items, opaque project macros, summaries, certifications, coursework, nested/multiline CRLF, mixed newlines, comments and math. Positive, missing, related, contradictory and explicitly ambiguous learning/proficiency/soft-skill cases have documented reasons. Structured technology fields are exercised at the validator boundary, where that schema supports them. Additions include missing/null/object/duplicate/out-of-set evidence references. `run.js` adds explicit negation/paraphrase slices, false-support counts and a strict zero-failed-gold gate, without lowering existing thresholds. `backend/package.json` adds focused test commands. Existing v1 and intermediate snapshots remain preserved; the current exact-reproduction reference is `consolidated-baseline.json`.

## Measured slices and interpretation

Final negation slice: **5/5 classifications**, zero missed relevant anchors, zero false support. Final paraphrase slice: **7/7 classifications**, zero missed anchors, zero false support. These are tagged subsets and can overlap. Technology distinctions: 6/6; deliberately ambiguous cases: 3/3 under conservative current conventions.

False positive supporting records: **0/19** measured negative/irrelevant requirement-record pairs. This metric was added in Stage 3; it is unavailable as a measured Stage 0–2 rate. The oracle counts irrelevant anchors and explicitly forbidden negative anchors, independently of the production detector. It does not label every partial or duration-conflicting record as wholly irrelevant: duration mismatch remains a classification conflict with related technology evidence, preserving the existing test contract. The one extra retrieval candidate is staff schedules matching the generic action; it is classified MISSING and never verified as support.

Verified coverage of all relevant evidence is **26/33**, while fully supporting STRONG recall is **21/21**. Relevant contradictory/partial records are useful for explaining matches but are intentionally not all eligible for generation. Raw source preservation: **33/33**. The strict validator accepted five supported controls and rejected 22 unsafe/policy/reference probes, including ten invalid-reference probes. No provider-quality metric is inferred from scripted proposals.

## Exact final commands and outcomes

From the repository root, all returned exit 0:

```powershell
npm --prefix backend run benchmark:tailoring
npm --prefix backend run benchmark:tailoring:gate
npm --prefix backend run benchmark:tailoring:check
node backend/benchmarks/tailoring/run.js --original --gate
```

The final build ran from `backend` as `npm run build` (exit 0). From `backend`, all following checks returned exit 0 after that build:

```powershell
node test-evidence-negation.js
node test-paraphrase-retrieval.js
node test-match.js
node test-hybrid.js
node test-tailoring-quality.js
node test-tailoring.js
node test-claim-validator.js
node test-grounded.js
node test-generator.js
node test-highlight-generation.js
node test-source-mapping.js
node test-source-patch.js
node test-m761-regression.js
node test-generation-diagnostics.js
node test-jd-provider-status.js
node test-jd-analysis-guards.js
node test-openrouter-provider.js
node test-ollama-provider.js
node test-autosave.js
node test-autosave-recovery.js
node node_modules/typescript/bin/tsc --noEmit
```

Targeted lint from the repository root (exit 0, zero warnings/errors after adding the established CommonJS import-rule annotation to the new fixture module):

```powershell
node node_modules/eslint/bin/eslint.js backend/src/modules/job-tailoring/utils/evidence-negation.util.ts backend/src/modules/job-tailoring/utils/evidence-terms.util.ts backend/src/modules/job-tailoring/services/match-classifier.service.ts backend/src/modules/job-tailoring/services/evidence-validator.service.ts backend/src/modules/job-tailoring/services/claim-validator.service.ts backend/src/modules/job-tailoring/services/grounded-generation.service.ts backend/src/modules/job-tailoring/providers/bm25-lexical-search.provider.ts backend/test-evidence-negation.js backend/test-paraphrase-retrieval.js backend/benchmarks/tailoring/run.js backend/benchmarks/tailoring/dataset.js backend/benchmarks/tailoring/expanded-dataset.js
```

An initial lint attempt reported only the new CommonJS fixture import; it was corrected locally without disabling other rules. The Stage 0 inline reproduction initially ran from the wrong module-resolution directory; rerunning from `backend` produced the documented results. Stage 0/1 global quality gates were not green because of the known paraphrase miss; final original and expanded gates are green. No unrelated frontend build was attempted.

## Safety, limitations and review readiness

Concept normalization is limited to retrieval/classification and denial detection. It never rewrites raw LaTeX, grants claim paraphrase permission or changes source patches. The claim validator was only strengthened. Unknown/ambiguous evidence IDs still reject the entire claim. Null remains NO_EDIT_NEEDED; provider errors remain PROVIDER_ERROR; no automatic retries/fallback prose were added. Revision, autosave/recovery, tree and compilation code were not modified.

This is a developer-authored synthetic development corpus, not an independently reviewed held-out sample after iteration. Explicit negation grammar and concept aliases remain bounded; arbitrary linguistic/temporal negation and unrestricted paraphrases are not established. The existing classifier still has conservative treatment of incidental negative wording; controls assert no spurious conflict rather than universal semantic understanding. No live provider, browser, database, compiler or multi-user load was tested in this milestone. No API costs or production-data writes occurred.

The scoped changes are ready for review/commit with all applicable deterministic gates passing. The broader worktree already contains previous milestone changes; stage only intended files/hunks after review. No commit was created. Passing these gates does not itself enable or implement rewriting or certify production readiness.
