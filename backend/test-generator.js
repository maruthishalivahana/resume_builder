const assert = require("node:assert/strict");
const { DeterministicTailoringGenerator } = require("./dist/modules/job-tailoring/providers/interfaces");

async function runTests() {
  const generator = new DeterministicTailoringGenerator();

  const evidence = [
    { id: "ev-1", text: "Built React components for frontend interface.", section: "experience", type: "bullet", score: 0.8 },
    { id: "ev-2", text: "Developed Node.js REST API with Express.", section: "experience", type: "bullet", score: 0.8 },
    { id: "ev-3", text: "Integrated AI features using OpenAI API.", section: "experience", type: "bullet", score: 0.8 },
    { id: "ev-4", text: "Tuned PostgreSQL database queries for performance.", section: "experience", type: "bullet", score: 0.8 },
  ];

  const requirements = [
    { id: "req-1", text: "React frontend", category: "skill", extractedTerms: ["React", "frontend"] },
    { id: "req-2", text: "Node.js API", category: "skill", extractedTerms: ["Node.js", "API"] },
    { id: "req-3", text: "AI integration", category: "experience", extractedTerms: ["AI", "integration"] },
    { id: "req-4", text: "Database tuning", category: "experience", extractedTerms: ["Database", "tuning"] },
  ];

  const constraints = { mustReferenceEvidence: true };

  const results = [];
  for (const req of requirements) {
    const result = await generator.generate({ requirement: req, evidence, constraints });
    assert.ok(result, `Should generate result for ${req.text}`);
    results.push(result);
  }

  // Assert distinct target evidence
  assert.equal(results[0].targetEvidenceId, "ev-1");
  assert.equal(results[1].targetEvidenceId, "ev-2");
  assert.equal(results[2].targetEvidenceId, "ev-3");
  assert.equal(results[3].targetEvidenceId, "ev-4");

  // Assert distinct reasoning and after states
  const uniqueEvidenceIds = new Set(results.map(r => r.targetEvidenceId));
  assert.equal(uniqueEvidenceIds.size, 4, "All edits should target distinct evidence");

  console.log("DeterministicTailoringGenerator tests passed");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
