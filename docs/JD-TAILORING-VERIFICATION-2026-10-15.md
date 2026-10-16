# JD tailoring verification — 15 October 2026

## Changes in this verification pass

- `backend/src/modules/job-tailoring/services/requirement-extractor.service.ts`: determine importance from the original inline label before removing it from display text. Required, Preferred, Must have and Nice to have now retain their intended importance without affecting subsequent requirements.
- `backend/test-tailoring.js`: inline-label and context-isolation regressions.
- `backend/test-quality-suggestions.js`: replace obsolete deterministic-prose expectations with an explicit grounded test provider; separately require the deterministic generator to abstain.
- `hooks/use-resume.tsx`: carry persisted analysis diagnostic reasons into the JD session.
- `components/ai/resume-ai-floating.tsx`: distinguish provider unavailability from no safe edit, offer deliberate retry, and disclose partial provider failures.
- `backend/test-jd-provider-status.js` and `backend/test-jd-analysis-guards.js`: actual React SSR and callback tests for the diagnostic handoff and unavailable/no-edit distinction.
- `backend/verify-jd-live.js` and `backend/test-jd-live-check.js`: opt-in isolated live verification helpers. These do not start the normal server or write to the application database.

## Live environment and isolation

Used a temporary frontend copy on port 3057 and the actual backend application/routes on port 5057. Existing dependencies were linked, not installed. The MongoDB deployment reported standalone topology. Every monitored insert/update/delete/findAndModify was asserted to use the new database `resume_eng_jd_audit_e28b55ddd68d417db26cf7327c7c54c6`. Synthetic records were retained; existing application projects and histories were not changed. The backend stopped automatically after its 20-minute safety window.

The audit helper initially used a controlled formatting-only provider for reproducibility, then switched to the actual configured OpenRouter provider (`openrouter/free`). These are distinct verification results.

## Verified with the actual browser, API and MongoDB

1. In project `6acfc8760f75080a64d0bd7d`, edited the CodeMirror source to contain `JD_AUDIT_BROWSER_EDIT_842`. MongoDB persisted the edit at revision 1. Structured analysis used that content; review and acceptance of the controlled-provider patch updated the actual editor and persisted revision 2 with no pending write marker.
2. In project `6acfc8760f75080a64d0bd82`, one real OpenRouter request timed out after 30 seconds, produced `PROVIDER_ERROR`, and created no suggestion. A deliberate subsequent request returned valid structured output (545 characters). The real provider's suggestion highlighted `Node.js REST APIs` without adding facts.
3. Accepted that real suggestion using the browser's Accept button. The UI showed Applied/Accepted and the exact LaTeX source. MongoDB confirmed file `6acfc8760f75080a64d0bd84` at revision 1, no pending marker, containing `\item Built \textbf{Node.js REST APIs} for JD_AUDIT_BRAVO_731.` Analysis ID: `c82cfe0f-60ac-4f9b-89da-d6db1e1e9f1f`. Suggestion ID: `66dc4e36-2818-452e-9fe9-1afe0d0cceee`.
4. With controlled generation delayed, changed the target file using the real revision-checked PATCH API after evidence retrieval. Analysis returned zero safe suggestions and `SOURCE_PATCH_FAILED`.
5. Changed source after a fresh analysis, then attempted acceptance. The API returned HTTP 409 `SOURCE_CHANGED`; the newer source remained at revision 4 and the suggestion remained pending. An older-revision save also returned 409 without overwriting it.
6. Navigated from B to A during a delayed analysis. A showed its own source marker and an empty JD session. This exercised full browser navigation; same-provider SPA races and late errors are separately covered by callback tests.

Machine-readable source/revision evidence: `backend/resume_eng_jd_audit_e28b55ddd68d417db26cf7327c7c54c6.json`.

## Deterministic verification

All twelve selected suites passed: tailoring, quality suggestions, grounded generation, claim validator (46 cases), M7.6.1 regression, deterministic generator, source patch, M8 requirements, OpenRouter transport, JD analysis guards, JD provider status and source mapping. Autosave and recovery suites passed as well. Backend build and no-emit TypeScript passed. Frontend source TypeScript passed with zero diagnostics (generated Next route declarations excluded).

Hook and extractor lint passed. AI panel lint has two pre-existing `react-hooks/set-state-in-effect` failures (auto-expansion and chat-close reset); running ESLint on the `HEAD` version reproduced the same errors. These were not suppressed or refactored. A full frontend production build was not run in this pass.

Provider-unavailable/partial-failure UI rendering and retry presence were verified with actual React SSR and callback regressions. The real browser exercised the prior timeout state and the successful acceptance path; the newly worded unavailable state was not re-triggered live after its change. No automatic provider retry was added.

## Remaining limits

- No immutable cross-file analysis snapshot or atomic cross-file acceptance fence was introduced. The live target-file interleavings passed, but that does not establish point-in-time consistency for all supporting files under concurrent edits.
- Claim validation remains deterministic and conservative, not general semantic entailment. It rejects some valid paraphrases and trusts the supplied resume evidence.
- A longer synthetic requirement containing the same technologies was classified STRONG but had zero verified evidence because of the generation evidence-score gate. It safely produced no edit; classification/retrieval calibration still needs a representative benchmark before changing thresholds.
- One live provider success and one timeout do not establish sustained availability, rate-limit handling under load or production readiness.
- Compilation/PDF behavior was not changed or certified by this JD verification.
