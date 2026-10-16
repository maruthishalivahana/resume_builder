// Opt-in audit server. Every database write is confined to a NEW random database.
// The controlled provider mode is test-only; live mode uses the configured OpenRouter.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
require("tsx/cjs");
if (process.env.JD_LIVE_AUDIT !== "1") throw new Error("Set JD_LIVE_AUDIT=1 to create an isolated audit database.");
const env = dotenv.parse(fs.readFileSync(path.join(__dirname, ".env")));
for (const [key, value] of Object.entries(env)) if (!process.env[key]) process.env[key] = value;
const dbName = `resume_eng_jd_audit_${randomUUID().replaceAll("-", "")}`;
process.env.CLIENT_URL = "http://localhost:3057";
const { OpenRouterLLMProvider } = require("./src/modules/job-tailoring/providers/openrouter-llm.provider.ts");
const originalGenerate = OpenRouterLLMProvider.prototype.generate;
let mode = "controlled", delay = 0, providerCalls = 0;
OpenRouterLLMProvider.prototype.generate = async function(input) {
  providerCalls++;
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  if (mode === "live") return originalGenerate.call(this, input);
  const target = input.evidence[0];
  return { type: "highlight", targetEvidenceId: target.id, before: target.rawText,
    after: target.rawText.replace("Node.js", String.raw`\textbf{Node.js}`),
    reason: "Highlights existing Node.js evidence without adding facts", evidenceIds: [target.id], confidence: 0.9 };
};
const { app } = require("./src/app.ts");
const { LatexProject } = require("./src/models/LatexProject.ts");
const { LatexFile } = require("./src/models/LatexFile.ts");
const Analysis = require("./src/modules/job-tailoring/models/TailoringAnalysis.ts").default;
const Suggestions = require("./src/modules/job-tailoring/models/TailoringSuggestion.ts").default;
const Evidence = require("./src/modules/job-tailoring/models/ResumeEvidence.ts").default;
const fixtures = [];
async function fixture(label, newline = "\r\n") {
  const project = await LatexProject.create({ name: `JD AUDIT ${label}` });
  const content = [String.raw`\documentclass{article}`, String.raw`\begin{document}`, String.raw`\section{Experience}`,
    String.raw`\begin{itemize}`, `\\item Built Node.js REST APIs for JD_AUDIT_${label}_731.`,
    String.raw`\end{itemize}`, String.raw`\end{document}`].join(newline);
  const file = await LatexFile.create({ projectId: project._id, name: "resume.tex", path: "resume.tex", content, contentRevision: 0 });
  await LatexProject.updateOne({ _id: project._id }, { $set: { entryFileId: file._id } });
  const result = { projectId: project._id.toString(), fileId: file._id.toString(), content };
  fixtures.push(result); return result;
}
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName, autoCreate: false, autoIndex: false, monitorCommands: true, serverSelectionTimeoutMS: 5000 });
  assert.equal(mongoose.connection.db.databaseName, dbName);
  mongoose.connection.getClient().on("commandStarted", event => {
    if (["insert", "update", "delete", "findAndModify"].includes(event.commandName)) assert.equal(event.databaseName, dbName);
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const a = await fixture("ALPHA"), b = await fixture("BRAVO", "\n");
  app.get("/audit", (_req, res) => res.json({ database: dbName, topology: hello.setName ? "replica-set" : "standalone", mode, providerCalls, fixtures }));
  app.post("/audit/mode/:mode", (req, res) => {
    if (!["live", "controlled"].includes(req.params.mode)) return res.status(400).json({ error: "Invalid audit mode" });
    mode = req.params.mode; delay = Number(req.query.delay) || 0;
    res.json({ mode, delay });
  });
  app.get("/audit/state", async (_req, res) => {
    const files = await LatexFile.find({ projectId: { $in: fixtures.map(f => f.projectId) } }).lean();
    const analyses = await Analysis.find({ resumeId: { $in: fixtures.map(f => f.projectId) } }).lean();
    const suggestions = await Suggestions.find({ projectId: { $in: fixtures.map(f => f.projectId) } }).lean();
    const evidence = await Evidence.find({ projectId: { $in: fixtures.map(f => f.projectId) } }).lean();
    res.json({ database: dbName, mode, providerCalls, files, analyses, suggestions, evidence });
  });
  const server = app.listen(5057, "127.0.0.1", () => console.log(JSON.stringify({ auditReady: true, database: dbName, topology: hello.setName ? "replica-set" : "standalone", api: "http://localhost:5057", a: a.projectId, b: b.projectId })));
  const stop = async () => { await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  setTimeout(stop, 20 * 60 * 1000).unref();
}
main().catch(error => { console.error(error.name, error.code || "", "Isolated JD audit could not start"); process.exitCode = 1; mongoose.disconnect(); });
