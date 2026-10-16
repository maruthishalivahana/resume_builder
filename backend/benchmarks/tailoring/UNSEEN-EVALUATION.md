# Unseen synthetic tailoring evaluation — 2026-10-16

**Outcome: evaluation completed; progression gate FAILED.** Do not start bullet or summary rewriting. A LaTeX label leaks into positive evidence and causes one false STRONG classification. No unsafe edit was generated because the literal-source guard abstained.

## Dataset and frozen expectations

`unseen-dataset.js` defines 20 new cases after the candidate-selection implementation. Labels and allowed spans were fixed before execution; production code and labels were not tuned afterward. The file SHA-256, recorded before execution and rechecked afterward, is `a7c02a06fa7da0c19959f51ce4790750df7cf6291697dd654d67273a7f8804e5`.

Coverage includes project bullets, categorized skills, summaries, coursework, multiple nested source files, CRLF/Unicode continuation, exact and paraphrased concepts, missing technologies, related technologies, qualified denials, introductory learning, unsupported production/expertise, opaque macro arguments, existing emphasis, and non-content labels. Every gold case documents its justification. Nine require STRONG matches, four PARTIAL, two CONFLICT, and five MISSING. Eight have useful editable highlight opportunities; twelve require no edit.

This is a developer-authored synthetic follow-up set unseen by production tuning in this run, not independent human validation or statistically representative real-user evaluation. Some distinction cases intentionally probe previously protected boundaries. No external provider, embedding API, database, browser or compiler was used here.

## Repeatable commands

From repository root:

```powershell
# No network/model/database; real deterministic pipeline, scripted first candidate:
node backend/benchmarks/tailoring/local-run.js --unseen --scripted

# Actual cached local model; separate runtime terminal:
npm --prefix backend run dev:local-ai
$env:JD_LOCAL_MODEL_EVAL='1'
node backend/benchmarks/tailoring/local-run.js --unseen
```

Both commands write unique reports under `storage/benchmarks/` and return **exit 1** for the known failing acceptance gates. Scripted mode blocks every fetch, does not simulate model quality, and never substitutes text when candidates are unavailable. Local mode permits only the numeric loopback model origin and its version/tags/chat endpoints. No model retries or fallback text are introduced.

Saved complete reports:

- `unseen-scripted-results.json`: run `fa13c39e-7fd4-4167-9d5b-d992588eace0`.
- `unseen-local-results.json`: actual model run `dce92910-4afa-4494-ab12-6e2ead557776`.

## Separate results

| Measurement | Deterministic/scripted | Actual local model |
| --- | ---: | ---: |
| Requirements extracted | 20/20 | 20/20 |
| Exact requirement classifications | 19/20 (95%) | 19/20 (95%) |
| False STRONG classifications | 1/11 non-STRONG cases | 1/11 |
| Missed STRONG classifications | 0/9 | 0/9 |
| Retrieved relevant anchors / all retrieved anchors | 15/16 (93.75%) | 15/16 |
| Retrieved relevant anchors / all relevant anchors | 15/15 (100%) | 15/15 |
| False supporting records across 7 MISSING/CONFLICT cases | 1 | 1 |
| Useful highlights / expected editable opportunities | 8/8 | 8/8 |
| Unnecessary edits / generated edits | 0/8 | 0/8 |
| Unexpected edits on no-edit cases | 0/12 | 0/12 |
| Exact source mappings / generated edits | 8/8 | 8/8 |
| Invalid generated evidence references | 0 | 0 |

There is no combined quality score. Counting reference validity does not evaluate arbitrary invented claims; the existing claim-validator regressions cover those adversarial inputs separately.

Local model details: cached qwen3:1.7b, Ollama 0.40.4, CPU, temperature 0, 30-second deadline. Eight actual inference calls, five deterministic no-candidate abstentions, seven upstream skips, zero model abstentions out of eight calls, zero provider timeouts/errors/invalid responses. Median 3,567 ms; p95/max 14,476 ms (eight samples, including cold load). The scripted pass made zero network requests; its timings are not inference latency. The temporary evaluation model was unloaded and stopped afterward.

## Confirmed failure and reproduction

Case `unseen-label-only`:

```tex
\section{Projects}
\item \label{Python} Wrote Perl tools.
```

JD: `Required: Python.`

Expected: MISSING, no relevant supporting evidence, no edit. Actual: STRONG, one retrieved and positively verified anchor (`resume:2:2`), no suggestion/no model call. The source guard prevents editing the label, but cannot repair the upstream match assessment.

Code-inspection explanation: `ResumeEvidenceParserService.cleanLatex` in `backend/src/modules/job-tailoring/services/resume-evidence-parser.service.ts` removes generic command names, then braces, without removing `\label` arguments as non-content. `Python` is consequently retained as evidence text. Retrieval, evidence validation and classification then see a technology mention. This is a newly exposed existing production defect, not a change to the implementation during this evaluation.

Recommended next scoped fix: exclude known non-content LaTeX command arguments from normalized evidence extraction while retaining raw source/ranges unchanged. Add label/reference/URL-destination distinction regressions before editing. Do not weaken source mapping, claim validation, or change expected results to accommodate the defect.

## Acceptance criteria fixed before execution

The runner requires: extraction 100%; classification at least 95%; zero false STRONG and false supporting records; retrieval recall at least 95%; useful editable opportunities at least 90%; zero unnecessary edits; valid evidence references; all generated source mappings exact; zero provider errors. **The zero-false-STRONG and zero-false-support gates fail.** Other gates pass. No broader generation feature is approved by these results.

## Changes and checks

Evaluation-only changes: added `unseen-dataset.js`, `unseen-metrics.js`, `test-unseen-evaluation.js`, the two saved reports and this document; extended `local-run.js` with explicit `--unseen` and `--scripted` modes and per-anchor/classification/reference observations. Existing fixtures and usefulness oracle are unchanged. Original gold SHA-256 was checked against the historical baseline. Both saved new reports match the frozen dataset hash.

Passed (exit 0):

```powershell
node backend/test-unseen-evaluation.js
node backend/test-local-evaluation.js
node backend/test-highlight-candidates.js
node backend/test-ollama-provider.js
node backend/test-claim-validator.js
node backend/test-grounded.js
node backend/test-source-mapping.js
node backend/test-source-patch.js
node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json
npm --prefix backend run benchmark:tailoring:gate
node node_modules/eslint/bin/eslint.js backend/benchmarks/tailoring/unseen-dataset.js backend/benchmarks/tailoring/unseen-metrics.js backend/benchmarks/tailoring/local-run.js backend/test-unseen-evaluation.js
git diff --check
```

Lint: zero errors, one unused CommonJS-disable comment warning in the frozen fixture file. Existing benchmark acceptance gates pass. The two new unseen evaluation commands exit 1 as documented. The harness regression verifies false positives, missed anchors, invalid references and empty denominators are counted correctly. Backend checks and deterministic regressions are distinct from the actual local-model run.

No production implementation, user data, compilation/PDF/chat/autosave/recovery code, schema, or database changed. No commit created. Evaluation tooling is ready for review; overall tailoring acceptance is blocked by the reproduced evidence-parsing defect.
