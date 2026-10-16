# Actual local-model evaluation — 2026-10-15

This milestone evaluates the current provider; it does not change it or implement rewriting. The deterministic benchmark remains unchanged and reproduces its reviewed baseline. Local synthetic inference and isolated real API/database/compiler verification were explicitly approved.

## Scope and repeatability

The existing 40 requirements from the additive v2 corpus run sequentially through the actual extractor, parser, ranking, retrieval, classification, evidence verification, local provider, claim validator and source-patch helpers. No STRONG matches are fabricated to force generation. Forty predeclared usefulness labels in `local-oracle.js` are separate from immutable classification gold and are **not sent to the model**. Eighteen cases have useful editable spans; 22 should produce no edit under this evaluation policy. Related technologies, unsupported expertise, already-bold text, opaque macros and unsafe literal spans are deliberately conservative no-edit cases.

The oracle is a closed list of useful existing spans. A broader truthful highlight can fail this usefulness policy without adding an unsupported fact. This is developer-labelled synthetic evaluation, not independent human satisfaction or held-out generalization. Some snippets, including the inherited raw C# skill fixture, are parser fixtures rather than compilable complete LaTeX projects. Only the isolated review fixture is compiled.

Commands from repository root, using separate terminals:

```powershell
npm --prefix backend run dev:local-ai
$env:JD_LOCAL_MODEL_EVAL='1'
npm --prefix backend run benchmark:local-model
$env:JD_LOCAL_REVIEW='1'
npm --prefix backend run verify:local-review
```

Each run writes a unique report under ignored `storage/benchmarks/`. The review runner creates and retains a NEW randomly named local MongoDB database, binds its app to a loopback ephemeral port and closes it afterward. It never contacts the ordinary running app or writes to `resume_eng`. No DB schema/configuration or user resume is changed. The scripts never install/pull models, use a hosted provider, retry model failures or fabricate a fallback proposal.

Observed runs used direct equivalents from `backend`: `$env:JD_LOCAL_MODEL_EVAL='1'; node benchmarks/tailoring/local-run.js` and `$env:JD_LOCAL_REVIEW='1'; node benchmarks/tailoring/local-review.js`. All exited 0. This means the evaluation completed and factual/source safety assertions passed; it is not a usefulness gate pass.

Runtime: actual Ollama **0.40.4**, cached `qwen3:1.7b`, CPU, 4096 context, temperature 0, 256-token output cap, 30-second request deadline. The main run made 23 actual inference requests plus two local metadata requests; the review made two additional inference requests. HTTP inference is restricted to `127.0.0.1:11435`, redirects are prohibited and cloud is disabled in the portable runtime. No paid/cloud inference calls occurred. Conversational chat remains separately configured in the actual app; only the isolated child app selects deterministic chat to avoid external requests.

## Actual model results

Run `1d71ee7a-4786-4846-a27c-9f9ac66ea33d`, saved as `model-results-1d71ee7a.json`.

| Measurement | Result |
|---|---:|
| Requirements evaluated | 40 |
| Local model calls / upstream skips | 23 / 17 |
| Useful results against editable opportunities | **13/18 = 72.2%** |
| Useful among validator-approved suggestions | **13/16 = 81.3%** |
| Unnecessary/overbroad among approved suggestions | **3/16 = 18.8%** |
| Suggestions in no-edit-labelled cases | 1/22 |
| Model null responses | 1/23 |
| Useful cases with no suggestion | 3 |
| Total unmet useful expectations | 5 (3 absent + 2 overbroad) |
| Invalid structured responses / timeouts / other provider failures | 0 / 0 / 0 |
| Downstream source/span guard rejections | 6 |
| Generated suggestions preserving every source character except the inserted bold wrapper | **16/16** |
| Exact original-source mappings | **16/16** |
| Provider-call latency p50 / p95 | **3227 / 4051 ms** |
| First request and maximum latency | **19338 ms** |

Skipped requirements are not model abstentions, and guard rejections are not valid model null decisions. A syntactically valid response can still contain an invalid edit span: structured-output success does not prove source correctness. Latency samples cover only provider attempts, not skipped requirements; no concurrent-load or repeated-run distribution is measured.

Five unmet useful outcomes:

1. `paraphrase-leadership`: model selected `Led a team.` while the actual source says `Led a software team.` The non-literal selection was rejected.
2. `formatted-crlf`: model selected already-bold `Node.js` instead of available unformatted `REST APIs`; guard rejected it.
3. `education`: explicit null despite a labelled useful degree highlight. The current prompt focuses on skills; this is a measured capability limitation, not a validator defect.
4. `expanded-cicd-list`: selected `CI/CD, Git` instead of only the requested CI/CD concept. Source-safe but overbroad under the fixed oracle.
5. `expanded-soft-skill-ambiguity`: selected the whole communication/collaboration sentence rather than the requested phrase. Source-safe but overbroad under the fixed oracle.

The third unnecessary suggestion was `related-react-native`: `React Native` highlighted for a React-only requirement. It remains a truthful original mention, but is not an equivalent technology or a useful edit under the conservative relevance label. No application of these three low-quality suggestions was performed by the corpus runner; mapping is in memory only.

The other guard rejections were macro-contained Python, macro-contained CI/CD, unsafe C# and already-bold Rust. These demonstrate enforcement, not model understanding of LaTeX. Missing and explicitly negated requirements were stopped upstream, not credited as successful model refusals. The report's zero unsupported-claim rejections is not evidence that arbitrary rewriting is safe: this provider selects spans only, and one attempted non-literal paraphrase was caught earlier by the source guard.

The final metrics schema separates "no suggestion" from "no useful suggestion". Metrics were recomputed from the same preserved 40 raw result rows to make that distinction explicit; **no inference was repeated and no label changed**. The raw row proposals, dataset/oracle hashes, local model digest and runtime metadata are retained.

## Real accept/reject/save/compile/PDF verification

Database: `resume_eng_model_review_7b0a5d04f6754a0c901aca5b3cf44173`, actual **standalone local MongoDB**. Write commands were monitored and asserted against that isolated database. App bound only to its own ephemeral loopback port. Report: `review-results-7b0a5d04.json`.

The real model generated SQLite highlights twice, without scripted proposals:

- Baseline content revision 0 compiled with MiKTeX/pdfLaTeX; exact artifact downloaded.
- First actual suggestion rejected through the API; source stayed byte-identical at revision 0.
- Second actual suggestion accepted through the API; only `SQLite` gained `\\textbf{...}`, revision advanced to 1 and recovery finalized.
- Repeating acceptance stayed at revision 1; a stale editor PATCH at expected revision 0 returned HTTP 409 and preserved content.
- A deliberate source marker was saved through PATCH with expected revision 1, confirmed by GET at revision 2 with recovery complete, then compiled.
- The build manifest captured revision 2 and its SHA-256 matched the confirmed saved content.
- Requested PDFs returned HTTP 200 with `application/pdf`, valid `%PDF-` signature and exact bytes matching each build's stored artifact. Older build retrieval after the new build returned its original hash; an unknown compilation returned 404.

| Build | Compilation ID | Bytes | Captured revision |
|---|---|---:|---:|
| Baseline | `6ad1146e8c1860d4b4b0772c` | 29603 | 0 |
| Accepted and saved | `6ad114768c1860d4b4b07775` | 41012 | 2 |

Bundled pypdf parsed both one-page PDFs. Both contain `LOCALMODELBASE731`; only the new build contains `LOCALMODELACCEPTED842`. pdfplumber confirmed `SQLite` is bold only in the new build. Poppler rendered the final page; visual inspection confirmed readable text, normal spacing and the intended bold word. pypdf joins adjacent words around the font change (`withSQLitefor`); this is an extraction-spacing observation, not malformed source or visually missing spaces. See `pdf-results-7b0a5d04.json` for unaltered extracted text.

Exact PDF verification commands executed from repository root:

```powershell
& 'C:/Users/kumma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' backend/benchmarks/tailoring/verify-local-review-pdf.py storage/benchmarks/review-7b0a5d04-f675-4a0c-901a-ca5b3cf44173/report.json
pdftoppm -png -scale-to 1100 -singlefile storage/benchmarks/review-7b0a5d04-f675-4a0c-901a-ca5b3cf44173/revision-2.pdf storage/benchmarks/review-7b0a5d04-f675-4a0c-901a-ca5b3cf44173/accepted-render
```

This is **real API + database + local model + compiler + parsed/rendered artifact** verification. It is not browser UI acceptance, CodeMirror autosave scheduling, PDF iframe rendering or a real-user study.

## Checks and changed files

All passed from `backend`:

```powershell
node test-local-evaluation.js
node test-ollama-provider.js
node test-grounded.js
node test-claim-validator.js
node test-source-mapping.js
node test-source-patch.js
node test-autosave-recovery.js
npm run benchmark:tailoring:check
node node_modules/typescript/bin/tsc --noEmit
```

Targeted ESLint for all five new JavaScript harness/oracle/metric/test files passed with zero warnings/errors. JavaScript and Python syntax checks passed; diff whitespace checks passed. Full frontend builds were not run because no frontend production code changed.

Additions: `local-oracle.js`, `local-metrics.js`, `local-run.js`, `local-review.js`, `verify-local-review-pdf.py`, `backend/test-local-evaluation.js`, the three retained JSON reports and this document. `backend/package.json` adds opt-in run and metric-test commands. **No production provider, validator, save manager, compiler, PDF delivery or UI file changed.** Original benchmark gold and reference snapshots were not modified.

## Decision

Source safety and the isolated review workflow passed. Actual suggestion relevance is not yet consistent enough to call tailoring complete or to justify enabling rewriting. Recommended next scoped change: propose deterministic, prevalidated candidate spans and relevance limits for model selection, then rerun these unchanged usefulness labels. Related-tool-only highlights and unnecessary adjacent skills need explicit handling; never solve them by loosening evidence or source validation. No model-quality pass threshold was invented after seeing this run, and no pass is claimed for generalization or production readiness.
