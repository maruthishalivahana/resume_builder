const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { RequirementExtractorService } = require("./dist/modules/job-tailoring/services/requirement-extractor.service");
const { TailoringOrchestratorService } = require("./dist/modules/job-tailoring/services/tailoring-orchestrator.service");
const JobTarget = require("./dist/modules/job-tailoring/models/JobTarget").default;
const JobRequirement = require("./dist/modules/job-tailoring/models/JobRequirement").default;
const ResumeMatch = require("./dist/modules/job-tailoring/models/ResumeMatch").default;
const TailoringAnalysis = require("./dist/modules/job-tailoring/models/TailoringAnalysis").default;

const aiAgentJD = `
Senior AI Agent Engineer

About the Role:
We are looking for a Senior AI Agent Engineer to design, build, and deploy intelligent AI agents and RAG systems. You will work on scalable backend services and cloud infrastructure.

Responsibilities:
- Design and build production-grade LLM applications and RAG pipelines using Python and REST APIs.
- Deploy microservices and AI workloads using Docker and cloud deployment tools (AWS/GCP).
- Collaborate with product and architecture teams with strong ownership and curiosity.

Required Qualifications:
- 5+ years of software development experience in Python.
- Proven experience building REST APIs, LLMs, and RAG architectures.
- Experience with Docker and cloud deployment platforms.
- Strong communication and problem-solving skills.

Preferred Qualifications:
- Master's degree or PhD in Computer Science or related field.
- Experience with vector databases (Pinecone/Weaviate/Qdrant) and LangChain.
- AWS Certified Solutions Architect certification.
`;

const frontendJD = `
Senior Frontend Engineer

Responsibilities:
- Build responsive web applications using React and Next.js.
- Optimize web performance and accessibility.

Qualifications:
- 4+ years of experience in TypeScript and CSS.
- Bachelor's degree in Computer Science or equivalent experience.
`;

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING M7.6.2 REQUIREMENT SEGMENTATION TESTS");
  console.log("==================================================\n");

  const extractor = new RequirementExtractorService();

  // Test 1: Extraction & Segmentation
  console.log("--- Test 1: Extract requirements from AI-agent JD ---");
  const reqs = extractor.extract(aiAgentJD);
  console.log(`Extracted ${reqs.length} individual requirements.`);

  assert.ok(reqs.length >= 8, `Expected at least 8 requirements, got ${reqs.length}`);

  // Print extracted requirements summary
  console.log("\nSample Extracted Requirements:");
  reqs.forEach((r, idx) => {
    console.log(` [${idx + 1}] Category: ${r.category} | Importance: ${r.importance}`);
    console.log(`     Text: "${r.text}"`);
    console.log(`     Terms: ${r.extractedTerms.slice(0, 6).join(", ")}`);
  });

  // Verify categories representation
  const categories = new Set(reqs.map((r) => r.category));
  console.log("\nRepresented Categories:", [...categories].join(", "));
  assert.ok(categories.has("responsibility"), "Should contain responsibility category");
  assert.ok(categories.has("experience"), "Should contain experience category");
  assert.ok(categories.has("skill"), "Should contain skill category");
  assert.ok(categories.has("education"), "Should contain education category");
  assert.ok(categories.has("certification"), "Should contain certification category");
  assert.ok(categories.has("soft_skill"), "Should contain soft_skill category");

  // Verify Required vs Preferred importance
  const requiredReqs = reqs.filter((r) => r.importance === "required");
  const preferredReqs = reqs.filter((r) => r.importance === "preferred");
  console.log(`Required Count: ${requiredReqs.length}, Preferred Count: ${preferredReqs.length}`);

  assert.ok(requiredReqs.length > 0, "Should have required requirements");
  assert.ok(preferredReqs.length > 0, "Should have preferred requirements");
  assert.ok(preferredReqs.some((r) => r.text.includes("Master's degree")), "Master's degree should be preferred");
  assert.ok(preferredReqs.some((r) => r.text.includes("Pinecone")), "Pinecone should be preferred");
  assert.ok(preferredReqs.some((r) => r.text.includes("AWS Certified")), "AWS cert should be preferred");

  // Verify explicit technical terms
  const allTerms = reqs.flatMap((r) => r.extractedTerms);
  const techChecklist = ["python", "rest api", "llm", "rag", "docker", "cloud deployment", "langchain", "pinecone"];
  techChecklist.forEach((tech) => {
    assert.ok(allTerms.some((t) => t.includes(tech) || tech.includes(t)), `Should extract tech term: ${tech}`);
  });
  console.log("✓ PASS: Technical terms accurately recognized.\n");

  // Verify generic soft words do not become individual technical skill requirements
  const techSkills = reqs.filter((r) => r.category === "skill");
  techSkills.forEach((r) => {
    assert.ok(!/^(communication|ownership|curiosity)$/i.test(r.text.trim()), `Generic soft word "${r.text}" must not be standalone technical skill`);
  });
  console.log("✓ PASS: Generic soft words isolated from technical skills.\n");

  // Test 2: Boundary Cases
  console.log("--- Test 2: Boundary cases (empty JD, malformed bullets, deduplication) ---");
  assert.deepEqual(extractor.extract(""), [], "Empty JD must return empty array");
  assert.deepEqual(extractor.extract("   \n  "), [], "Whitespace JD must return empty array");

  const inlineBulletJD = "Requirements: • 5+ years Python • Docker & Kubernetes • REST APIs";
  const inlineReqs = extractor.extract(inlineBulletJD);
  assert.equal(inlineReqs.length, 3, `Expected 3 items from inline bullet JD, got ${inlineReqs.length}`);

  const duplicateJD = "Responsibilities:\n- Design REST APIs.\n- Design REST APIs.";
  const dedupeReqs = extractor.extract(duplicateJD);
  assert.equal(dedupeReqs.length, 1, "Duplicate requirements must be deduplicated");

  // Verify non-duplicate responsibilities sharing keywords remain distinct
  const keywordJD = "Responsibilities:\n- Design REST APIs using Python.\n- Deploy Python services using Docker.";
  const keywordReqs = extractor.extract(keywordJD);
  assert.equal(keywordReqs.length, 2, "Distinct responsibilities sharing keywords must NOT be merged");
  console.log("✓ PASS: Boundary cases & deduplication verified.\n");

  // Test 3: Database & Orchestrator Scoping & Summary Counts
  console.log("--- Test 3: Orchestrator integration, scoping, and summary counts ---");
  await mongoose.connect("mongodb://127.0.0.1:27017/resume_eng");

  const LatexProject = mongoose.models.LatexProject || mongoose.model("LatexProject", new mongoose.Schema({ name: String }, { timestamps: true }));
  const LatexFile = mongoose.models.LatexFile || mongoose.model("LatexFile", new mongoose.Schema({ projectId: mongoose.Schema.Types.ObjectId, name: String, content: String, path: String }, { timestamps: true }));

  const orchestrator = new TailoringOrchestratorService();
  const projectDoc = await LatexProject.create({ name: "Resume Test" });
  const resumeId = projectDoc._id.toString();
  const versionId = "v1";

  await LatexFile.create({
    projectId: projectDoc._id,
    name: "main.tex",
    path: "main.tex",
    content: String.raw`\documentclass{article}
\begin{document}
\section{Experience}
Software Engineer at AI Tech. Built REST APIs using Python and Docker.
\end{document}`,
  });

  // Clean test artifacts for this resumeId and sync indexes
  await ResumeMatch.collection.dropIndexes().catch(() => {});
  await ResumeMatch.syncIndexes().catch(() => {});
  await JobTarget.deleteMany({ resumeId });
  await JobRequirement.deleteMany({ projectId: resumeId });
  await ResumeMatch.deleteMany({ projectId: resumeId });
  await TailoringAnalysis.deleteMany({ resumeId });

  // Analyze AI Agent JD (Target 1)
  const result1 = await orchestrator.analyze({
    resumeId,
    versionId,
    rawJobDescription: aiAgentJD,
    title: "AI Agent Engineer",
    company: "AI Tech Corp",
  });

  console.log("Analysis 1 Completed:", result1.summary);

  // Check JobTarget
  const target1Doc = await JobTarget.findById(result1.jobTargetId).lean();
  assert.ok(target1Doc, "JobTarget must be persisted");
  assert.equal(target1Doc.rawText, aiAgentJD, "JobTarget must store complete original raw JD");

  // Check JobRequirements for Analysis 1
  const req1Docs = await JobRequirement.find({ analysisId: result1.analysisId }).lean();
  assert.equal(req1Docs.length, reqs.length, "Persisted JobRequirement count must match extracted count");

  // Check ResumeMatches for Analysis 1
  const match1Docs = await ResumeMatch.find({ analysisId: result1.analysisId }).lean();
  assert.equal(match1Docs.length, reqs.length, "ResumeMatch count must match requirement count");

  // Check Summary Count accuracy
  assert.equal(result1.summary.total, reqs.length, "Summary total must equal requirement count");

  // Analyze Frontend JD (Target 2) for the same resume project/version
  const result2 = await orchestrator.analyze({
    resumeId,
    versionId,
    rawJobDescription: frontendJD,
    title: "Frontend Engineer",
    company: "Web Inc",
  });

  console.log("Analysis 2 Completed:", result2.summary);

  const req2Docs = await JobRequirement.find({ analysisId: result2.analysisId }).lean();
  assert.ok(req2Docs.length > 0 && req2Docs.length < reqs.length, "Target 2 should have its own requirement set");

  // Assert Strict Scoping
  assert.notEqual(result1.jobTargetId, result2.jobTargetId, "Different JDs must have distinct jobTargetIds");
  assert.notEqual(result1.analysisId, result2.analysisId, "Different analyses must have distinct analysisIds");

  const req1ForTarget2 = await JobRequirement.find({ analysisId: result2.analysisId, jobTargetId: result1.jobTargetId }).lean();
  assert.equal(req1ForTarget2.length, 0, "Requirements for Target 1 must not leak into Target 2 analysis");

  await mongoose.disconnect();
  console.log("✓ PASS: Database persistence, summary counts, and job target scoping verified.\n");

  console.log("==================================================");
  console.log(`ALL M7.6.2 TESTS PASSED SUCCESSFULLY! Extracted Count: ${reqs.length}`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ M7.6.2 TEST FAILED:", err);
  process.exit(1);
});
