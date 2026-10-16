# Non-content LaTeX evidence fix — 2026-10-16

## Root cause and change

`ResumeEvidenceParserService.cleanLatex` stripped a generic command name and braces separately, leaving a label key such as Python as ordinary resume text. The unseen case `\item \label{Python} Wrote Perl tools.` consequently retrieved positive Python evidence and classified STRONG.

The parser now builds an extraction-only view using `maskLatexEvidenceMetadata`. Known label/reference/citation keys, bibliography/graphics paths, bare URL arguments, and hyperlink destinations are masked before heading recognition, normalization and technology/entity extraction. Link display text stays available. The scanner balances nested groups, handles starred commands/options/comments/escaped braces, and masks across lines. Unsupported unbraced forms exclude the rest of that line with a warning; unclosed groups/options exclude remaining source from evidence with a warning. Unknown macro handling remains as before; this is not a complete TeX interpreter.

The view preserves UTF-16 length and exact newline positions. Raw text and source ranges continue to come from the original source. Metadata-only continuation lines do not split a pending bullet. No source content, revisions, acceptance logic, or recovery mechanism is changed. Bare URLs are conservatively excluded as addresses, not promoted to proof of skills.

## Files changed in this task

- `backend/src/modules/job-tailoring/services/resume-evidence-parser.service.ts`: use masked extraction lines; preserve original raw capture and metadata-spanning bullet boundaries; report parser warnings.
- `backend/src/modules/job-tailoring/utils/latex-evidence-text.util.ts`: bounded known-command argument scanner.
- `backend/test-noncontent-evidence.js`: 18 command cases plus LF/CRLF mapping, links, malformed syntax, comments, token boundaries and positive controls.
- `backend/benchmarks/tailoring/noncontent-scripted-results.json` and `noncontent-local-results.json`: new reports, preserving previous failed reports.
- This document.

The parser's earlier `sourceLineRange` change already existed before this task and was retained.

## Unchanged gold, before and after

Both scripted and real local-model runs used the same 20-case unseen dataset and usefulness oracle as the failed evaluation. Hashes match the saved pre-fix report. No label or assertion was changed to make the fix pass.

| Metric | Before | After (scripted and local model) |
| --- | ---: | ---: |
| Exact classifications | 19/20 | 20/20 |
| False STRONG cases | 1/11 | 0/11 |
| Relevant / retrieved anchors | 15/16 | 15/15 |
| Retrieval recall | 15/15 | 15/15 |
| False supporting records | 1 | 0 |
| Useful highlights | 8/8 | 8/8 |
| Unnecessary edits | 0/8 | 0/8 |
| Exact source mappings | 8/8 | 8/8 |
| Invalid generated evidence references | 0 | 0 |

All unseen acceptance gates now pass. The existing consolidated deterministic benchmark also passes all gates (85/85 observations). These small developer-authored examples do not establish general semantic accuracy or production readiness.

Actual local run: `40520473-2e38-4063-8fc2-2edc94f493f6`; cached qwen3:1.7b / Ollama 0.40.4, CPU, eight inference calls, no provider errors/timeouts/invalid responses. Four no-candidate outcomes and eight upstream skips are distinct from zero model abstentions. Median 3,618 ms; max/p95 11,458 ms including cold load. Runtime unloaded/stopped afterward. Scripted run: `da76e1a2-e1f1-4d93-a173-cf10767f49a9`, zero network requests. The scripted candidate selection does not simulate model quality.

## Commands and observed results

Before edits, the unseen scripted command exited 1 for the label-only false match; the existing benchmark exited 0. After edits, all commands below exited 0:

```powershell
node backend/test-noncontent-evidence.js
node backend/test-source-mapping.js
node backend/test-source-patch.js
node backend/test-claim-validator.js
node backend/test-grounded.js
node backend/test-highlight-generation.js
node backend/test-highlight-candidates.js
node backend/test-ollama-provider.js
node backend/test-evidence-negation.js
node backend/test-paraphrase-retrieval.js
node backend/test-unseen-evaluation.js
node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json
npm --prefix backend run benchmark:tailoring:gate
node backend/benchmarks/tailoring/local-run.js --unseen --scripted
node node_modules/eslint/bin/eslint.js backend/src/modules/job-tailoring/services/resume-evidence-parser.service.ts backend/src/modules/job-tailoring/utils/latex-evidence-text.util.ts backend/test-noncontent-evidence.js
git diff --check
```

Actual local inference, with cached runtime started in a separate terminal:

```powershell
npm --prefix backend run dev:local-ai
$env:JD_LOCAL_MODEL_EVAL='1'
node backend/benchmarks/tailoring/local-run.js --unseen
```

Lint: zero errors/warnings for the changed production files and focused test. Deterministic suites preserve strict claims, evidence references, abstention, negation and source patch safeguards. Saved actual-model metrics were recomputed from raw rows and matched exactly.

## Persistence and remaining limits

No migration, database connection/write, paid/cloud request, real resume edit, or browser/compiler execution occurred in this task. Fresh structured analysis calls `ResumeIntelligenceService.buildEvidence`, which reparses current files. Existing stored analyses/evidence are not automatically rewritten. Explicit `indexResume` reparses and replaces stale evidence IDs under its existing project/version scope; using that path against real data was not part of this verification. No historical records were modified.

Unknown/custom macro semantics and arbitrary TeX expansion remain outside this lightweight parser. Malformed known metadata fails conservatively and can suppress later evidence; warnings describe that choice. Live MongoDB reindexing and browser behavior after this parser change remain unverified. Bullet/summary rewriting was not started. Ready for review; no commit created.
