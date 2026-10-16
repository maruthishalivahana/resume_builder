# Tailoring reliability milestone — commit review, 2026-10-16

**Review prepared; nothing staged or committed.** The current worktree passes functional checks. A narrow milestone commit has not been proven to build independently on HEAD because earlier prerequisite changes remain uncommitted. Do not treat a successful whole-worktree build as that proof.

Base reviewed: `main` at `c680f659bcd3e729397912d178750cf90ca43e0b`. The starting worktree contained 54 modified tracked files plus many untracked files from prior milestones. Git's index was empty before and after preparation. No production implementation changed during this review; only this document and the accompanying manifest were created. Generated `backend/dist` was rebuilt for accurate testing.

## Exact review scope

`TAILORING-COMMIT-MANIFEST.json` lists 75 review-candidate paths, grouped by purpose, with SHA-256 snapshots. It is an allowlist for review, not a staging instruction. It includes grounding/retrieval/source integration, the development-only local highlight provider, regression tests, synthetic benchmark fixtures/reports and documentation. The review artifacts themselves are identified separately.

Changes reviewed include:

- Strict evidence-ID resolution and conservative extractive claim validation; provider null/error distinction with no deterministic filler.
- Shared lexical boundaries and scoped negation, plus explicit CI/CD paraphrase normalization.
- Original raw-source persistence, LF/CRLF mapping, unique-span highlights and stale-source checks.
- Local model selection of prevalidated candidate IDs, preserving persisted evidence IDs and rejecting unknown/extra fields. Local mode remains development/test-only, pinned to a cached model and numeric loopback HTTP origin, with no cloud fallback.
- Balanced removal of known non-content LaTeX arguments from extraction, keeping raw text/ranges intact and preserving link display text.
- Unchanged benchmark gold, separate metrics, additive unseen cases, and retained historical failure reports.

Review did not identify a new blocker in the latest candidate-selection or metadata-filter changes. This is a scoped code/test review, not an exhaustive security or production release review. Lightweight lexical reasoning, opaque custom macros, fixed placeholder confidence, bounded context, and limited synthetic coverage remain documented limitations.

## Commit dependencies and proposed order

1. **Land/review the earlier save and recovery foundation separately.** Current `SourcePatchService` imports `finalizeFileWrite` from the untracked `backend/src/services/latexWriteRecovery.service.ts` and uses uncommitted `LatexFile` revision/pending-write fields. Its acknowledgment also depends on earlier frontend save-manager integration. Those dependencies cannot be excluded while including the whole current source-patch file. This review does not authorize committing all autosave/tree/compiler work together.
2. **Grounding and raw-source reliability.** Manifest group `grounding-and-source`, associated safety tests, and the source-mapping hunks in `source-patch.service.ts` after its recovery prerequisite. Include the rawText model field and source-range utility together with both patch-creation callers. The latest metadata filter belongs with its parser import and regression test.
3. **Development-only local candidate selection.** Manifest group `local-highlight-provider`; matching provider/candidate tests; local setup documentation; only the relevant backend package script/README hunks. This depends on the highlight proposal/validator/source contracts in step 2. Existing cloud-provider changes are mock-tested only, not live-authorized for this milestone.
4. **Benchmark and verification evidence.** The benchmark fixtures/runners/metrics, tests, documentation and synthetic saved reports in the manifest. The current runner imports the local provider, so do not land it before that provider exists. Keep original gold and historical failed snapshots unchanged.

The boundaries above are a proposed review/commit sequence. No partial tree, staging index, temporary branch, cherry-pick or commit was created. Before an actual commit, select the prerequisite scope and verify the assembled staged tree from the chosen base.

### Files requiring hunk selection

- `backend/package.json`: tailoring/local-AI/benchmark commands are mixed with autosave/tree/restoration/compiler test commands.
- `backend/README.md`: accumulated documentation spans multiple milestones.
- `backend/src/modules/job-tailoring/services/source-patch.service.ts`: raw-source mapping changes coexist with Priority 1 revision/recovery behavior.

### Explicit exclusions

Do not include unrelated frontend navigation, tree rendering/restoration, compilation/PDF changes, root dependency changes, the Word document, or policy edits merely because they are dirty. Exclude ignored environment/credential files, `storage/`, runtime/model binaries, and loose `backend/jd-*`/audit artifacts containing broader earlier diagnostic material. The manifest only includes explicitly identified synthetic benchmark records; it does not authorize adding an entire directory recursively.

## Checks rerun on the actual current tree

Build first, because `test-tailoring.js`, `test-grounded.js` and `test-source-patch.js` read compiled `backend/dist`. A no-emit check alone would not refresh those tests' implementation.

Passed (exit 0):

```powershell
npm --prefix backend run build
node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json
node backend/test-tailoring.js
node backend/test-grounded.js
node backend/test-claim-validator.js
node backend/test-source-mapping.js
node backend/test-source-patch.js
node backend/test-highlight-generation.js
node backend/test-highlight-candidates.js
node backend/test-ollama-provider.js
node backend/test-evidence-negation.js
node backend/test-paraphrase-retrieval.js
node backend/test-noncontent-evidence.js
node backend/test-local-evaluation.js
node backend/test-unseen-evaluation.js
node backend/test-openrouter-provider.js
node backend/test-generation-diagnostics.js
node backend/test-tailoring-quality.js
node backend/test-jd-analysis-guards.js
node backend/test-autosave-recovery.js
npm --prefix backend run benchmark:tailoring:gate
node backend/benchmarks/tailoring/run.js --original --gate
node backend/benchmarks/tailoring/local-run.js --unseen --scripted
```

Seventeen tailoring suites plus the recovery suite passed. Existing consolidated benchmark: 85/85 observations, all gates true. Original gold gate passed. Unseen scripted gate: classification 20/20, relevant retrieval 15/15, eight useful edits, eight exact mappings, zero false supporting records. Scripted evaluation is not a new actual-model quality measurement.

Targeted lint command:

```powershell
node node_modules/eslint/bin/eslint.js backend/src/modules/job-tailoring/services/highlight-candidates.service.ts backend/src/modules/job-tailoring/services/highlight-edit.service.ts backend/src/modules/job-tailoring/providers/ollama-highlight.provider.ts backend/src/modules/job-tailoring/services/resume-evidence-parser.service.ts backend/src/modules/job-tailoring/utils/latex-evidence-text.util.ts backend/src/modules/job-tailoring/utils/evidence-negation.util.ts backend/src/modules/job-tailoring/utils/evidence-terms.util.ts backend/src/modules/job-tailoring/utils/source-range.util.ts backend/benchmarks/tailoring/local-run.js backend/benchmarks/tailoring/local-metrics.js backend/benchmarks/tailoring/unseen-metrics.js backend/benchmarks/tailoring/unseen-dataset.js backend/test-highlight-candidates.js backend/test-noncontent-evidence.js backend/test-unseen-evaluation.js backend/test-local-evaluation.js
```

Lint exited 0: zero errors, one unused CommonJS-disable comment warning in the frozen unseen fixture. Its bytes were deliberately left unchanged. Check logs are under ignored `storage/benchmarks/commit-review-*`.

### Historical fingerprint comparison

`npm --prefix backend run benchmark:tailoring:check` exits **1** because the reviewed historical baseline records an earlier implementation SHA-256. A deep comparison excluding only `implementationSha256` confirms every other field, case result and metric is identical. The historical baseline was not overwritten. This exact-snapshot command must not be reported as passing; use the functional gate results above for correctness. A newly reviewed implementation snapshot can be approved separately without relabelling gold cases.

No live model, browser, cloud API, database write, or production test was run in this review. OpenRouter requests were mocked. Earlier actual local-model/browser/MongoDB/MiKTeX evidence remains in the per-milestone reports. The user confirmed regular-browser embedded preview worked; automated direct Brave PDF rendering was verified earlier, while automated embedded-view comparison was interrupted. That distinction remains intact.

## Proposed commit summary

Title: `Harden grounded tailoring and benchmark exact-source highlights`

Body:

> Keep explicit abstention and provider failures separate, reject unsupported claims and invalid evidence references, and preserve exact LaTeX source in reviewed patches. Add scoped negation/concept matching, development-only local candidate-ID highlights, and extraction filtering for non-content LaTeX arguments.
>
> Add frozen deterministic and local-model evaluation fixtures with separate retrieval, classification, usefulness, abstention and source-mapping metrics. Preserve historical expectations and evidence of earlier failures.
>
> Validation: backend build/type checks, 17 tailoring suites, recovery regression, original/consolidated/unseen benchmark gates. Historical exact-baseline comparison differs only by implementation fingerprint; scoped lint has one unused-comment warning. Earlier live checks used isolated synthetic databases and a cached local model.

Use this summary for the full dependent milestone only after prerequisite commits are selected. Smaller commits should use titles matching their actual subset. No rewrite feature, public-release readiness, or authorization to commit is implied.
