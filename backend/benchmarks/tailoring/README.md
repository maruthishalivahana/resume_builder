# Evidence-grounded tailoring benchmark v1

> Historical v1 baseline below. The consolidated milestone now passes both the preserved original gold corpus and the additive v2 corpus. See [CONSOLIDATED-MILESTONE.md](./CONSOLIDATED-MILESTONE.md) for current commands, results and limitations. `baseline.json` remains the original failing snapshot; `consolidated-baseline.json` is the current reproducibility reference. The default runner now evaluates v2; `--original --gate` evaluates the unchanged original fixtures.

Baseline captured 2026-10-15. This is a small synthetic diagnostic benchmark, not a model-quality or production-readiness claim. No production service was changed to obtain these results. No rewriting capability was implemented.

## Commands (repository root)

```powershell
npm --prefix backend run benchmark:tailoring
npm --prefix backend run benchmark:tailoring:check
npm --prefix backend run benchmark:tailoring:gate
node backend/benchmarks/tailoring/run.js --case paraphrase-maintenance
node backend/benchmarks/tailoring/run.js --case negated-skill
```

- `benchmark:tailoring`: collect all results, including quality failures. Exit 0 means collection completed without a safety regression; it does **not** mean every acceptance threshold passed. Unsafe acceptance, wrong patches, wrong error distinctions, fallback use or network attempts return 1.
- `:check`: compare the entire deterministic result with reviewed `baseline.json`, including existing failures. Current result: exit **0**, exact reproduction. Source fingerprint changes also require review; never automatically overwrite this baseline to turn failures green.
- `:gate`: enforce every separate acceptance threshold. Current result: exit **1**, expected because retrieval/classification are below threshold.
- `--case ID`: reproduce one fixture. IDs are listed below and in `dataset.js`. Cannot be combined with a whole-corpus gate or baseline check.

Use the direct Node commands for case selection on PowerShell: the installed npm PowerShell wrapper consumed `--case` during verification rather than forwarding it. The three package-script commands do not require argument forwarding.

Results are written to ignored `storage/benchmarks/tailoring-latest.json`, or `tailoring-<ID>.json` for individual fixtures. The reviewed baseline lives alongside this README. Reports contain the dataset hash and a normalized source hash of the job-tailoring module; no timestamp, latency, random ID or machine path enters the compared report. The console prints the output location.

Uses existing installed dependencies and `tsx/cjs`, so the benchmark loads **current source**, not stale `dist`. It never creates a provider from `.env`, calls a model, starts an application, connects to MongoDB or compiles a PDF. Fetch, socket connections and Mongo connection entry points are blocked; Mongoose buffering is disabled. No database writes, paid calls or cloud calls occur.

## Architecture exercised and limits

Retrieval cases invoke the real requirement extractor, LaTeX parser, evidence ranker, legacy lexical + empty-vector retrieval, evidence validator and match classifier used by `TailoringOrchestratorService`. Classifier input remains ranked evidence, matching production behavior. This does not substitute the separate BM25/embedding API for the orchestrator's pipeline.

Claim cases invoke the strict production validator directly. Mapping and outcome cases use **scripted providers** through the real grounded-generation service, followed by exact-source patch creation/application. Mapping isolates that stage with an explicit eligible match; it does not claim that every case independently passes upstream retrieval. The scripts intentionally submit adversarial `rewrite`-shaped proposals to test rejection; they do not implement rewriting or measure an LLM's ability to author text.

Source patches are applied in memory after validation, not committed through MongoDB or accepted in a browser. Revision-checked acceptance/recovery is covered separately by the existing `test-autosave-recovery.js` regression suite, run alongside this benchmark. No new live database/browser/MiKTeX verification was performed for this milestone. There is no end-to-end model suggestion rate in this report.

## Dataset and gold-label policy

`dataset.js` is the executable versioned dataset: **44 case IDs**, including 14 resume/JD fixtures yielding 15 requirements, 16 claim probes, 9 mapping probes and 5 outcome probes. All text is synthetic. Gold evidence uses **file ID plus original line range**, independently of generated evidence IDs, scores or parser output. A missed parse therefore counts as missing evidence rather than disappearing from the denominator. Raw bytes are compared using each fixture's specified LF/CRLF convention.

Relevant evidence includes partial and contradictory evidence useful for explaining a requirement. It is not synonymous with safe support for a generated claim. Verified recall for **gold STRONG requirements** is separately gated; coverage of all relevant evidence is diagnostic only.

| Resume/JD fixture ID | Intended evidence/structure | Expected classification |
|---|---|---|
| sqlite-punctuation | SQLite in a coursework bullet, period in JD | STRONG |
| java-vs-javascript | JavaScript does not establish Java | MISSING |
| sql-vs-nosql | NoSQL does not establish SQL | MISSING |
| missing-kubernetes | Python scripts, no Kubernetes | MISSING |
| related-react-native | React Native is related to React, not equivalent | PARTIAL |
| production-qualification | Node.js coursework does not establish production work | PARTIAL |
| paraphrase-maintenance | Keeping continuous integration/delivery workflows running supports maintaining CI/CD pipelines | STRONG |
| paraphrase-leadership | Led a software team supports lead a team | STRONG |
| negated-skill | Explicit "No Python experience" contradicts Python requirement | CONFLICT |
| multi-file-multi-evidence | Two SQLite evidence records, separate Docker record, irrelevant Java file; required/preferred JD headings | STRONG for both requirements |
| formatted-crlf | Bold Node.js, REST APIs, multiline CRLF in nested path | STRONG |
| skills-label | Redis outside a bold Tools label | STRONG |
| education | Bachelor of Science degree | STRONG |
| custom-macro | Python within a resumeItem macro | STRONG for matching; opaque macro arguments are not editable |

Claim probes cover exact supported statements/formatting/metrics, invented technologies, production, metrics, expertise, awards, lost qualifications, transferred metric meaning, and five invalid-reference combinations (mixed unknown, unknown-only, empty, malformed and outside the supplied evidence set). One paraphrase is deliberately rejected under current conservative policy: "Implemented REST APIs" is not accepted as a rewrite of "Built REST APIs". This policy case is reported separately from seven unsupported semantic claims; it is not evidence that all paraphrases are false. Three supported controls are exact/extractive, not a representative paraphrase corpus.

Mapping gold outputs specify whole expected files, not just the inserted word. Valid cases: LF, multiline CRLF, formatting around the span, Unicode, and identical source in a different file. Reject cases: label braces, already-bold text, repeated span, opaque custom macro. Each valid case also changes the original source and requires SOURCE_CHANGED on stale application. All nine fixtures must actually parse their intended target, so parser failure cannot count as a successful unsafe-span guard.

Outcome probes require exactly one primary call and zero fallback calls: null→NO_EDIT_NEEDED; thrown timeout→PROVIDER_ERROR; malformed proposal→INVALID_PROVIDER_OUTPUT; unsupported claim→CLAIM_VALIDATION_FAILED; valid highlight→suggestion with no rejection reason.

## Baseline results — separate metrics

| Metric | Baseline |
|---|---:|
| Gold requirements extracted | 15/15; 0 extras |
| Retrieval micro precision | 12/12 = 100% |
| Retrieval micro recall / recall@3 | 12/13 = 92.3% |
| Relevant evidence missed | 1 |
| Verified coverage of all relevant evidence | 11/13 = 84.6% |
| Verified recall for STRONG requirements | 9/10 = 90% |
| Raw source preserved at gold anchors | 13/13 |
| Exact classification | 13/15 = 86.7% |
| False-positive STRONG | 0/6 non-STRONG gold requirements |
| False-negative STRONG | 1/9 STRONG gold requirements |
| Missed explicit contradictions | 1/1 |
| Unsupported semantic claims accepted | 0/7 |
| Invalid evidence-reference probes accepted | 0/5 |
| Conservative paraphrase policy violations | 0/1 |
| Supported controls rejected | 0/3 |
| Valid edits mapped byte-exactly | 5/5 |
| Unsafe spans accepted | 0/4 |
| Wrong accepted patches | 0 |
| Stale source rejected | 5/5 |
| Outcome distinctions correct | 5/5; 0 fallback calls |

Micro retrieval counts are summed across requirement/evidence pairs. Recall@3 uses the first three records returned by the production retrieval path. False positives/negatives use STRONG as the fully-supported boundary; the full five-class confusion matrix is also saved, so PARTIAL versus CONFLICT mistakes are not hidden by that binary boundary. No weighted or combined score is produced.

## Observed failures and diagnostic observations

1. **`paraphrase-maintenance`**: JD "Maintain CI/CD pipelines."; evidence "Kept continuous integration and continuous delivery workflows running." Both the source anchor and its raw text are parsed correctly, but retrieval returns no evidence and classification is MISSING instead of gold STRONG. This creates one retrieval miss, one verified-support miss and one classification failure; it is **one fixture**, not three independent quality failures. Exact-token matching lacks this paraphrase/acronym relationship. Reproduce with the command above.
2. **`negated-skill`**: JD "Python."; evidence "No Python experience; built Java tools." The evidence is retrieved, but classification is PARTIAL instead of gold CONFLICT. The classifier's existing conflict detector covers durations; negation prevents STRONG but does not produce CONFLICT. This is a classification gap, not an observed accepted fabricated claim.
3. **`production-qualification`**, diagnostic only: classification correctly stays PARTIAL, but no evidence survives the score threshold for generation. Relevant Node.js coursework does not fully support production work, so suppressing generation is conservative and is **not counted as a missed fully-supported claim**. Its coverage loss is visible separately.

These outcomes were retained; production services and gold labels were not relaxed to make the gate pass.

## Gate before proceeding to bullet rewriting

All thresholds must pass independently on the complete corpus:

- Requirement recovery and raw-source preservation: 100%, no extra requirements.
- Retrieval recall, recall@3 and verified recall for STRONG requirements: at least 95% each; retrieval precision at least 90%.
- Exact classification at least 90%; false-negative STRONG at most 5%; zero false-positive STRONG and zero missed explicit contradictions.
- Zero unsupported/policy-violating proposals or invalid references accepted; zero supported controls rejected.
- Every expected safe patch byte-exact, every unsafe mapping fixture rejected, every stale source rejected; no wrong-file edit.
- All outcome distinctions correct, one attempt per fixture, zero fallback/network calls.

**Current gate fails. Do not proceed to enabling bullet rewriting.** This small corpus is a necessary regression gate, not sufficient evidence for enabling rewriting. Before implementing/evaluating a candidate rewrite capability, expand and review a separate held-out set (at least 30 requirements across 10 synthetic/anonymized resume/JD pairs and five LaTeX structures), then require the same gates. Before user-facing enablement, independently review proposed rewrites for factual meaning, lost qualifiers and correct accepted-source/PDF output; no automatic provider switch or validator relaxation is authorized by a benchmark pass.

## Verification performed

`npm --prefix backend run benchmark:tailoring`: exit 0, collected baseline with the failures above. `benchmark:tailoring:check`: exit 0, exact deterministic reproduction. `benchmark:tailoring:gate`: exit 1, correctly blocks progression. Both named failure cases were run individually.

Existing suites run from `backend`: `node test-tailoring-quality.js`, `node test-grounded.js`, `node test-claim-validator.js`, `node test-source-mapping.js`, `node test-source-patch.js`, `node test-autosave-recovery.js`, `node test-m761-regression.js` — all exit 0. Backend `node node_modules/typescript/bin/tsc --noEmit`, targeted benchmark ESLint and JavaScript syntax checks pass. Existing `dist`-based suites use the backend build from the preceding implementation pass; production source has not changed during this benchmark milestone.

Only `backend/package.json` and this benchmark directory were changed for this task; generated latest reports are under ignored storage. Compilation, preview, chat, UI, claim validator, source mapping and revision handling are unchanged.
