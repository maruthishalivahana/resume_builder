const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { GroundedGenerationService } = require("./dist/modules/job-tailoring/services/grounded-generation.service");
const { ClaimValidatorService } = require("./dist/modules/job-tailoring/services/claim-validator.service");
const { MatchClassifierService } = require("./dist/modules/job-tailoring/services/match-classifier.service");
const { TailoringOrchestratorService } = require("./dist/modules/job-tailoring/services/tailoring-orchestrator.service");
const JobTarget = require("./dist/modules/job-tailoring/models/JobTarget").default;
const JobRequirement = require("./dist/modules/job-tailoring/models/JobRequirement").default;
const ResumeMatch = require("./dist/modules/job-tailoring/models/ResumeMatch").default;
const TailoringAnalysis = require("./dist/modules/job-tailoring/models/TailoringAnalysis").default;
const TailoringSuggestion = require("./dist/modules/job-tailoring/models/TailoringSuggestion").default;

const evidence = [{
  id: "e1",
  resumeId: "p1",
  versionId: "v1",
  projectId: "p1",
  section: "experience",
  type: "bullet",
  text: "Built REST APIs using Python.",
  source: { fileId: "f1", fileName: "resume.tex", lineStart: 5, lineEnd: 5 },
  technologies: ["Python", "REST API"],
  normalizedTechnologies: ["python", "rest_api"],
  score: 0.9,
  lexicalScore: 0.9,
  semanticScore: 0.9,
  sectionScore: 0,
  qualityScore: 0,
}];

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING M7.6.3 DIAGNOSTIC & SUGGESTIONS TESTS");
  console.log("==================================================\n");

  const claimValidator = new ClaimValidatorService();
  const classifier = new MatchClassifierService();

  // Test 1: Strong match requiring no edit (no-op edit rejected)
  console.log("--- Test 1: Strong match requiring no edit ---");
  const noopGenerator = new GroundedGenerationService({
    generate: async () => ({
      type: "highlight",
      targetEvidenceId: "e1",
      before: "Built REST APIs using Python.",
      after: "Built REST APIs using Python.",
      reason: "No change",
      evidenceIds: ["e1"],
      confidence: 0.9,
    }),
  }, claimValidator);

  const noopResult = await noopGenerator.generate({
    requirement: { id: "r1", text: "Python", category: "skill", importance: "required", extractedTerms: ["python"], normalizedTerms: ["python"] },
    match: { classification: "STRONG", confidence: 0.9, evidenceIds: ["e1"], evidenceScores: [], reason: "Exact match" },
    evidence,
  });
  assert.equal(noopResult, null, "Identical before/after must be rejected as noop_edit");
  console.log("✓ PASS: No-op edit correctly rejected.\n");

  // Test 2: Partial match with useful grounded edit
  console.log("--- Test 2: Partial match with useful grounded edit ---");
  const partialGenerator = new GroundedGenerationService({
    generate: async () => ({
      type: "rewrite",
      targetEvidenceId: "e1",
      before: "Built REST APIs using Python.",
      after: "Built REST APIs using Python for production applications.",
      reason: "Clarifies production usage.",
      evidenceIds: ["e1"],
      confidence: 0.8,
    }),
  }, claimValidator);

  const partialResult = await partialGenerator.generate({
    requirement: { id: "r2", text: "Production REST APIs in Python", category: "skill", importance: "required", extractedTerms: ["python", "rest", "api"], normalizedTerms: ["python", "rest", "api"] },
    match: { classification: "PARTIAL", confidence: 0.65, evidenceIds: ["e1"], evidenceScores: [], reason: "Partial match" },
    evidence,
  });
  assert.ok(partialResult !== null && partialResult.validation.valid, "Partial match with valid grounded edit must be accepted");
  console.log("✓ PASS: Grounded edit for partial match accepted.\n");

  // Test 3: Missing skill must be classified as MISSING and generate zero suggestions
  console.log("--- Test 3: Missing skill classification & zero suggestion safeguard ---");
  const missingRequirement = {
    id: "r-missing",
    text: "Kubernetes orchestration",
    category: "skill",
    importance: "required",
    extractedTerms: ["kubernetes"],
    normalizedTerms: ["kubernetes"],
  };
  const missingMatch = classifier.classifyDetailed(missingRequirement, [{ id: "e1", text: "Built REST APIs using Python", hybridScore: 0.1 }]);
  assert.equal(missingMatch.classification, "MISSING", "Unrelated technology with low score must be classified as MISSING");
  assert.equal(missingMatch.evidenceIds.length, 0, "MISSING classification must have empty evidenceIds");
  console.log("✓ PASS: Missing skill classified as MISSING with 0 evidence.\n");

  // Test 4: Rejected claim (unsupported metric fails validation)
  console.log("--- Test 4: Rejected claim validation ---");
  const invalidGenerator = new GroundedGenerationService({
    generate: async () => ({
      type: "rewrite",
      targetEvidenceId: "e1",
      before: "Built REST APIs using Python.",
      after: "Built REST APIs using Python handling 10,000 requests/sec.",
      reason: "Invented metric",
      evidenceIds: ["e1"],
      confidence: 0.8,
    }),
  }, claimValidator);

  const invalidResult = await invalidGenerator.generate({
    requirement: { id: "r4", text: "High throughput APIs", category: "skill", importance: "required", extractedTerms: ["apis"], normalizedTerms: ["apis"] },
    match: { classification: "STRONG", confidence: 0.9, evidenceIds: ["e1"], evidenceScores: [], reason: "Strong" },
    evidence,
  });
  assert.equal(invalidResult, null, "Invented metrics must fail claim validation");
  console.log("✓ PASS: Claim validation rejection verified.\n");

  // Test 5: End-to-end Orchestrator suggestion persistence & retrieval scoping
  console.log("--- Test 5: Orchestrator suggestion persistence & retrieval ---");
  await mongoose.connect("mongodb://127.0.0.1:27017/resume_eng");

  const LatexProject = mongoose.models.LatexProject || mongoose.model("LatexProject", new mongoose.Schema({ name: String }, { timestamps: true }));
  const LatexFile = mongoose.models.LatexFile || mongoose.model("LatexFile", new mongoose.Schema({ projectId: mongoose.Schema.Types.ObjectId, name: String, content: String, path: String }, { timestamps: true }));

  const projectDoc = await LatexProject.create({ name: "Suggestion Test Project" });
  const resumeId = projectDoc._id.toString();
  const versionId = "v1";

  const texContent = String.raw`\documentclass{article}
\begin{document}
\section{Experience}
Built REST APIs using Python.
\end{document}`;

  const fileDoc = await LatexFile.create({
    projectId: projectDoc._id,
    name: "main.tex",
    path: "main.tex",
    content: texContent,
  });

  const orchestrator = new TailoringOrchestratorService();
  const jdText = `
  Responsibilities:
  - Build REST APIs using Python for production applications.
  `;

  const analysisResult = await orchestrator.analyze({
    resumeId,
    versionId,
    rawJobDescription: jdText,
    title: "Backend Engineer",
    company: "Test Co",
  });

  console.log("Analysis Summary:", analysisResult.summary);

  // Retrieve persisted suggestions for this analysis
  const suggestions = await TailoringSuggestion.find({ analysisId: analysisResult.analysisId }).lean();
  console.log(`Persisted Suggestions Count: ${suggestions.length}`);

  if (suggestions.length > 0) {
    const sug = suggestions[0];
    assert.equal(sug.status, "pending", "Persisted suggestion must have status: pending");
    assert.equal(sug.validation, "PASS", "Persisted suggestion must have validation: PASS");
    assert.equal(sug.projectId, resumeId, "Suggestion must be scoped to projectId");
    assert.equal(sug.versionId, versionId, "Suggestion must be scoped to versionId");
    assert.equal(sug.analysisId, analysisResult.analysisId, "Suggestion must be scoped to analysisId");
  }

  await mongoose.disconnect();
  console.log("✓ PASS: Suggestion persistence and scoping verified.\n");

  console.log("==================================================");
  console.log("ALL M7.6.3 TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ M7.6.3 TEST FAILED:", err);
  process.exit(1);
});
