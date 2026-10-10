const assert = require("node:assert/strict");
const { GroundedGenerationService } = require("./dist/modules/job-tailoring/services/grounded-generation.service");
const { ClaimValidatorService } = require("./dist/modules/job-tailoring/services/claim-validator.service");

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
  const noSuggestion = new GroundedGenerationService({ generate: async () => null });
  assert.equal(await noSuggestion.generate(input), null, "provider null must produce zero suggestions");

  const timeout = new GroundedGenerationService({ generate: async () => { throw new Error("provider timeout"); } });
  assert.equal(await timeout.generate(input), null, "provider timeout must become an honest zero-suggestion result");

  const malformed = new GroundedGenerationService({ generate: async () => ({ nope: true }) });
  assert.equal(await malformed.generate(input), null, "malformed provider output must not persist");

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
      after: "Built reliable REST APIs using Node.js.", reason: "Clarifies existing work.",
      evidenceIds: ["e1"], confidence: 0.8,
    }),
  }, new ClaimValidatorService());
  const result = await valid.generate(input);
  assert.equal(result.validation.valid, true, "valid grounded edit should be accepted for persistence");
  console.log("M7.6.1 regression tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
