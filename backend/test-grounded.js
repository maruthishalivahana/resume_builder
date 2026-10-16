const assert = require("node:assert/strict");
const { parseGroundedSuggestion } = require("./dist/modules/job-tailoring/providers/openrouter-llm.provider");
const { ClaimValidatorService } = require("./dist/modules/job-tailoring/services/claim-validator.service");

const evidence = [{
  id: "e1",
  text: "Built REST APIs using Node.js.",
  technologies: ["Node.js", "REST APIs"],
  normalizedTechnologies: ["nodejs", "rest_api"],
  source: { fileId: "f1", fileName: "resume.tex", lineStart: 1, lineEnd: 1 },
  section: "Experience",
  type: "bullet",
}];
const valid = parseGroundedSuggestion(JSON.stringify({
  type: "rewrite", targetEvidenceId: "e1", before: evidence[0].text,
  after: String.raw`\textbf{Built REST APIs using Node.js.}`, reason: "Highlights the existing work without adding a claim.",
  evidenceIds: ["e1"], confidence: 0.8,
}));
assert.equal(new ClaimValidatorService().validate(valid, evidence), "PASS");
const invalid = { ...valid, after: "Built REST APIs using Node.js handling 10,000 requests/day." };
assert.equal(new ClaimValidatorService().validate(invalid, evidence), "FAIL");
assert.throws(() => parseGroundedSuggestion("not json"), /invalid JSON/i);
console.log("Grounded generation tests passed");
