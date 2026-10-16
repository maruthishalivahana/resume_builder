# Local highlight candidate selection — 2026-10-16

## Change and boundaries

`services/highlight-candidates.service.ts` extracts bounded, literal spans from verified raw evidence. It reuses the existing normalization for relevance and `resolveHighlight` for LaTeX eligibility. It excludes denied evidence, unverified IDs, unsupported qualification terms, known React/React Native substitution, opaque commands, labels, already formatted text, and ambiguous repeated spans. Candidate selection maximizes requirement coverage and then minimizes length; discontinuous retrieval action aliases do not justify expanding the highlighted clause.

`providers/ollama-highlight.provider.ts` now requests `{ "selection": { "candidateId": "c1" } }` or `{ "selection": null }`. Unknown IDs, extra fields, and old free-text responses fail closed. Candidate IDs are request-local and resolve to the original persisted evidence ID and raw span. The external HighlightProposal contract is unchanged. Missing candidates return no edit before inference. Model null remains null; failures remain provider errors, with no retry or fallback prose. Existing downstream claim validation and exact patch mapping still run.

No compilation, browser, database, autosave, source-patch, revision, or recovery implementation changed. Bullet and summary rewriting remain disabled.

## Actual local model results

Same 40 synthetic requirements and unchanged usefulness oracle. Dataset and oracle SHA-256 values were compared and match the previous report. These are development examples used during implementation, not an independent held-out evaluation.

| Measurement | Previous real run | Final real run |
| --- | ---: | ---: |
| Useful suggestions / expected opportunities | 13/18 | 18/18 |
| Unnecessary edits / generated edits | 3/16 | 0/18 |
| Unexpected suggestions on no-edit cases | 1/22 | 0/22 |
| Exact source mappings | 16/16 | 18/18 |
| Invalid responses / timeouts | 0 / 0 | 0 / 0 |
| Actual model calls | 23 | 18 |

Final: 23 provider-method calls, 17 upstream skips, 5 deterministic no-candidate abstentions, 0 model abstentions among 18 inference calls. Warm-run median 2,852 ms; p95/max 3,692 ms. Prior latency included a cold load and is not a controlled speed comparison.

`candidate-results-65d92d45.json` contains the final raw cases. Runtime: cached Ollama 0.40.4, qwen3:1.7b, CPU, temperature 0, loopback port 11435. No cloud calls, database writes, downloads, or retry loops.

The first candidate run (`storage/benchmarks/local-model-324f5b3b-3b44-440c-9754-f2391b03b4a8.json`) scored 17/18 and exposed an overbroad “Kept ... running” candidate. A general contiguous-action rule and an independent database-services regression corrected it before the final run. Failed connection attempts are retained as `local-model-d28ab641-d7e3-456a-b89c-21a656178b4d.json` and `local-model-c47b6289-06b4-416a-b878-b3e517213adb.json`; no cases ran in those attempts. The temporary runtime was restarted outside the sandbox, then unloaded and stopped after evaluation.

## Commands and results

From repository root, all passed:

```powershell
node backend/test-highlight-candidates.js
node backend/test-ollama-provider.js
node backend/test-local-evaluation.js
node backend/test-highlight-generation.js
node backend/test-grounded.js
node backend/test-claim-validator.js
node backend/test-source-mapping.js
node backend/test-source-patch.js
node backend/test-evidence-negation.js
node backend/test-paraphrase-retrieval.js
node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json
npm --prefix backend run benchmark:tailoring:gate
node node_modules/eslint/bin/eslint.js backend/src/modules/job-tailoring/services/highlight-candidates.service.ts backend/src/modules/job-tailoring/providers/ollama-highlight.provider.ts backend/test-highlight-candidates.js backend/test-ollama-provider.js backend/benchmarks/tailoring/local-run.js backend/benchmarks/tailoring/local-metrics.js backend/test-local-evaluation.js
```

Candidate regressions: 24 span cases plus verified-ID and conflict gates. Provider tests also exercise candidate ID resolution across multiple evidence items, malformed/unknown IDs, explicit null, provider errors, no inference for unsafe spans, and no fallback. The deterministic benchmark has 84 case IDs / 85 observations, all passing, with every acceptance gate true.

`npm --prefix backend run benchmark:tailoring:check` passed before edits and fails after edits **only because the implementation SHA-256 changed**. An independent deep comparison excluding only that fingerprint confirms all remaining fields, case results, counts, and metrics are identical. The historical reviewed baseline and gold expectations were deliberately not overwritten.

Actual local inference command (with the cached runtime running):

```powershell
npm --prefix backend run dev:local-ai
# Separate terminal:
$env:JD_LOCAL_MODEL_EVAL='1'
node backend/benchmarks/tailoring/local-run.js
```

Metrics version 3 separates no-candidate abstention from model abstention and excludes zero-network cases from inference latency. Legacy saved rows without network counts remain readable. The oracle and expected outcomes were not changed.

## Remaining limits

Relevance is bounded lexical matching, not universal semantic understanding. Unknown compound technologies and paraphrases need additional independent evaluation. One candidate per evidence item and conservative LaTeX eligibility may omit useful alternatives. The model still decides whether to select a candidate; a valid candidate never overrides model abstention or an error. Provider size limits return an explicit error rather than silently truncating source.

Browser review/acceptance, live MongoDB, MiKTeX, and real-user data were not exercised during this change. Existing deterministic source and patch tests passed; this does not establish production readiness. Ready for code review with the historical fingerprint difference explicitly documented; no commit created.
