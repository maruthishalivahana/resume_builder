const assert = require("node:assert/strict");
require("tsx/cjs");
const { GroundedGenerationService } = require("./src/modules/job-tailoring/services/grounded-generation.service.ts");
const { parseGroundedSuggestion } = require("./src/modules/job-tailoring/providers/openrouter-llm.provider.ts");
const { createEvidenceSourcePatch } = require("./src/modules/job-tailoring/utils/source-range.util.ts");
const { buildGroundedSuggestionPrompt } = require("./src/modules/job-tailoring/prompts/grounded-suggestion.prompt.ts");
const { resolveHighlight } = require("./src/modules/job-tailoring/services/highlight-edit.service.ts");
const base = { type: "highlight", targetEvidenceId: "e1", highlightText: "Docker", reason: "Emphasize existing skill", evidenceIds: ["e1"], confidence: 0.8 };
async function generate(raw, proposal = base) {
  const item = { id: "e1", text: raw, rawText: raw, score: 1, source: { fileId: "f1", fileName: "r.tex", lineStart: 1, lineEnd: raw.split(/\r\n|\n/).length } };
  const service = new GroundedGenerationService({ generate: async () => proposal });
  const input = { requirement: { id: "r1", text: "Docker" }, match: { classification: "STRONG", evidenceIds: ["e1"] }, evidence: [item] };
  const output = await service.generate(input);
  return { output, service, item, input };
}
(async () => {
  const raw = String.raw`\item Used Docker and \emph{existing tools}.`;
  const { output, item, input } = await generate(raw);
  assert.ok(output); assert.equal(output.suggestion.before, raw);
  assert.equal(output.suggestion.after, String.raw`\item Used \textbf{Docker} and \emph{existing tools}.`);
  assert.equal(output.validation.valid, true);
  assert.equal(resolveHighlight(base, [{ ...item, rawText: undefined }]), null, "Normalized text must not stand in for missing raw source");
  assert.equal(createEvidenceSourcePatch(raw, item, output.suggestion).after, output.suggestion.after);
  assert.deepEqual(parseGroundedSuggestion(JSON.stringify(base)), base);
  assert.throws(() => parseGroundedSuggestion(JSON.stringify({ ...base, after: "fabricated" })), /replacement/);
  assert.ok(buildGroundedSuggestionPrompt(input.requirement, [item]).includes("highlightText"));
  for (const unsafe of ["Docker Docker", String.raw`\label{Docker}`, String.raw`\textbf{Docker}`,
    String.raw`\emph{Docker}`, "Used APIs. % Docker", "$Docker$", String.raw`\verb|Docker|`,
    String.raw`\item[Docker] Used APIs.`, String.raw`\unknown Docker`, "Used APIs."]) {
    assert.equal((await generate(unsafe)).output, null, unsafe);
  }
  const markdown = { ...base, highlightText: undefined, before: raw, after: "**Key Skill Highlight**: " + raw };
  assert.equal((await generate(raw, markdown)).output, null);
  assert.equal((await generate(raw, { ...base, evidenceIds: ["e1", "unknown"] })).output, null);
  const legacy = { ...base, highlightText: undefined, before: raw, after: output.suggestion.after };
  delete legacy.highlightText;
  assert.equal((await generate(raw, legacy)).output.suggestion.after, output.suggestion.after);
  assert.equal((await generate(raw, { ...legacy, after: output.suggestion.after + " production experience" })).output, null);
  const multiline = "\\item Used Docker.\r\nMore existing text.";
  assert.equal((await generate(multiline)).output.suggestion.after, "\\item Used \\textbf{Docker}.\r\nMore existing text.");
  const noEdit = await generate(raw, null);
  assert.equal(noEdit.output, null); assert.equal(noEdit.service.getLastReasonCode(), "NO_EDIT_NEEDED");
  assert.equal(raw, String.raw`\item Used Docker and \emph{existing tools}.`);
  console.log("Highlight generation passed: exact spans, deterministic bytes, legacy insertion, Markdown rejection, ambiguous/opaque spans, evidence checks and CRLF preservation");
})().catch(error => { console.error(error); process.exitCode = 1; });
