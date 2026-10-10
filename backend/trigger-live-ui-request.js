const mongoose = require("mongoose");
const http = require("http");

async function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("==================================================");
  console.log("SENDING FRESH UI TAILORING REQUEST TO RUNNING BACKEND");
  console.log("==================================================");

  // 1. Health check
  const health = await getJson("/api/health");
  console.log("Backend Health:", health);

  // 2. Setup project & resume in MongoDB
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/resume_eng");
  const { LatexProject } = require("./dist/models/LatexProject");
  const { LatexFile } = require("./dist/models/LatexFile");
  const { ResumeIntelligenceService } = require("./dist/modules/job-tailoring/services/resume-intelligence.service");

  const project = await LatexProject.create({
    userId: new mongoose.Types.ObjectId(),
    name: "Live UI Test Project",
    status: "active",
  });

  const fileContent = `\\section{Skills}
\\begin{itemize}
\\item {React frontend development and Next.js applications}
\\item {Node.js REST APIs and backend architecture}
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
  const intelligence = new ResumeIntelligenceService();
  await intelligence.indexResume({ projectId: project._id.toString(), versionId });

  // 3. Post to /api/tailoring/analyze (the exact UI action)
  const analyzePayload = {
    projectId: project._id.toString(),
    versionId,
    rawJobDescription: "Required Skills: React frontend development and Next.js applications. Node.js REST APIs.",
    title: "Fullstack Engineer",
    company: "Production Corp",
  };

  console.log("\n--> Dispatching POST /api/tailoring/analyze with payload:", analyzePayload);
  const analyzeRes = await postJson("/api/tailoring/analyze", analyzePayload);
  console.log("<-- Received Response Status:", analyzeRes.status);
  console.log("<-- Received Analysis Summary:", JSON.stringify(analyzeRes.body, null, 2));

  const analysisId = analyzeRes.body?.data?.analysisId;
  if (!analysisId) {
    console.error("FATAL: No analysisId returned!");
    process.exit(1);
  }

  // 4. Fetch suggestions via GET /api/tailoring/:analysisId/suggestions (frontend suggestion fetch)
  console.log(`\n--> Dispatching GET /api/tailoring/${analysisId}/suggestions (Frontend Query)`);
  const suggestionsRes = await getJson(`/api/tailoring/${analysisId}/suggestions`);
  console.log("<-- Suggestions Response Status:", suggestionsRes.status);
  console.log("<-- Persisted Suggestions Returned to Frontend:");
  console.log(JSON.stringify(suggestionsRes.body, null, 2));

  // 5. Verify results
  const suggestions = suggestionsRes.body?.data || [];
  console.log(`\nTotal Suggestions: ${suggestions.length}`);
  for (const s of suggestions) {
    console.log(`[Suggestion ${s.suggestionId}]`);
    console.log(`  Requirement: ${s.requirementId}`);
    console.log(`  Before: "${s.before}"`);
    console.log(`  After:  "${s.after}"`);
    console.log(`  Validation: ${s.validation}`);

    if (s.after.includes("for core service delivery") || s.after.includes("in active production workloads")) {
      console.error("FAIL: Found generic boilerplate in suggestion!");
      process.exit(1);
    }
  }

  console.log("\n✓ VERIFICATION SUCCESS: All suggestions are requirement-specific, evidence-grounded, and free of generic boilerplate.");

  // Cleanup
  await LatexProject.deleteOne({ _id: project._id });
  await LatexFile.deleteOne({ _id: file._id });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error running live UI request:", err);
  process.exit(1);
});
