# OpenRouter latency diagnostic — 2026-10-15

## Recommendation

**Privacy follow-up:** the NVIDIA candidate below is suitable only for synthetic testing pending provider review. Subsequent live probes of both pinned free models with `data_collection: "deny"` and `zdr: true` returned HTTP 404 (no eligible endpoints). Do not treat this latency result as approval to send real resumes. See `JD-OPENROUTER-PRIVACY-2026-10-15.md`.

Trial `OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free` in development while retaining the existing 30,000 ms request deadline, explicit retry action, strict validation and no fabricated fallback. This is a candidate supported by a small synthetic sample, not a production reliability guarantee. No application configuration was changed in this audit.

Do not increase the timeout or switch to the faster small model on these results alone. The small model failed the response schema in all three trials. None of these requests timed out, so this run cannot establish that a longer deadline recovers timed-out requests.

## Method and boundaries

`backend/verify-openrouter-latency.js` uses the current production provider, prompt, deterministic highlight resolver and grounded validator. It sends synthetic Node.js REST API evidence only; it does not load user resumes or connect to MongoDB. The configured key is loaded locally and never written into reports. All three models were checked against the live public catalog for zero prompt/completion pricing and response_format support before inference.

Nine requests ran sequentially with one attempt per cell: three models × 1, 3 and 12 evidence items. Model order rotates across evidence sizes. Temperature 0 and json_object response format remain as in production. The harness overrides model/deadline only on its own provider instance. At most one separate 60-second diagnostic trial per model was planned if that model timed out; no such trial ran because no baseline request timed out. No application retries or fallback behavior changed.

An initial sandbox attempt could not reach the model catalog and made **zero inference requests**. The approved host-network run completed all nine requests. The failed attempt's partial report is retained separately.

## Actual live results

All times below are milliseconds. Total is measured around grounded generation; header/body values come from provider diagnostics.

| Requested model | Evidence items | Total | Headers | Body | Result |
|---|---:|---:|---:|---:|---|
| openrouter/free | 1 | 13,454 | 2,210 | 11,238 | Validated highlight |
| NVIDIA Nemotron 3 Super free | 1 | 4,595 | 260 | 4,335 | Validated highlight |
| Liquid LFM 2.5 2.6B free | 1 | 3,171 | 538 | 2,633 | Invalid structured-output schema |
| NVIDIA Nemotron 3 Super free | 3 | 5,929 | 239 | 5,689 | Validated highlight |
| Liquid LFM 2.5 2.6B free | 3 | 2,946 | 973 | 1,972 | Invalid structured-output schema |
| openrouter/free | 3 | 29,062 | 324 | 28,737 | Validated highlight |
| Liquid LFM 2.5 2.6B free | 12 | 3,841 | 451 | 3,388 | Invalid structured-output schema |
| openrouter/free | 12 | 4,088 | 492 | 3,596 | Validated highlight |
| NVIDIA Nemotron 3 Super free | 12 | 5,070 | 385 | 4,684 | Validated highlight |

Full pinned IDs: `nvidia/nemotron-3-super-120b-a12b:free` and `liquid/lfm-2.5-2.6b:free`.

The router resolved to three different models:

- 1 item: `dots-studio/dots-3-note-preview:free`.
- 3 items: `nvidia/nemotron-3-ultra-550b-a55b:free`.
- 12 items: `nvidia/nemotron-3-super-120b-a12b:free`.

All six validated suggestions were exact-span highlights of `Built REST APIs using Node.js`. The smaller model's three failures were provider schema failures, not claim-validation failures, no-edit decisions or timeouts. Invalid payloads were not retained; the exact offending field is not established by this report. The failures produced no fallback text.

## Interpretation

**Verified:** this sample's pinned NVIDIA requests completed in 4.6–5.9 seconds and passed validation. The free router varied from 4.1–29.1 seconds. The slow router request obtained headers in 324 ms but spent 28,737 ms completing the body, close to the current deadline. A 5,299-byte prompt completed faster than a 2,515-byte prompt under different resolved models; evidence count alone does not explain the latency.

**Not established:** the exact upstream cause of historical timeouts, steady-state success rates, p95/p99 latency, busy-hour capacity, or paid-model performance. Time to headers combines DNS/TLS/network/queueing/upstream processing; response-body time combines any remaining inference/buffering and transfer. This instrumentation cannot isolate those components or measure first meaningful generated token. A named model also does not pin a provider endpoint or guarantee capacity.

**Code-inspection finding:** `tailoring-orchestrator.service.ts:138` processes requirements in a loop and awaits generation at line 188. End-to-end analysis therefore accumulates per-requirement latency. Six eligible requests that each reach a 30-second deadline can consume approximately 180 seconds plus retrieval/database work. Raising every request to 60 seconds could double that wait. This arithmetic is not a measured website timing from this benchmark, and no concurrency redesign was made.

## Minimal next action and acceptance criteria

After approval, change only the development model setting to the NVIDIA candidate and explicitly retain the 30-second timeout. Restart the backend so the startup-created provider reads the new configuration. Preserve the existing retry UI, source/revision guards, claim validation and abstention behavior. Rollback is restoring the prior model setting and restarting.

Before wider use, run representative multi-requirement JDs and measure whole-analysis duration, schema failures, timeouts and accepted edits across multiple time windows. Compare timeout/schema outcomes separately from legitimate no-edit decisions. For an initial development trial, require every emitted suggestion to pass current validation, no fallback prose, source content/revision checks after acceptance, and observed per-request completion under the existing deadline. A broader release requires a defined latency/error budget and a larger independent dataset; three requests cannot establish either.

Do not add paid requests, automatic retries, output-token caps or reasoning controls based on speculation. Those require a separate bounded experiment; token caps can truncate structured JSON, and model-specific reasoning settings can change behavior.

## Verification and retained artifacts

- Live results: `backend/jd-latency-e3351b9e-a6b1-40e2-af90-210e40960337.json`.
- Sandbox connectivity failure: `backend/jd-latency-1a259923-afac-4753-8358-2f29bcbe4051.json` (no inference).
- `node --check backend/verify-openrouter-latency.js`: passed.
- Report assertions: nine cells, one request per cell, unchanged 30-second deadline and expected source text in all successful suggestions: passed.
- `node test-openrouter-provider.js`: passed with mocked transport; verifies deadline/error/schema/retry behavior, not live reliability.
- `node test-highlight-generation.js`: passed deterministic regression tests.
- No production source, environment files, schemas or database records changed. No app/browser/MiKTeX run was needed for this provider-only diagnostic. No dependencies installed.

Official references checked on the audit date:

- [Model catalog](https://openrouter.ai/api/v1/models): current IDs, pricing and supported parameters.
- [Free Models Router](https://openrouter.ai/openrouter/free): selects among free models, so it is not a stable model identity.
- [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs): schema-constrained output is distinct from the current json_object request; switching formats was outside this diagnostic.
- [Limits](https://openrouter.ai/docs/api/reference/limits): free model capacity has request limits. No HTTP 429 was observed in this sample; rate limiting is not established as its cause.
