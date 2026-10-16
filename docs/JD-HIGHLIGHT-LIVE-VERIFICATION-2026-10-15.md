# Live highlight verification — 2026-10-15

No production code changed during this verification. The current frontend was copied to a separate temporary directory and run on port 3057 against an audit backend on port 5057. MongoDB writes were confined by the existing audit harness to new database `resume_eng_jd_audit_f400bc2743af431696b9d2cdcf491504` on the actual standalone deployment. Existing application records were not modified. No dependencies were installed.

## Real provider and browser flow

- Project: `6ad03166aa2f0011e2858b02`; entry file: `6ad03166aa2f0011e2858b04` (`resume.tex`).
- Browser submitted synthetic JD: `Backend Developer` / `Required: Experience building Node.js REST APIs.`
- The harness was explicitly switched to **live** mode before analysis; no controlled-provider response was used.
- Analysis: `ba355eef-e3a9-4eb4-a968-bcac75df3901`.
- OpenRouter request: `f55e98da-407f-42d7-ae9c-21ab37f1b8f8`; requested model `openrouter/free`; resolved model `nvidia/nemotron-3-super-120b-a12b:free`.
- Measured latency: 5,924 ms total; 1,010 ms headers; 4,913 ms body. Prompt 1,953 bytes; request 2,263 bytes; reported tokens 536 prompt / 553 completion.
- Two extracted requirements: title line MISSING, actual skill STRONG. One highlight persisted with validation PASS and fallbackUsed false.
- Before: `\item Built Node.js REST APIs for JD_AUDIT_ALPHA_731.`
- After: `\item \textbf{Built Node.js REST APIs} for JD_AUDIT_ALPHA_731.`
- Browser acceptance showed Applied/Accepted and updated editor content. Suggestion `4b827668-67df-444d-91ff-5bcc53168b9b` was accepted; MongoDB contained the exact after text at revision 1 with no pendingWrite.

## Real MiKTeX and artifact checks

The first compile failed because the audit harness's original synthetic marker contains unescaped underscores. MiKTeX reported `Missing $ inserted`; no PDF was emitted and the failed build remains recorded as `6ad03203aa2f0011e2858b51`. This was a fixture defect, not caused by the highlight. Only the isolated editor's marker was changed to `JD-AUDIT-ALPHA-731`, retaining the accepted bold span. Autosave persisted revision 2 before the next compile.

- Successful build: `6ad03227aa2f0011e2858b73`, entry ID as above, project sourceVersion 2, captured file revision 2.
- Captured UTF-8 content SHA-256: `efd877a88fef359e3a6343dc939ab250b2f1bfab0c0676fe58a2b4ccfa47d5db`; 169 bytes.
- Real MiKTeX completed with zero errors in 1,330 ms.
- Requested endpoint: `/api/latex/projects/6ad03166aa2f0011e2858b02/pdf?compilationId=6ad03227aa2f0011e2858b73`.
- HTTP 200, application/pdf, 39,043 bytes, `%PDF-1.5`, one page.
- Download SHA-256: `7E20E787B2C3B648B55F0E2E7F0B7C853E6987C4F72F12A81AD95764FC789DAC`; equal to the exact build's stored artifact.
- pypdf confirmed the marker and original claim, with no Markdown label. pdfplumber confirmed `Built Node.js REST APIs` uses CMBX10 bold font. Poppler rendering was visually inspected and shows the intended highlight.

## Browser preview limitation

The actual UI displayed this build ID and an iframe pointing at its exact compilation URL. The in-app browser screenshot did not expose a rendered PDF page. Therefore native in-app PDF rendering is **not verified**; the correct URL, artifact bytes, parsed text, bold font and independent rendering are verified. No viewer change was made.

This is one successful live synthetic request, not a timeout-rate benchmark or production-readiness qualification. Complex macros remain conservatively rejected. No timeout thresholds or claim validation rules changed.

## Retained evidence

All paths below are repository-relative:

- `backend/jd-highlight-live-f400bc2743af431696b9d2cdcf491504.json`: isolated file/suggestion/evidence/analysis records.
- `backend/jd-highlight-build-f400bc2743af431696b9d2cdcf491504.json`: build metadata, manifest and compiler output.
- `backend/jd-highlight-live-f400bc2743af431696b9d2cdcf491504.pdf`: downloaded exact-build artifact.
- `backend/jd-highlight-live-render.png`: independent Poppler rendering.
- `backend/jd-highlight-browser-accepted.png`: actual website showing Applied suggestion.
- `backend/jd-highlight-browser-preview.png`: preview screenshot documenting rendering limitation.

Audit records and temporary frontend copies are retained. Only audit-owned servers and the audit browser tab are stopped/closed after verification.
