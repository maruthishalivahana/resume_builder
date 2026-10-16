const assert = require("node:assert/strict");
const { ClaimValidatorService } = require("./dist/modules/job-tailoring/services/claim-validator.service");
const { GroundedGenerationService } = require("./dist/modules/job-tailoring/services/grounded-generation.service");

const validator = new ClaimValidatorService();
const evidence = [{
  id: "e1", text: "Built REST APIs using Node.js.", section: "experience", type: "bullet",
  technologies: ["Node.js", "REST APIs"], normalizedTechnologies: ["nodejs", "rest_api"],
  source: { fileId: "f1", fileName: "resume.tex", lineStart: 1, lineEnd: 1 }, score: 0.9,
}];
const suggestion = (after, overrides = {}) => ({
  type: "rewrite", targetEvidenceId: "e1", before: evidence[0].text, after,
  reason: "Uses supplied evidence.", evidenceIds: ["e1"], confidence: 0.8, ...overrides,
});
let checks = 0;
function check(after, expected, supplied = evidence, overrides = {}) {
  const claim = suggestion(after, overrides);
  const result = validator.validateDetailed(claim, supplied);
  assert.equal(result.valid, expected, JSON.stringify({ claim, result }));
  assert.equal(validator.validate(claim, supplied), expected ? "PASS" : "FAIL");
  assert.deepEqual(Object.keys(result).sort(), ["evidenceIds", "unsupportedClaims", "valid", "warnings"]);
  assert.ok(Array.isArray(result.evidenceIds));
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.unsupportedClaims.every(item => typeof item.claim === "string" && typeof item.reason === "string"));
  if (!expected) assert.ok(result.unsupportedClaims.length > 0);
  checks += 1;
  return result;
}

check("Built REST APIs using Node.js and TensorFlow.", false);
check("Built REST APIs using Node.js for production applications.", false);
check("Built reliable REST APIs using Node.js.", false);
check("Implemented REST APIs using Node.js.", false); // Unverified paraphrases deliberately abstain.
check("Professional Node.js production application experience.", false);
const mixed = check(evidence[0].text, false, evidence, { evidenceIds: ["e1", "unknown"] });
assert.deepEqual(mixed.evidenceIds, ["e1", "unknown"], "Unknown references must be reported, not silently discarded");
check(evidence[0].text, false, evidence, { targetEvidenceId: "unknown", evidenceIds: ["unknown"] });
for (const ids of [[], undefined, null, "e1", ["e1", null], ["e1", 42], ["e1", ""], ["e1", " e1"]]) {
  check(evidence[0].text, false, evidence, { evidenceIds: ids });
}
check(evidence[0].text, false, []);
check(evidence[0].text, false, evidence, { targetEvidenceId: "unknown" });
check(evidence[0].text, true);
check(String.raw`\textbf{Built REST APIs using Node.js.}`, true);
check("Node.js", true);
check("TensorFlow", false);
check("Java", false, [{ ...evidence[0], technologies: ["JavaScript"], text: "JavaScript" }]);
check("Built REST APIs using Node.js handling 10000 requests/day.", false);
check("Built REST APIs using Node.js, reducing latency by 50%.", false);
check("Award-winning Node.js expert.", false);
check("Proficient in Node.js.", false);
check("Led a Node.js engineering team.", false);
check("AWS Certified Developer.", false);
check("Built REST APIs using Node.js and TensorFlow.", false, evidence, {
  before: "Built REST APIs using Node.js and TensorFlow.",
});
check("Built REST APIs using Node.js.", false, [{ ...evidence[0], text: "Never built REST APIs using Node.js." }]);
check("Built REST APIs using Node.js.", false, [{ ...evidence[0], text: "Built REST APIs using Node.js. Only a coursework project." }]);
check("Built REST APIs using Node.js.", false, [{ ...evidence[0], text: "Hypothetical scenario. Built REST APIs using Node.js." }]);
check("Expert in Node.js.", false, [{ ...evidence[0], text: "Learning Node.js" }]);
check("Node.js", false, [{ ...evidence[0], text: "No Node.js experience." }]);
check("Built TensorFlow applications in production, reducing latency by 50%.", true, [{
  ...evidence[0], text: "Built TensorFlow applications in production, reducing latency by 50%.", technologies: ["TensorFlow"],
}]);
check("Proficient in Node.js.", true, [{ ...evidence[0], text: "Proficient in Node.js." }]);
check("AWS Certified Developer.", true, [{ ...evidence[0], text: "AWS Certified Developer." }]);
check("Built REST APIs using Node.js handling 10000 requests/day.", true, [{ ...evidence[0], text: "Built REST APIs using Node.js handling 10000 requests/day." }]);
check("Improved availability by 50%.", false, [{ ...evidence[0], text: "Reduced latency by 50%." }]);
check("TensorFlow", true, [{ ...evidence[0], text: "ML tools", technologies: ["TensorFlow"] }]);
check("Used TensorFlow in production.", false, [{ ...evidence[0], text: "ML tools", technologies: ["TensorFlow"] }]);
check("Node.js, TensorFlow", true, [{ ...evidence[0], text: "Tools", technologies: ["Node.js", "TensorFlow"] }]);
const multiple = [evidence[0], { ...evidence[0], id: "e2", text: "Deployed Docker services." }];
check("Deployed Docker services. Built REST APIs using Node.js.", true, multiple, { evidenceIds: ["e1", "e2"] });
check("Built REST APIs using Node.js.", false, [evidence[0], { ...evidence[0], text: "Other content" }]);
check("", false);
check(String.raw`\textbf{}`, false);

(async () => {
  const input = {
    requirement: { id: "r1", text: "Node.js", category: "skill", importance: "required", extractedTerms: ["Node.js"], normalizedTerms: ["nodejs"] },
    match: { classification: "STRONG", confidence: 0.9, evidenceIds: ["e1"], evidenceScores: [], reason: "Exact evidence" },
    evidence,
  };
  for (const claim of [suggestion("TensorFlow production experience."), suggestion(String.raw`\textbf{Built REST APIs using Node.js.}`, { evidenceIds: ["e1", "unknown"] })]) {
    const generator = new GroundedGenerationService({ generate: async () => claim });
    assert.equal(await generator.generate(input), null);
    assert.equal(generator.getLastReasonCode(), "CLAIM_VALIDATION_FAILED");
  }
  console.log(`Claim validator tests passed (${checks} deterministic cases + generation reason-code checks)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
