require('dotenv').config();
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { TailoringOrchestratorService } = require("./dist/modules/job-tailoring/services/tailoring-orchestrator.service");
const { LatexProject } = require("./dist/models/LatexProject");
const { LatexFile } = require("./dist/models/LatexFile");
const ResumeEvidence = require("./dist/modules/job-tailoring/models/ResumeEvidence").default;
const ResumeMatch = require("./dist/modules/job-tailoring/models/ResumeMatch").default;
const TailoringSuggestion = require("./dist/modules/job-tailoring/models/TailoringSuggestion").default;
const JobTarget = require("./dist/modules/job-tailoring/models/JobTarget").default;
const TailoringAnalysis = require("./dist/modules/job-tailoring/models/TailoringAnalysis").default;
const { ResumeIntelligenceService } = require("./dist/modules/job-tailoring/services/resume-intelligence.service");

async function runE2ETest() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/resume_builder", {
    serverSelectionTimeoutMS: 2000,
  });

  const orchestrator = new TailoringOrchestratorService();
  const intelligence = new ResumeIntelligenceService();

  // 1. Create Mock Project & File
  const project = await LatexProject.create({
    userId: new mongoose.Types.ObjectId(),
    name: "E2E Tailoring Resume",
    status: "active",
  });
  
  const fileContent = `\\section{Skills}
\\begin{itemize}
\\item {React frontend development and Next.js applications}
\\item {Node.js REST APIs and backend architecture}
\\item {MongoDB and NoSQL database management}
\\item {AI and LLM integration using OpenAI models}
\\end{itemize}`;

  const file = await LatexFile.create({
    projectId: project._id,
    name: "resume.tex",
    path: "/",
    content: fileContent,
    language: "latex",
    isMaster: true,
  });

  const versionId = new mongoose.Types.ObjectId().toString();

  // 2. Build and Index Evidence
  const stats = await intelligence.indexResume({ projectId: project._id.toString(), versionId });
  assert.equal(stats.evidenceCount, 4, "Should extract 4 pieces of evidence");
  
  const jd = `We are looking for a Full Stack Engineer.
  Requirements:
  - Experience with React frontend development
  - Experience building scalable Node.js REST APIs
  - Experience with MongoDB and NoSQL databases
  - Experience with AI and LLM implementation (OpenAI preferred)`;

  // 3. Run Analysis
  console.log("Running tailoring orchestrator...");
  const result = await orchestrator.analyze({
    resumeId: project._id.toString(),
    versionId,
    rawJobDescription: jd,
    title: "Full Stack AI Engineer",
    company: "Tech Corp",
  });

  console.log("Analysis Summary:", result.summary);

  // 4. Verify Provider Identity
  const provider = result.summary.diagnosticReasons?.PROVIDER_ERROR ? "ERROR" : (process.env.LLM_PROVIDER === "openrouter" ? "OpenRouterLLMProvider" : "DeterministicTailoringGenerator");
  console.log(`Provider used: ${provider}`);
  
  // 5. Verify Evidence IDs Survived Classification
  const matches = await ResumeMatch.find({ analysisId: result.analysisId }).lean();
  assert.ok(matches.length >= 4, "Should classify at least 4 requirements");
  for (const match of matches) {
    if (match.classification === "STRONG" || match.classification === "PARTIAL") {
      assert.ok(match.evidenceIds.length >= 1, `Match ${match.requirementId} should retain eligible evidence IDs`);
    }
  }

  // 6. Verify distinct patches & source anchors
  const suggestions = await TailoringSuggestion.find({ analysisId: result.analysisId }).lean();
  assert.ok(suggestions.length > 0, "Should generate at least some safe suggestions");
  
  const uniqueTargets = new Set(suggestions.map(s => s.targetEvidenceId));
  assert.ok(uniqueTargets.size >= suggestions.length, "Different requirements should not receive the same generic patch");

  for (const suggestion of suggestions) {
    assert.ok(suggestion.sourcePatch.before, "Source patch before must be populated");
    assert.ok(suggestion.sourcePatch.after, "Source patch after must be populated");
    
    // Assert exactly 1 occurrence in source file
    const sourceOccurrences = fileContent.split(suggestion.sourcePatch.before).length - 1;
    assert.equal(sourceOccurrences, 1, `Source anchor must perfectly match raw text in file exactly once. Target: ${suggestion.sourcePatch.before}`);
  }

  console.log(`Successfully verified ${suggestions.length} safe suggestions with perfect source anchors.`);
  
  // Cleanup
  await LatexProject.deleteOne({ _id: project._id });
  await LatexFile.deleteOne({ _id: file._id });
  await ResumeEvidence.deleteMany({ projectId: project._id });
  await ResumeMatch.deleteMany({ analysisId: result.analysisId });
  await TailoringSuggestion.deleteMany({ analysisId: result.analysisId });
  await JobTarget.deleteMany({ _id: result.jobTargetId });
  await TailoringAnalysis.deleteMany({ analysisId: result.analysisId });
  
  await mongoose.disconnect();
}

runE2ETest().then(() => {
  console.log("E2E Tailoring Regression Test Passed.");
  process.exit(0);
}).catch(err => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
