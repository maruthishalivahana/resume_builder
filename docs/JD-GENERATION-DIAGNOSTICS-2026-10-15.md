# JD generation diagnostics — 15 October 2026

Scope: measure requests and capture rejected edits in an isolated synthetic probe. No timeout increase, validator relaxation, automatic retry, database write, chat change or compilation/PDF change.

## Implementation

- `openrouter-llm.provider.ts`: logs request/requirement IDs, prompt and request bytes, total/header/body elapsed milliseconds and stage. Records resolved model and token usage when supplied, including schema failures. Does not log prompts, resume text, response content or credentials.
- `grounded-generation.service.ts`: logs detailed validator reason strings and offers an optional constructor audit observer. The observer receives a cloned rejected suggestion, validation and evidence only when explicitly supplied. Its failure does not affect the rejection result; ordinary callers do not capture text.
- `test-openrouter-provider.js` and `test-generation-diagnostics.js`: verify timing, stage/correlation, failed-response model metadata, private-text/key exclusion, audit-copy isolation, observer failures and unchanged contracts.
- `verify-generation-diagnostics.js`: opt-in synthetic-only probe with three live requests (1, 3, 12 evidence items), plus two deterministic calibration cases. Saves local JSON; does not connect to MongoDB.

## Live observations

The initial sandbox attempt could not reach the provider and is excluded from the timing comparison. The subsequent host-network run used the configured API key and requested model `openrouter/free`.

| Evidence items | Prompt bytes | Total time | Headers | Body read | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 1,532 | 5.84 s | 3.17 s | 2.67 s | Valid structured response, but identical before/after; rejected as NO_OP_EDIT |
| 3 | 2,162 | 19.55 s | 1.33 s | 18.23 s | Response failed the suggestion schema; PROVIDER_ERROR |
| 12 | 5,009 | 5.43 s | 0.92 s | 4.51 s | Structured response parsed, then CLAIM_VALIDATION_FAILED |

The first completed response reported `poolside/laguna-s-2.1:free`; the third reported `liquid/lfm-2.5-2.6b:free`. The failed second response's resolved model was not captured in that run; subsequent code/tests now record it when available on failures.

No live request timed out in this three-request sample. The largest prompt was faster than the middle prompt, so the evidence does not establish evidence count as the cause of the user's earlier timeouts. Body timing includes waiting for/reading/decoding the response, not exclusively model compute. Routing/model differences were observed, but their causal contribution to latency has not been isolated.

## Exact rejected live edit

Before:

```latex
\item Built REST APIs using Node.js for synthetic inventory project 1.
```

After:

```text
**Key Skill Highlight**: Built REST APIs using Node.js for synthetic inventory project 1.
```

The existing fact is retained, but the model replaces the LaTeX item with an extra Markdown label. Current validation rejects it because that added label is not established by the evidence. This is an output-format/unsupported-label problem, not proof that the model fabricated technical experience. It was not applied or compiled.

Calibration separately confirmed rejection of (a) unsupported TensorFlow/production claims and (b) the plausible paraphrase `Built` → `Developed`. The latter demonstrates the intentionally conservative validator's false-negative limitation. Calibration outputs were supplied by a test provider, not OpenRouter.

The user's two earlier rejected responses cannot be reconstructed from their existing logs: those logs recorded counts, not response text. This new synthetic result must not be attributed to those historical responses.

Full captured evidence: `backend/jd-generation-diagnostics-1af3060e-37c4-4d35-a098-41facaa49240.json`. The network-blocked sandbox report is retained separately.

## Verification and next recommendation

Passed: new diagnostic tests, OpenRouter transport tests, grounded generation, M7.6.1 regression, claim validator, source patch and tailoring/parser suites; backend build and no-emit TypeScript; targeted provider/generator lint. All ordinary test providers/transport are mocked; the three timing rows above are actual OpenRouter calls with synthetic inputs.

Recommended next change: constrain highlighting to an existing evidence span and produce its LaTeX formatting deterministically, or first enforce a narrower type-specific output contract. Do not weaken factual checks to admit Markdown labels. Benchmark a consistent configured model and a bounded evidence budget before changing timeouts; three heterogeneous requests are not a reliability benchmark. General semantic paraphrase validation needs its own labeled evaluation set.
