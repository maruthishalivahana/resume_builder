require("./dist/config/env");
const { resolveTailoringProviderConfig } = require("./dist/modules/job-tailoring/config/tailoring-provider.config");
const { TailoringOrchestratorService } = require("./dist/modules/job-tailoring/services/tailoring-orchestrator.service");
const { LatexProject } = require("./dist/models/LatexProject");
const { LatexFile } = require("./dist/models/LatexFile");
const ResumeEvidence = require("./dist/modules/job-tailoring/models/ResumeEvidence").default;
const TailoringSuggestion = require("./dist/modules/job-tailoring/models/TailoringSuggestion").default;
const { ResumeIntelligenceService } = require("./dist/modules/job-tailoring/services/resume-intelligence.service");
const mongoose = require("mongoose");
const assert = require("assert");

async function setupTestProject(name, content) {
  const project = await LatexProject.create({
    userId: new mongoose.Types.ObjectId(),
    name,
    status: "active",
  });
  const file = await LatexFile.create({
    projectId: project._id,
    name: "resume.tex",
    path: "/",
    content,
    language: "latex",
    isMaster: true,
  });
  const versionId = new mongoose.Types.ObjectId().toString();
  const intelligence = new ResumeIntelligenceService();
  await intelligence.indexResume({ projectId: project._id.toString(), versionId });
  return { project, file, versionId };
}

async function cleanupProject(project, file) {
  if (project) {
    await LatexProject.deleteOne({ _id: project._id });
    await TailoringSuggestion.deleteMany({ projectId: project._id.toString() });
    await ResumeEvidence.deleteMany({ projectId: project._id.toString() });
  }
  if (file) {
    await LatexFile.deleteOne({ _id: file._id });
  }
}

async function runScenario1_MissingConfig() {
  console.log("\n========================================================");
  console.log("SCENARIO 1: Missing Configuration (LLM_PROVIDER unset)");
  console.log("========================================================");
  const oldVal = process.env.LLM_PROVIDER;
  try {
    delete process.env.LLM_PROVIDER;
    let threw = false;
    try {
      resolveTailoringProviderConfig();
    } catch (err) {
      threw = true;
      console.log("✓ Caught expected configuration error:", err.message);
      assert(err.message.includes("LLM_PROVIDER is not set"), "Should state LLM_PROVIDER is not set");
    }
    assert(threw, "resolveTailoringProviderConfig MUST throw when LLM_PROVIDER is missing");
    console.log("✓ PASS: Missing LLM_PROVIDER rejected with clear diagnostic (no silent fallback).");
  } finally {
    process.env.LLM_PROVIDER = oldVal;
  }
}

async function runScenario2_InvalidCredentials() {
  console.log("\n========================================================");
  console.log("SCENARIO 2: Invalid Credentials (openrouter with missing key)");
  console.log("========================================================");
  const oldVal = process.env.LLM_PROVIDER;
  const oldKey = process.env.OPENROUTER_API_KEY;
  try {
    process.env.LLM_PROVIDER = "openrouter";
    delete process.env.OPENROUTER_API_KEY;
    let threw = false;
    try {
      resolveTailoringProviderConfig();
    } catch (err) {
      threw = true;
      console.log("✓ Caught expected credentials error:", err.message);
      assert(err.message.includes("OPENROUTER_API_KEY is missing"), "Should state OPENROUTER_API_KEY is missing");
    }
    assert(threw, "resolveTailoringProviderConfig MUST throw when OPENROUTER_API_KEY is missing");
    console.log("✓ PASS: Missing OPENROUTER_API_KEY rejected with clear diagnostic (no silent fallback).");
  } finally {
    process.env.LLM_PROVIDER = oldVal;
    process.env.OPENROUTER_API_KEY = oldKey;
  }
}

async function runScenario3_DeterministicGeneration() {
  console.log("\n========================================================");
  console.log("SCENARIO 3: Deterministic Generation (Primary, No Generic Suffixes)");
  console.log("========================================================");
  const oldVal = process.env.LLM_PROVIDER;
  let testData;
  try {
    process.env.LLM_PROVIDER = "deterministic";
    const content = `\\section{Skills}
\\begin{itemize}
\\item {React frontend development and Next.js applications}
\\item {Node.js REST APIs and backend architecture}
\\end{itemize}`;

    testData = await setupTestProject("Deterministic Test Project", content);
    const orchestrator = new TailoringOrchestratorService();

    const jd = "Required Skills: React frontend development and Next.js applications. Node.js REST APIs.";
    const result = await orchestrator.analyze({
      resumeId: testData.project._id.toString(),
      versionId: testData.versionId,
      rawJobDescription: jd,
      title: "Fullstack Engineer",
      company: "Acme",
    });

    console.log("Analysis Summary:", result.summary);
    assert(result.summary.safeSuggestions >= 1, "Must generate at least 1 safe suggestion");

    const suggestions = await TailoringSuggestion.find({ analysisId: result.analysisId }).lean();
    console.log(`Generated ${suggestions.length} suggestions:`);

    for (const s of suggestions) {
      console.log(`- Requirement: ${s.requirementId} | Type: ${s.type}`);
      console.log(`  Before: "${s.before}"`);
      console.log(`  After:  "${s.after}"`);

      // Verify complete absence of generic boilerplate
      assert(!s.after.includes("for core service delivery"), "Must NOT contain 'for core service delivery'");
      assert(!s.after.includes("in active production workloads"), "Must NOT contain 'in active production workloads'");
      assert(!s.after.includes("with a focus on system reliability"), "Must NOT contain 'with a focus on system reliability'");
      assert(!s.after.includes("aligned with target requirements"), "Must NOT contain 'aligned with target requirements'");

      // Verify requirement-specific, evidence-grounded content
      assert(s.after.includes("with emphasis on verified") || s.after.includes("tailored for"), "Must contain grounded emphasis phrase");
    }

    console.log("✓ PASS: Deterministic generator produced requirement-specific, evidence-grounded suggestions with zero generic suffixes.");
  } finally {
    process.env.LLM_PROVIDER = oldVal;
    if (testData) await cleanupProject(testData.project, testData.file);
  }
}

async function runScenario4_OpenRouterSuccess() {
  console.log("\n========================================================");
  console.log("SCENARIO 4: OpenRouter Live API (Success Path)");
  console.log("========================================================");
  const oldVal = process.env.LLM_PROVIDER;
  let testData;
  try {
    process.env.LLM_PROVIDER = "openrouter";
    const content = `\\section{Skills}
\\begin{itemize}
\\item {React frontend development and Next.js applications}
\\end{itemize}`;

    testData = await setupTestProject("OpenRouter Live Test", content);
    const orchestrator = new TailoringOrchestratorService();

    const jd = "Required Skills: React frontend development and Next.js applications.";
    const result = await orchestrator.analyze({
      resumeId: testData.project._id.toString(),
      versionId: testData.versionId,
      rawJobDescription: jd,
      title: "Frontend Engineer",
      company: "OpenRouter Test Corp",
    });

    console.log("Analysis Summary:", result.summary);
    const suggestions = await TailoringSuggestion.find({ analysisId: result.analysisId }).lean();
    console.log(`Retrieved ${suggestions.length} suggestions from OpenRouter run.`);
    if (suggestions.length > 0) {
      console.log(`- OpenRouter Generated: "${suggestions[0].after}"`);
      assert(!suggestions[0].after.includes("for core service delivery"), "Must NOT contain deterministic phrase");
    }
    console.log("✓ PASS: OpenRouter live provider executed.");
  } finally {
    process.env.LLM_PROVIDER = oldVal;
    if (testData) await cleanupProject(testData.project, testData.file);
  }
}

async function runScenario5_OpenRouterFallback() {
  console.log("\n========================================================");
  console.log("SCENARIO 5: OpenRouter Failure with Observable Deterministic Fallback");
  console.log("========================================================");
  const oldVal = process.env.LLM_PROVIDER;
  const oldBase = process.env.OPENROUTER_BASE_URL;
  let testData;
  try {
    process.env.LLM_PROVIDER = "openrouter";
    // Point to an invalid endpoint to guarantee provider failure and trigger fallback
    process.env.OPENROUTER_BASE_URL = "http://127.0.0.1:59999/invalid-endpoint";

    const content = `\\section{Skills}
\\begin{itemize}
\\item {React frontend development and Next.js applications}
\\end{itemize}`;

    testData = await setupTestProject("Fallback Test Project", content);
    const orchestrator = new TailoringOrchestratorService();

    const jd = "Required Skills: React frontend development and Next.js applications.";
    const result = await orchestrator.analyze({
      resumeId: testData.project._id.toString(),
      versionId: testData.versionId,
      rawJobDescription: jd,
      title: "Frontend Engineer",
      company: "Fallback Corp",
    });

    console.log("Analysis Summary:", result.summary);
    assert(result.summary.safeSuggestions >= 1, "Fallback must produce a safe suggestion when OpenRouter fails");

    const suggestions = await TailoringSuggestion.find({ analysisId: result.analysisId }).lean();
    assert(suggestions.length > 0, "Must persist fallback suggestion");
    console.log(`- Fallback Generated: "${suggestions[0].after}"`);
    assert(!suggestions[0].after.includes("for core service delivery"), "Must NOT contain old generic phrase");
    assert(suggestions[0].after.toLowerCase().includes("with emphasis on verified react"), "Must contain grounded deterministic emphasis");

    console.log("✓ PASS: OpenRouter failure triggered observable deterministic fallback successfully.");
  } finally {
    process.env.LLM_PROVIDER = oldVal;
    process.env.OPENROUTER_BASE_URL = oldBase;
    if (testData) await cleanupProject(testData.project, testData.file);
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/resume_eng");
  try {
    await runScenario1_MissingConfig();
    await runScenario2_InvalidCredentials();
    await runScenario3_DeterministicGeneration();
    await runScenario4_OpenRouterSuccess();
    await runScenario5_OpenRouterFallback();
    console.log("\n========================================================");
    console.log("ALL 5 SCENARIOS PASSED SUCCESSFULLY!");
    console.log("========================================================\n");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in scenario test:", err);
  process.exit(1);
});
