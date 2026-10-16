# Grounded highlight generation

Provider highlight responses now select an existing literal span:

```json
{"type":"highlight","targetEvidenceId":"e1","highlightText":"Docker","reason":"Emphasize existing skill","evidenceIds":["e1"],"confidence":0.8}
```

The server requires captured raw evidence and a unique exact span. It constructs the full before/after range by inserting `\textbf{...}`; model-authored replacement text is not used. Evidence-reference and claim validation still run before persistence. The persisted suggestion/API response retains the existing before/after shape; source-patch acceptance and revision recovery are unchanged.

Legacy provider highlights remain eligible only when their replacement is exactly one bold insertion into their before text, which must occur uniquely in raw evidence. Markdown labels, additional prose, ambiguous spans, missing raw source and spans inside LaTeX arguments/comments/options/math are rejected. Already formatted spans are rejected to prevent nested formatting. Unknown commands and verbatim contexts are conservatively rejected: this lexical guard does not promise support for arbitrary LaTeX macros.

Rewrite/reorder/keyword contracts remain unchanged. Null/provider failures retain abstention/unavailable behavior. This change neither reduces provider latency nor broadens semantic paraphrase validation.

Verification uses deterministic tests and mocked transport/model interactions, with exact content and CRLF assertions. No live OpenRouter, MongoDB, browser or MiKTeX verification was performed for this change.
