require('dotenv').config();
const { TailoringOrchestratorService } = require("./dist/modules/job-tailoring/services/tailoring-orchestrator.service");
const { LatexProject } = require("./dist/models/LatexProject");
const { LatexFile } = require("./dist/models/LatexFile");
const ResumeEvidence = require("./dist/modules/job-tailoring/models/ResumeEvidence").default;
const ResumeMatch = require("./dist/modules/job-tailoring/models/ResumeMatch").default;
const TailoringSuggestion = require("./dist/modules/job-tailoring/models/TailoringSuggestion").default;
const JobTarget = require("./dist/modules/job-tailoring/models/JobTarget").default;
const TailoringAnalysis = require("./dist/modules/job-tailoring/models/TailoringAnalysis").default;
const { ResumeIntelligenceService } = require("./dist/modules/job-tailoring/services/resume-intelligence.service");
const mongoose = require("mongoose");

async function traceProvider(providerEnv, overrideKey = null) {
  console.log(`\n===========================================`);
  console.log(`TRACING PROVIDER ENV: ${providerEnv} (Override Key: ${!!overrideKey})`);
  console.log(`===========================================`);
  
  process.env.LLM_PROVIDER = providerEnv;
  if (overrideKey) {
    process.env.OPENROUTER_API_KEY = overrideKey;
  } else {
    // Reload original from dotenv just in case
    require('dotenv').config();
  }

  const orchestrator = new TailoringOrchestratorService();
  const intelligence = new ResumeIntelligenceService();

  const project = await LatexProject.create({
    userId: new mongoose.Types.ObjectId(),
    name: `Trace Project ${providerEnv}`,
    status: "active",
  });
  
  const fileContent = `\\section{Skills}
\\begin{itemize}
\\item {React frontend development and Next.js applications}
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

  await intelligence.indexResume({ projectId: project._id.toString(), versionId });
  
  const jd = `Requirements: Experience with React frontend development`;

  try {
    const result = await orchestrator.analyze({
      resumeId: project._id.toString(),
      versionId,
      rawJobDescription: jd,
      title: "Trace Engineer",
      company: "Trace Corp",
    });
    console.log("Analysis Finished.");
  } catch (err) {
    console.log("Analysis encountered error:", err.message);
  }

  // Cleanup
  await LatexProject.deleteOne({ _id: project._id });
  await LatexFile.deleteOne({ _id: file._id });
  await ResumeEvidence.deleteMany({ projectId: project._id });
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/resume_builder", {
    serverSelectionTimeoutMS: 2000,
  });

  // 1. Trace deterministic
  await traceProvider("deterministic");

  // 2. Trace OpenRouter (Successful request, might be NO_OP_EDIT)
  await traceProvider("openrouter");

  // 3. Trace OpenRouter (Simulated Failure with bad API key)
  await traceProvider("openrouter", "sk-invalid-key-12345");

  await mongoose.disconnect();
}

run().catch(console.error);
