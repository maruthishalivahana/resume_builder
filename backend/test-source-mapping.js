const assert = require("node:assert/strict");
require("tsx/cjs");
const { ResumeEvidenceParserService } = require("./src/modules/job-tailoring/services/resume-evidence-parser.service.ts");
const Evidence = require("./src/modules/job-tailoring/models/ResumeEvidence.ts").default;
const { buildGroundedSuggestionPrompt } = require("./src/modules/job-tailoring/prompts/grounded-suggestion.prompt.ts");
const { applySourcePatchContent } = require("./src/modules/job-tailoring/services/source-patch.service.ts");

const parser = new ResumeEvidenceParserService();
const block = String.raw`\item Built \textbf{Node.js} REST APIs.` + "\r\n" + String.raw`  using \emph{existing {tools}}.`;
const content = String.raw`\section{Experience}` + "\r\n" + block + "\r\n" + String.raw`\end{itemize}`;
const parsed = parser.parseFiles("p1", "v1", [{ id: "f1", name: "resume.tex", content }]).evidence[0];
assert.equal(parsed.rawText, block, "Parser must retain exact CRLF, indentation and nested braces");
const stored = new Evidence({ ...parsed, evidenceId: parsed.id }).toObject();
assert.equal(stored.rawText, block, "Mongoose must preserve rawText for later generation");
const requirement = { id: "r1", text: "Node.js", category: "skill", importance: "required" };
assert.ok(buildGroundedSuggestionPrompt(requirement, [{ ...stored, id: stored.evidenceId }]).includes(JSON.stringify(block)));

const { createEvidenceSourcePatch, sourceLineRange } = require("./src/modules/job-tailoring/utils/source-range.util.ts");
for (const newline of ["\n", "\r\n"]) {
  const raw = block.replace(/\r\n/g, newline);
  const source = String.raw`\section{Experience}` + newline + raw + newline + String.raw`\end{itemize}` + newline;
  const item = parser.parseFiles("p1", "v1", [{ id: "f1", name: "resume.tex", content: source }]).evidence[0];
  const after = raw.replace("Built", String.raw`\textbf{Built}`);
  const patch = createEvidenceSourcePatch(source, item, { before: raw, after });
  assert.equal(patch.before, raw);
  assert.equal(patch.after, after);
  assert.equal(applySourcePatchContent(source, patch).updatedContent, source.replace(raw, () => after));
  // Normalize only replacement newlines to the captured source convention.
  assert.equal(createEvidenceSourcePatch(source, item, { before: raw, after: after.replace(/\r\n/g, "\n") }).after, after);
  const partial = createEvidenceSourcePatch(source, item, { before: "Node.js", after: String.raw`\textbf{Node.js}` });
  assert.equal(partial.after, raw.replace("Node.js", () => String.raw`\textbf{Node.js}`));
  assert.throws(() => createEvidenceSourcePatch(source, item, { before: item.text, after: "normalized replacement" }), /mapped|source/i);
  assert.throws(() => createEvidenceSourcePatch(source.replace("Built", "Changed"), item, { before: raw, after }), /changed/i);
  assert.throws(() => createEvidenceSourcePatch(source, { ...item, rawText: undefined }, { before: raw, after }), /re.index/i);
  const moved = newline + source;
  assert.equal(applySourcePatchContent(moved, patch).updatedContent, newline + source.replace(raw, () => after));
  assert.throws(() => applySourcePatchContent(raw + newline + raw, { ...patch, lineStart: 99, lineEnd: 100 }), /multiple|ambiguous/i);
  assert.throws(() => applySourcePatchContent(source, { ...patch, beforeHash: "invalid" }), /hash|changed/i);
  const repeated = { ...item, rawText: raw + newline + raw, source: { ...item.source, lineEnd: item.source.lineEnd + 2 } };
  assert.throws(() => createEvidenceSourcePatch(String.raw`\section{Experience}` + newline + repeated.rawText + newline, repeated, { before: "Node.js", after: "new" }), /ambiguous/i);
  const literal = createEvidenceSourcePatch(source, item, { before: "Node.js", after: "$& $` $' $$" });
  assert.ok(literal.after.includes("$& $` $' $$"), "Replacement-string tokens must stay literal");
}
assert.equal(sourceLineRange("one\r\ntwo\nthree", 2, 2).text, "two", "Mixed newline boundaries must be sliced exactly");
assert.equal(sourceLineRange("one\r\ntwo\nthree", 1, 2).text, "one\r\ntwo");
assert.equal(sourceLineRange("one", 0, 1), null);
assert.equal(sourceLineRange("one", 1, 2), null);

// Exercise both production patch-creation callers with isolated in-memory model
// stubs. No MongoDB connection, provider request or write is performed.
process.env.LLM_PROVIDER = "deterministic";
process.env.TAILORING_LLM_PROVIDER = "deterministic";
const { generateSuggestion } = require("./src/modules/job-tailoring/controllers/tailoring.controller.ts");
const { TailoringOrchestratorService } = require("./src/modules/job-tailoring/services/tailoring-orchestrator.service.ts");
const { ResumeIntelligenceService } = require("./src/modules/job-tailoring/services/resume-intelligence.service.ts");
const { HybridRetrievalService } = require("./src/modules/job-tailoring/services/hybrid-retrieval.service.ts");
const { DeterministicTailoringGenerator } = require("./src/modules/job-tailoring/providers/interfaces.ts");
const { LatexFile } = require("./src/models/LatexFile.ts");
const Requirement = require("./src/modules/job-tailoring/models/JobRequirement.ts").default;
const Match = require("./src/modules/job-tailoring/models/ResumeMatch.ts").default;
const Suggestion = require("./src/modules/job-tailoring/models/TailoringSuggestion.ts").default;
const Analysis = require("./src/modules/job-tailoring/models/TailoringAnalysis.ts").default;
const JobTarget = require("./src/modules/job-tailoring/models/JobTarget.ts").default;
const restore = [];
function stub(object, key, value) { const original = object[key]; object[key] = value; restore.push(() => { object[key] = original; }); }

(async () => {
  try {
    for (const newline of ["\n", "\r\n"]) {
      const raw = block.replace(/\r\n/g, newline);
      const source = String.raw`\section{Experience}` + newline + raw + newline + String.raw`\end{itemize}`;
      const item = parser.parseFiles("p1", "v1", [{ id: "f1", name: "resume.tex", content: source }]).evidence[0];
      const record = new Evidence({ ...item, evidenceId: item.id }).toObject();
      let persisted = [], seenRaw = [], currentSource = source;
      const provider = { generate: async ({ evidence }) => {
        assert.equal(evidence[0].rawText, raw, "Generation must receive persisted exact source, not normalized text");
        seenRaw.push(evidence[0].rawText);
        return { type: "highlight", targetEvidenceId: item.id, highlightText: "Built",
          reason: "Highlights an existing fact", evidenceIds: [item.id], confidence: 0.9 };
      } };
      stub(DeterministicTailoringGenerator.prototype, "generate", provider.generate);
      stub(HybridRetrievalService.prototype, "search", async () => ({ results: [] }));
      stub(Requirement, "findOne", () => ({ lean: async () => ({ ...requirement, requirementId: "r1", analysisId: "a1", jobTargetId: "j1", extractedTerms: ["Node.js"], normalizedTerms: ["nodejs"] }) }));
      stub(Match, "findOne", () => ({ lean: async () => ({ classification: "STRONG", confidence: 0.9, evidenceIds: [item.id], evidenceScores: [], reason: "Direct" }) }));
      stub(Evidence, "find", () => ({ lean: async () => [record] }));
      stub(LatexFile, "findOne", () => ({ lean: async () => ({ content: currentSource }) }));
      stub(Suggestion, "create", async value => { persisted.push(value); return value; });
      const res = { status() { return this; }, json(value) { this.body = value; } };
      let error;
      await generateSuggestion({ body: { projectId: "p1", versionId: "v1", requirementId: "r1" } }, res, value => { error = value; });
      assert.equal(error, undefined);
      assert.equal(persisted.length, 1);
      const patch = res.body.data.sourcePatch;
      assert.equal(patch.before, raw);
      assert.equal(patch.after, raw.replace("Built", String.raw`\textbf{Built}`));
      assert.equal(applySourcePatchContent(source, patch).updatedContent, source.replace(raw, () => patch.after));

      currentSource = source.replace("Built", "Changed");
      error = undefined;
      await generateSuggestion({ body: { projectId: "p1", versionId: "v1", requirementId: "r1" } }, res, value => { error = value; });
      assert.equal(error.code, "SOURCE_CHANGED");
      assert.equal(persisted.length, 1, "Changed source must not create another suggestion");
      currentSource = source;

      stub(JobTarget, "create", async () => ({ _id: { toString: () => "j1" } }));
      stub(Analysis, "create", async value => ({ ...value, save: async () => {} }));
      stub(Requirement, "insertMany", async () => []);
      stub(ResumeIntelligenceService.prototype, "buildEvidence", async () => [item]);
      stub(Evidence, "bulkWrite", async () => ({}));
      stub(Match, "updateOne", async () => ({}));
      stub(Match, "find", () => ({ lean: async () => [{ classification: "STRONG" }] }));
      persisted = [];
      const result = await new TailoringOrchestratorService(provider).analyze({ resumeId: "p1", versionId: "v1", rawJobDescription: "Required qualifications:\n- Node.js REST APIs" });
      assert.equal(result.summary.safeSuggestions, 1);
      assert.equal(persisted[0].sourcePatch.before, raw);
      assert.equal(persisted[0].sourcePatch.after, patch.after);
      currentSource = source.replace("Built", "Changed");
      const stale = await new TailoringOrchestratorService(provider).analyze({ resumeId: "p1", versionId: "v1", rawJobDescription: "Required qualifications:\n- Node.js REST APIs" });
      assert.equal(stale.summary.safeSuggestions, 0);
      assert.equal(stale.summary.diagnosticReasons.SOURCE_PATCH_FAILED, 1);
      assert.equal(persisted.length, 1);
      assert.equal(seenRaw.length, 4);
      while (restore.length) restore.pop()();
    }
    console.log("Source mapping tests passed: exact-range units, schema serialization, prompt, and both mocked generation callers");
  } finally { while (restore.length) restore.pop()(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
