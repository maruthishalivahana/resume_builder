# OpenRouter privacy routing check — 2026-10-15

## Decision

**Free-only constraint:** the user subsequently ruled out all paid requests. No paid endpoint, paid fallback, or paid benchmark is authorized. The additional free-only discovery below did not find an available strict-policy route; no privacy restriction was relaxed.

Do not switch the resume application to either tested pinned free model for real resume data based on the latency benchmark. Both returned no eligible endpoint under the tested strict policy. Existing environment files and production provider code were left unchanged; the current configuration is not thereby certified suitable for personal data.

## Code inspection

`backend/src/modules/job-tailoring/prompts/grounded-suggestion.prompt.ts` serializes raw evidence (or normalized text if raw is absent), source metadata and job requirements into the provider prompt. Removing a name from a resume is not a demonstrated anonymization boundary: project and employment facts can also identify people.

`backend/src/modules/job-tailoring/providers/openrouter-llm.provider.ts` currently sends no request-level `provider.data_collection` or `provider.zdr` preference. OpenRouter account-level settings may apply independently; those settings were not inspected or changed. Therefore this code alone does not prove no-training/no-retention routing.

## Actual live checks

`backend/verify-openrouter-privacy.js` sent two harmless synthetic messages with:

```json
{"data_collection":"deny","zdr":true,"allow_fallbacks":false,"max_price":{"prompt":0,"completion":0}}
```

No user resume, database records or identifying information were included. The configured key was read locally and never printed or retained in reports. No paid model or application route was invoked. These are route eligibility checks, not tailoring quality tests or verification of a provider's actual storage practices.

| Model | HTTP | Elapsed | Result |
|---|---:|---:|---|
| nvidia/nemotron-3-super-120b-a12b:free | 404 | 724 ms | No endpoints found matching your data policy (Zero data retention) |
| liquid/lfm-2.5-2.6b:free | 404 | 85 ms | Same policy error |

The combined policy is unavailable for these tested routes/account at this time. This does not prove that every free model lacks eligible endpoints or that paying alone guarantees privacy. The NVIDIA model page separately warns against personal/confidential inputs and describes logging for improvement; routing flags do not override endpoint terms.

An initial sandbox attempt failed at transport (TypeError); it is not included as provider evidence. The approved host-network run produced the real HTTP results above.

## Next implementation boundary

For real resumes, select an endpoint with suitable current terms and documented retention/training policies, then implement explicit request-level routing restrictions that fail closed. Never retry a policy failure by dropping the restrictions, changing to an unrestricted model, or manufacturing text. Retain the current claim/source/revision checks and 30-second deadline.

OpenRouter's request-level ZDR filters inference endpoints. Review OpenRouter's own collection/logging settings and terms separately; a successful policy-filtered request would establish route availability, not an independent privacy audit or universal retention guarantee. No account settings were changed during this check.

If a paid endpoint is needed, choose a spending cap before testing it. Alternatively, retain free-model experiments with synthetic-only data in the isolated harness. No paid request was authorized or sent by this check, and no model/environment switch was made.

## Evidence and checks

- Actual host-network response report: `backend/jd-privacy-7447948c-2454-44c9-850d-7d849857d15d.json`.
- Sandbox connectivity report: `backend/jd-privacy-19a6a2e2-4114-4821-a010-31a29ce873c8.json`.
- `node --check backend/verify-openrouter-privacy.js`: passed.
- No production source, schemas, dependencies, database content, browser settings or environment files changed. No production build was run because this change adds only a diagnostic script and documentation.

Official references reviewed:

- [NVIDIA free endpoint notice](https://openrouter.ai/nvidia/nemotron-3-super-120b-a12b:free).
- [Provider routing and data policy controls](https://openrouter.ai/docs/guides/routing/provider-selection).
- [Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr).
- [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection).
- [Provider logging policies](https://openrouter.ai/docs/guides/privacy/provider-logging).

## Additional free-only discovery

The live public `/api/v1/models?zdr=true` catalog returned three zero-token-price `:free` candidates with response_format support: the two Gemma variants below and the previously tested NVIDIA model. Catalog membership alone did not establish actual availability under the combined account and request policy.

The diagnostic helper now optionally probes the two fixed Gemma IDs (`JD_PRIVACY_GEMMA=1`). Before inference it verifies the model's `:free` suffix, current ZDR catalog membership, zero input/output prices and zero listed per-request price. Missing/nonzero-price candidates are skipped. Every request retains zero-price limits, disabled provider fallback, data_collection deny, and zdr true.

| Additional candidate | HTTP | Elapsed | Result |
|---|---:|---:|---|
| google/gemma-4-26b-a4b-it:free | 404 | 354 ms | No endpoints found matching your data policy (Zero data retention) |
| google/gemma-4-31b-it:free | 404 | 161 ms | Same policy error |

Actual response/catalog report: `backend/jd-privacy-7d12082d-8f9a-4bee-8044-511efa4d58e1.json`. Two synthetic requests only; no paid requests, user-resume transmissions, application/configuration changes or database writes. Script syntax check passed.

This does not prove all free routes are permanently unavailable: capacity, metadata and account restrictions can change. It establishes that the discovered candidates do not currently provide a verified route satisfying the tested policy. Local inference is the next free-only option to evaluate, subject to available hardware, model license and quality tests. No local runtime was installed and no model was downloaded.
