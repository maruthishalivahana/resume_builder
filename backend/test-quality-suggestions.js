const assert = require("node:assert/strict");
const { GroundedGenerationService } = require("./dist/modules/job-tailoring/services/grounded-generation.service");
const { ClaimValidatorService } = require("./dist/modules/job-tailoring/services/claim-validator.service");
const { DeterministicTailoringGenerator } = require("./dist/modules/job-tailoring/providers/interfaces");

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING JD SUGGESTION QUALITY & REGRESSION TESTS");
  console.log("==================================================\n");

  const claimValidator = new ClaimValidatorService();
  const generator = new DeterministicTailoringGenerator();
  const groundedService = new GroundedGenerationService({
    generate: async ({ evidence }) => {
      const target = evidence[0];
      return { type: "highlight", targetEvidenceId: target.id, before: target.text,
        after: `\\textbf{${target.text}}`, reason: "Highlights supplied evidence without adding facts",
        evidenceIds: [target.id], confidence: 0.8 };
    },
  }, undefined, claimValidator);

  const evidenceList = [
    {
      id: "ev-python",
      resumeId: "proj-1",
      versionId: "v1",
      section: "experience",
      type: "bullet",
      text: "Built REST APIs using Python.",
      rawText: "Built REST APIs using Python.",
      source: { fileId: "f1", fileName: "resume.tex", lineStart: 10, lineEnd: 10 },
      technologies: ["Python", "REST API"],
      normalizedTechnologies: ["python", "rest_api"],
      score: 0.9,
    },
    {
      id: "ev-docker",
      resumeId: "proj-1",
      versionId: "v1",
      section: "experience",
      type: "bullet",
      text: "Managed Docker containers on AWS.",
      rawText: "Managed Docker containers on AWS.",
      source: { fileId: "f1", fileName: "resume.tex", lineStart: 12, lineEnd: 12 },
      technologies: ["Docker", "AWS"],
      normalizedTechnologies: ["docker", "aws"],
      score: 0.85,
    },
    {
      id: "ev-summary",
      resumeId: "proj-1",
      versionId: "v1",
      section: "summary",
      type: "paragraph",
      text: "Software engineer focused on scalable cloud backends.",
      rawText: "Software engineer focused on scalable cloud backends.",
      source: { fileId: "f1", fileName: "resume.tex", lineStart: 5, lineEnd: 5 },
      technologies: ["Cloud"],
      normalizedTechnologies: ["cloud"],
      score: 0.75,
    },
  ];

  // Requirement 1: Python & FastAPI
  const req1 = {
    id: "r-python",
    text: "Build microservices in Python and FastAPI",
    category: "skill",
    importance: "required",
    extractedTerms: ["python", "fastapi", "microservices"],
    normalizedTerms: ["python", "fastapi", "microservices"],
  };

  // Requirement 2: Docker & Kubernetes
  const req2 = {
    id: "r-docker",
    text: "Manage Docker containers and Kubernetes clusters",
    category: "skill",
    importance: "required",
    extractedTerms: ["docker", "kubernetes", "containers"],
    normalizedTerms: ["docker", "kubernetes", "containers"],
  };

  console.log("--- Test 1: Target Evidence Selection ---");
  const result1 = await groundedService.generate({
    requirement: req1,
    match: { classification: "STRONG", confidence: 0.9, evidenceIds: ["ev-python"], evidenceScores: [], reason: "Strong" },
    evidence: evidenceList,
  });

  const result2 = await groundedService.generate({
    requirement: req2,
    match: { classification: "STRONG", confidence: 0.85, evidenceIds: ["ev-docker"], evidenceScores: [], reason: "Strong" },
    evidence: evidenceList,
  });

  assert.ok(result1 !== null, "Result 1 must not be null");
  assert.ok(result2 !== null, "Result 2 must not be null");

  assert.equal(result1.suggestion.targetEvidenceId, "ev-python", "Python requirement must target Python evidence");
  assert.equal(result2.suggestion.targetEvidenceId, "ev-docker", "Docker requirement must target Docker evidence");
  console.log("✓ PASS: Requirements target specific relevant evidence items.\n");

  console.log("--- Test 2: No Repetitive Generic Suffixes ---");
  console.log("Suggestion 1 After:", result1.suggestion.after);
  console.log("Suggestion 2 After:", result2.suggestion.after);

  assert.notEqual(result1.suggestion.after, result2.suggestion.after, "Different requirements must produce distinct edits");
  assert.ok(!result1.suggestion.after.endsWith("for production applications."), "Must not use generic hardcoded suffix 'for production applications.'");
  assert.ok(!result2.suggestion.after.endsWith("for production applications."), "Must not use generic hardcoded suffix 'for production applications.'");
  console.log("✓ PASS: Suggestions are requirement-specific without repetitive generic filler.\n");

  for (const [requirement, id] of [[req1, "ev-python"], [req2, "ev-docker"]]) {
    const selected = evidenceList.filter(item => item.id === id);
    assert.equal(await generator.generate({ requirement, evidence: selected,
      constraints: { mustReferenceEvidence: true, mayInventFacts: false, mayChangeMeaning: false } }), null,
      "Deterministic generator must abstain, not manufacture prose");
  }

  console.log("==================================================");
  console.log("ALL QUALITY TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ QUALITY TEST FAILED:", err);
  process.exit(1);
});
