# Local tailoring trial — 2026-10-15

## Outcome

The laptop ran a small local model successfully, but the model is not ready for general resume rewriting. Only one of five generation cases met the intended useful-suggestion/abstention expectation. Existing validation behaved correctly: two no-op edits and two invented claims were rejected, with no source patch created for the invented claims.

No production provider, app configuration, database content or frontend code changed. The website still uses its existing configured provider; it was not connected to this local server. No paid or external inference requests were made. Internet requests downloaded public runtime/model artifacts only.

## Runtime and hardware

- Previously verified laptop: 7.7 GB usable RAM, Intel Iris Xe integrated graphics, approximately 149 GB free disk before this trial.
- Portable Ollama v0.40.4, downloaded from its official GitHub release. The archive SHA-256 matched the release asset digest: `7485a1172f8527db4342a63521b9342fc466185ff0855da378cc864ecf6354cf`.
- Local model tag: `qwen3:1.7b`; runtime metadata reports 2.0B parameters, Q4_K_M, GGUF. Installed model digest: `8f68893c685c3ddff2aa3fffce2aa60a30bb2da65ca488b61fff134a4d1730e7`.
- Main model blob: 1,359,279,776 bytes, SHA-256 `3d0b790534fe4b79525fc3692950408dca41171676ed7e21db57af5c65ef6ab6`.
- The native multipart pull stalled. A direct download of the same official registry blob was verified, cached, and registered with the remaining official metadata. No TLS/security setting was weakened.
- Runtime bound to `127.0.0.1:11435`; cloud disabled (`OLLAMA_NO_CLOUD=1`, confirmed in logs), one loaded model and one parallel request. Model storage was explicit under ignored `storage/local-ai/`.
- CPU inference only (`num_gpu: 0`), 4,096-token context, thinking disabled, 512 output-token cap, temperature 0. The runner also used its local offline flag.
- Runtime initially saw approximately 0.8–1 GB free RAM and available swap. Loaded model allocation reported by `/api/ps` was 1,886,629,395 bytes, size_vram 0. It ran despite low free RAM; this does not establish performance under different simultaneous workloads.
- The portable runtime initialized its normal local identity files under the user's `.ollama` directory. It was not signed into a cloud account or registered for Windows startup. No persistent environment variables were changed.
- Approximately 6.98 GiB of logical files remain under ignored `storage/local-ai/`, including archives, runtime, verified weights and partial download artifacts. No records/files were deleted. The model was explicitly unloaded and the trial-owned server stopped after testing.

## Method

`backend/verify-local-tailoring.js` is an opt-in diagnostic using the existing prompt, provider-output parser, GroundedGenerationService, deterministic highlight construction, claim validator and exact source-patch utility. It uses no API credentials or MongoDB.

The Ollama structured-output API receives an envelope `{suggestion: <proposal or null>}`. Its JSON schema permits the existing highlight and semantic-edit shapes; it does not establish factual correctness. A 120-second experimental request deadline did not change the application's existing 30-second deadline.

All cases used synthetic resume evidence. STRONG classification was deliberately forced even for unsupported requirements to exercise generation abstention and the validator. This is **not** an end-to-end match/retrieval, browser, database, acceptance or compilation test. In the application, classification may prevent those unsupported requests from reaching generation.

## Actual results

| Case | Elapsed | Model response | Pipeline outcome |
|---|---:|---|---|
| Node.js, cold | 24,386 ms | Repeated source as identical before/after | NO_OP_EDIT; rejected |
| Node.js, warm | 9,130 ms | Same no-op response | NO_OP_EDIT; rejected |
| Docker, three evidence items | 10,129 ms | Exact existing Docker span | Validated highlight and exact source patch |
| Unsupported TensorFlow | 13,936 ms | Added TensorFlow experience to Node.js evidence | CLAIM_VALIDATION_FAILED; no patch |
| Unsupported production/metric | 13,219 ms | Invented production experience and 50% latency reduction | CLAIM_VALIDATION_FAILED; no patch |

Accepted Docker replacement:

```latex
\item \textbf{Used Docker for a synthetic coursework project.}
```

The accepted text retains the coursework limitation; no claim was upgraded. Source-patch after text and SHA-256 beforeHash were checked with assertions. Both unsupported cases had neither a validated suggestion nor a source patch.

The Node.js requirement already closely matched the evidence, so no edit could be a legitimate result. The model nevertheless returned a no-op proposal rather than an explicit null; it does not count as a useful edit. The diagnostic's positive-case expectations are usefulness checks, not a rule requiring every matching requirement to produce text. The two unsafe proposals demonstrate failure to abstain; downstream rejection is a safety success, not model quality success.

All five finished within 30 seconds in this small run. This is not a tail-latency, memory-pressure, larger-context or concurrent-user qualification.

## Checks

- Actual local inference: five cases, results retained in `backend/jd-local-0143df07-b975-4045-80f4-9e1bf26fa82a.json`.
- Exact accepted highlight/source patch/hash assertions and both blocked-claim assertions: passed.
- `node --check backend/verify-local-tailoring.js`: passed.
- `node test-highlight-generation.js`: passed deterministic regressions.
- `node test-claim-validator.js`: passed 46 deterministic cases plus generation reason-code checks.
- `node test-source-mapping.js`: passed exact-range and mocked caller regressions.
- `node test-source-patch.js`: passed mocked/model regressions.
- Backend `npx tsc --noEmit`: passed.
- No app, real MongoDB or browser test was performed for local inference. Existing earlier hosted-provider browser/MiKTeX results do not verify a local integration.

## Recommendation

Keep this model out of general semantic rewriting. A narrowly scoped development adapter that only selects exact highlight spans is worth a separate trial, preserving classification, full evidence-ID validation, exact source anchors and user review. Such a mode can exercise the editor's review/apply flow without asking this model to author factual prose. It still needs negative/irrelevant-span tests and browser integration before being called usable.

Do not weaken validators to increase suggestion count, do not automatically fall back to a cloud provider, and do not interpret the local model's confidence as proof. No second model was downloaded and no production adapter was added in this task.

References:

- [Qwen3 1.7B artifact and license](https://ollama.com/library/qwen3:1.7b).
- [Official Windows portable runtime](https://docs.ollama.com/windows).
- [Local-only mode and data handling](https://docs.ollama.com/faq).
- [Ollama structured output API](https://docs.ollama.com/capabilities/structured-outputs).
