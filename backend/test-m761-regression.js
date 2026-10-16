const assert = require("node:assert/strict");
const { GroundedGenerationService } = require("./dist/modules/job-tailoring/services/grounded-generation.service");
const { ClaimValidatorService } = require("./dist/modules/job-tailoring/services/claim-validator.service");
const { DeterministicTailoringGenerator } = require("./dist/modules/job-tailoring/providers/interfaces");

const evidence = [{
  id: "e1",
  text: "Built REST APIs using Node.js.",
  source: { fileId: "f1", fileName: "resume.tex", lineStart: 1, lineEnd: 1 },
  section: "experience",
  type: "bullet",
  score: 0.9,
  lexicalScore: 0.9,
  semanticScore: 0.9,
  sectionScore: 0,
  qualityScore: 0,
}];
const match = {
  classification: "STRONG",
  confidence: 0.9,
  evidenceIds: ["e1"],
  evidenceScores: [],
  reason: "Exact evidence",
};
const input = {
  requirement: {
    id: "r1", text: "Node.js", category: "skill", importance: "required",
    extractedTerms: ["node.js"], normalizedTerms: ["node.js"],
  },
  match,
  evidence,
};

async function run() {
  let fallbackCalls = 0;
  const fallback = { generate: async () => {
    fallbackCalls += 1;
    throw new Error("Fallback must never be invoked");
  } };
  const abstaining = new GroundedGenerationService({ generate: async () => null }, fallback);
  assert.equal(await abstaining.generate(input), null);
  assert.equal(abstaining.getLastReasonCode(), "NO_EDIT_NEEDED");
  assert.equal(fallbackCalls, 0, "Explicit null must never invoke fallback");

  for (const message of ["provider timeout", "invalid JSON response", "provider unavailable"]) {
    let primaryCalls = 0;
    let fail = true;
    const unavailable = new GroundedGenerationService({ generate: async () => {
      primaryCalls += 1;
      if (fail) throw new Error(message);
      return null;
    } }, fallback);
    assert.equal(await unavailable.generate(input), null);
    assert.equal(unavailable.getLastReasonCode(), "PROVIDER_ERROR");
    assert.equal(primaryCalls, 1, "Failures must not trigger automatic retries");
    assert.equal(fallbackCalls, 0, "Failures must not generate fallback prose");
    fail = false;
    assert.equal(await unavailable.generate(input), null, "A deliberate subsequent call is allowed");
    assert.equal(primaryCalls, 2);
    assert.equal(unavailable.getLastReasonCode(), "NO_EDIT_NEEDED", "Retry must clear the old error reason");
  }

  const label = String.raw`\textbf{Languages:} Python, Java`;
  const labelInput = { ...input, evidence: [{ ...evidence[0], rawText: label, text: "Languages: Python, Java" }] };
  const snapshot = structuredClone(labelInput);
  const labelGenerator = new GroundedGenerationService({ generate: async () => null }, new DeterministicTailoringGenerator());
  assert.equal(await labelGenerator.generate(labelInput), null, "No safe edit must leave LaTeX labels untouched");
  assert.equal(labelGenerator.getLastReasonCode(), "NO_EDIT_NEEDED");
  assert.deepEqual(labelInput, snapshot, "Raw LaTeX, braces and evidence must not be mutated");

  const noSuggestion = new GroundedGenerationService({ generate: async () => null });
  assert.equal(await noSuggestion.generate(input), null, "provider null must produce zero suggestions");

  const timeout = new GroundedGenerationService({ generate: async () => { throw new Error("provider timeout"); } });
  assert.equal(await timeout.generate(input), null, "provider timeout must become an honest zero-suggestion result");

  const malformed = new GroundedGenerationService({ generate: async () => ({ nope: true }) });
  assert.equal(await malformed.generate(input), null, "malformed provider output must not persist");
  assert.equal(malformed.getLastReasonCode(), "INVALID_PROVIDER_OUTPUT");
  const malformedWithFallback = new GroundedGenerationService({ generate: async () => ({ nope: true }) }, fallback);
  assert.equal(await malformedWithFallback.generate(input), null);
  assert.equal(malformedWithFallback.getLastReasonCode(), "INVALID_PROVIDER_OUTPUT");
  assert.equal(fallbackCalls, 0);

  const invalid = new GroundedGenerationService({
    generate: async () => ({
      type: "rewrite", targetEvidenceId: "e1", before: evidence[0].text,
      after: "Built REST APIs using Node.js handling 10000 requests/day.",
      reason: "Unsupported metric", evidenceIds: ["e1"], confidence: 0.8,
    }),
  });
  assert.equal(await invalid.generate(input), null, "claim validation rejection must produce zero suggestions");

  const noop = new GroundedGenerationService({
    generate: async () => ({
      type: "highlight", targetEvidenceId: "e1", before: evidence[0].text,
      after: evidence[0].text, reason: "No edit", evidenceIds: ["e1"], confidence: 0.8,
    }),
  });
  assert.equal(await noop.generate(input), null, "identical before/after must not be a suggestion");

  const valid = new GroundedGenerationService({
    generate: async () => ({
      type: "rewrite", targetEvidenceId: "e1", before: evidence[0].text,
      after: String.raw`\textbf{Built REST APIs using Node.js.}`, reason: "Highlights existing work without adding a claim.",
      evidenceIds: ["e1"], confidence: 0.8,
    }),
  }, fallback, new ClaimValidatorService());
  const result = await valid.generate(input);
  assert.equal(result.validation.valid, true, "valid grounded edit should be accepted for persistence");
  assert.equal(result.suggestion.before, evidence[0].text);
  assert.equal(result.suggestion.after, String.raw`\textbf{Built REST APIs using Node.js.}`);
  assert.equal(result.suggestion.targetEvidenceId, "e1");
  assert.deepEqual(result.suggestion.evidenceIds, ["e1"]);
  assert.equal(result.fallbackUsed, false);
  assert.equal(fallbackCalls, 0);
  console.log("M7.6.1 regression tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
