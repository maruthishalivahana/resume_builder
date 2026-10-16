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

  const constraints = { mustReferenceEvidence: true, mayInventFacts: false, mayChangeMeaning: false };
  const originalEvidence = structuredClone(evidence);

  for (const req of requirements) {
    const result = await generator.generate({ requirement: req, evidence, constraints });
    assert.equal(result, null, `Must abstain instead of appending filler for ${req.text}`);
  }
  assert.deepEqual(evidence, originalEvidence);

  for (const rawText of [
    String.raw`\textbf{Languages:} Python, Java`,
    String.raw`\resumeItem{Built \textbf{Node.js} REST APIs.}`,
    String.raw`\item Built React components.`,
  ]) {
    const latexEvidence = [{ ...evidence[0], rawText }];
    const original = structuredClone(latexEvidence);
    assert.equal(await generator.generate({ requirement: requirements[0], evidence: latexEvidence, constraints }), null);
    assert.deepEqual(latexEvidence, original, "LaTeX labels, nested braces and content must remain exact");
  }
  assert.equal(await generator.generate({ requirement: requirements[0], evidence: [], constraints }), null);

  console.log("DeterministicTailoringGenerator tests passed");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
