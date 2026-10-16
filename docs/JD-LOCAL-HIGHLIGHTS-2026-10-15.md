# Local highlight-only trial — 2026-10-15

## Decision

The downloaded local model is more useful when limited to selecting existing highlight spans than when allowed to write claims. This is a development candidate, not a completed website integration or release qualification. Keep semantic rewriting disabled for this model and retain the current deterministic guards.

No production source, provider setting, environment file, database record or frontend was changed. The only implementation change extends the opt-in diagnostic `backend/verify-local-tailoring.js` with `JD_LOCAL_HIGHLIGHTS_ONLY=1`.

## Exact trial changes

- The response schema allows only a highlight proposal or null inside the existing diagnostic envelope; rewrite/reorder/keyword shapes are removed in this mode.
- A short local-only prompt asks for a unique exact span, requires requirement relevance, and forbids new text, command arguments, labels, repeated spans and already-bold content.
- Existing provider-output parsing, GroundedGenerationService, claim validation, deterministic highlight construction and exact source patch creation still run.
- Output cap is 256 tokens rather than the earlier diagnostic's 512. CPU, 4,096-token context, thinking disabled, temperature 0 and 120-second experimental deadline remain. The app's deadline/configuration are untouched.
- Same cached Qwen3 1.7B tag and portable Ollama v0.40.4; no new download or install. Localhost-only port 11435 and cloud disabled, one request at a time.
- STRONG eligibility remains deliberately forced, including negative cases, to exercise generation and source safety directly. This is not a full classifier/retrieval/browser test.

## Actual local results

| Case | Elapsed | Result | Intended model behavior met? |
|---|---:|---|---|
| Node.js cold | 14,960 ms | Validated exact highlight | Yes |
| Node.js warm | 8,415 ms | Validated exact highlight | Yes |
| Docker, multiple evidence items | 11,744 ms | Validated exact highlight targeting e2 | Yes |
| Unsupported TensorFlow | 3,391 ms | Explicit null / NO_EDIT_NEEDED | Yes |
| Unsupported production and 50% metric | 3,230 ms | Explicit null / NO_EDIT_NEEDED | Yes |
| Repeated-word evidence | 7,338 ms | Highlighted whole `Docker Docker` phrase | No: poor formatting selection |
| Already-bold Docker | 7,666 ms | Model selected Docker; deterministic guard rejected it | No: failed model abstention, safe pipeline rejection |
| LaTeX label only | 7,260 ms | Model selected Docker; deterministic guard rejected it | No: failed model abstention, safe pipeline rejection |

The model met 5/8 intended behavior checks. All three positive cases passed; both unsupported requirements returned explicit null. Two formatting failures were contained by unchanged guards. The repeated-word case remained an accepted quality failure: `Docker` occurs twice, but the model selected `Docker Docker`, which occurs once. This does **not** demonstrate a broken uniqueness check or an ambiguous source patch; it demonstrates why exact source correctness is not the same as useful formatting.

The model also tends to bold most of a bullet rather than a compact skill phrase. The accepted Docker output preserved the coursework limitation:

```latex
\item \textbf{Used Docker for a synthetic coursework project}.
```

No generated claim text was inserted by this mode. Source after text is constructed in code. All accepted outputs were checked to have matching source-patch after bytes and a correct SHA-256 beforeHash; both negative semantic cases and both rejected LaTeX cases had no patch.

## Limits

This small hand-written suite cannot establish general model relevance or safe abstention. The prompt explicitly mentions the Node.js/TensorFlow and production/metric distinctions, which also appear in the negative cases; those results are not an independent held-out quality estimate. A future integration trial should use unseen technologies, paraphrases and resume layouts. All requests finished under 30 seconds here, but there was no stress or memory-pressure benchmark.

Model confidence does not replace validation. Existing command/argument guards are conservative and may reject useful formatting in custom macros. No guard was loosened to improve the result count, and the failed expectations remain in the report.

## Verification

- Actual inference report: `backend/jd-local-e2c89ef2-68ea-4ffe-ba39-64da8fa3cec5.json`.
- Report assertions: eight cases; all non-null proposals are highlights; accepted patch bytes/hashes agree; semantic negatives explicitly abstain; bold/label proposals yield no patch: passed. These assertions do not turn the three failed quality expectations into passes.
- `node test-highlight-generation.js`: passed deterministic regressions.
- `node test-claim-validator.js`: passed 46 deterministic cases plus reason-code checks.
- `node test-source-patch.js`: passed existing mocked/model regressions.
- `node --check backend/verify-local-tailoring.js` and targeted diff whitespace check: passed.
- No production TypeScript changed in this trial. The preceding all-edit local trial's backend no-emit check passed; no new production build was needed for this JS-only diagnostic change.
- `/api/ps` confirmed the model unloaded; the trial-owned server was stopped. Downloaded artifacts remain reusable, and no paid/external inference requests or database writes occurred.

## Next bounded step

Before website integration, add held-out quality cases and decide whether to reject overbroad/repetitive formatting or leave it for explicit user rejection. A future local development provider should advertise highlight-only capability, reject any semantic-edit output at runtime, use loopback-only inference with no automatic cloud fallback, and leave acceptance/revision/recovery safeguards unchanged. This trial does not implement that adapter or claim the website is using it.
