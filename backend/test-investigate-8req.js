const mongoose = require("mongoose");
const { TailoringOrchestratorService } = require("./dist/modules/job-tailoring/services/tailoring-orchestrator.service");
const { RequirementExtractorService } = require("./dist/modules/job-tailoring/services/requirement-extractor.service");
const { OpenRouterLLMProvider } = require("./dist/modules/job-tailoring/providers/openrouter-llm.provider");
const { DeterministicTailoringGenerator } = require("./dist/modules/job-tailoring/providers/interfaces");

const LatexProject = mongoose.models.LatexProject || mongoose.model("LatexProject", new mongoose.Schema({ name: String }, { timestamps: true }));
const LatexFile = mongoose.models.LatexFile || mongoose.model("LatexFile", new mongoose.Schema({ projectId: mongoose.Schema.Types.ObjectId, name: String, content: String, path: String }, { timestamps: true }));

const jd8 = `
Senior Software Engineer - Cloud & APIs

Responsibilities:
- Build high-concurrency RESTful microservices in Python and FastAPI.
- Manage Docker containers and Kubernetes clusters on AWS cloud.
- Implement CI/CD pipelines with GitHub Actions.
- Collaborate with frontend engineers to integrate GraphQL endpoints.
- Lead architectural design reviews and mentor junior developers.

Qualifications:
- 5+ years of software development experience.
- Bachelor's degree in Computer Science or Software Engineering.
- Experience with PostgreSQL and Redis data stores.
`;

async function runInvestigation() {
  await mongoose.connect("mongodb://127.0.0.1:27017/resume_eng");

  const projectDoc = await LatexProject.create({ name: "Audit 8-Req Investigation" });
  const resumeId = projectDoc._id.toString();
  const versionId = "v1";

  await LatexFile.create({
    projectId: projectDoc._id,
    name: "main.tex",
    path: "main.tex",
    content: String.raw`\documentclass{article}
\begin{document}
\section{Experience}
Software Engineer at Acme Corp. Built REST APIs using Python and FastAPI. Managed Docker containers on AWS.
\end{document}`,
  });

  console.log("=== STARTING 8-REQUIREMENT ANALYSIS INVESTIGATION ===");
  console.log("Environment LLM_PROVIDER:", process.env.LLM_PROVIDER || "not set (defaults to Deterministic)");
  console.log("Environment OPENROUTER_API_KEY set?:", Boolean(process.env.OPENROUTER_API_KEY?.trim()));

  const orchestrator = new TailoringOrchestratorService();
  const result = await orchestrator.analyze({
    resumeId,
    versionId,
    rawJobDescription: jd8,
    title: "Senior Software Engineer",
    company: "Cloud Corp",
  });

  console.log("\n=== ANALYSIS RESULT SUMMARY ===");
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

runInvestigation().catch((err) => {
  console.error("Investigation error:", err);
  process.exit(1);
});
