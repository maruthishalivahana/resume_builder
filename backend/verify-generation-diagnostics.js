// Synthetic-only, opt-in OpenRouter probe. No MongoDB or application writes.
const fs = require("node:fs"), path = require("node:path"), { randomUUID } = require("node:crypto");
const dotenv = require("dotenv");
require("tsx/cjs");
if (process.env.JD_DIAGNOSTICS_LIVE !== "1") throw new Error("Opt in with JD_DIAGNOSTICS_LIVE=1 for three synthetic live OpenRouter requests.");
const env = dotenv.parse(fs.readFileSync(path.join(__dirname, ".env")));
for (const [name, value] of Object.entries(env)) if (!process.env[name]) process.env[name] = value;
const { OpenRouterLLMProvider } = require("./src/modules/job-tailoring/providers/openrouter-llm.provider.ts");
const { GroundedGenerationService } = require("./src/modules/job-tailoring/services/grounded-generation.service.ts");
const { ClaimValidatorService } = require("./src/modules/job-tailoring/services/claim-validator.service.ts");
const evidence = count => Array.from({ length: count }, (_, index) => {
  const text = `Built REST APIs using Node.js for synthetic inventory project ${index + 1}.`;
  return { id: `synthetic-${index + 1}`, projectId: "synthetic", resumeId: "synthetic", versionId: "audit-v1",
    text, rawText: `\\item ${text}`, section: "experience", type: "bullet", score: 0.9,
    technologies: ["Node.js", "REST API"], normalizedTechnologies: ["nodejs", "rest_api"],
    source: { fileId: "synthetic-file", fileName: "synthetic-resume.tex", lineStart: index + 1, lineEnd: index + 1 } };
});
const report = { requestedModel: process.env.OPENROUTER_MODEL, databaseUsed: false, syntheticOnly: true, cases: [], calibration: [] };
const reportPath = path.join(__dirname, `jd-generation-diagnostics-${randomUUID()}.json`);
const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
const log = console.log, warn = console.warn;
let currentEvents;
function collect(method, text) { try { const event = JSON.parse(text); if (currentEvents && event.scope === "job-tailoring") currentEvents.push(event); } catch { /* Non-JSON message */ } method(text); }
async function run(provider, count, target) {
  const rejected = [], items = evidence(count);
  const input = { requirement: { id: `probe-${count}`, text: "Experience building Node.js REST APIs", category: "skill", importance: "required", extractedTerms: ["node.js", "rest api"], normalizedTerms: ["nodejs", "rest_api"] },
    match: { classification: "STRONG", confidence: 0.9, evidenceIds: items.map(item => item.id), evidenceScores: [], reason: "Synthetic explicit evidence" }, evidence: items };
  currentEvents = [];
  const started = Date.now();
  const generator = new GroundedGenerationService(provider, undefined, new ClaimValidatorService(), entry => rejected.push(entry));
  const result = await generator.generate(input);
  target.push({ evidenceCount: count, elapsedMs: Date.now() - started, outcome: result ? "validated_suggestion" : generator.getLastReasonCode(),
    acceptedSuggestion: result?.suggestion, rejections: rejected, diagnostics: currentEvents });
  currentEvents = undefined; save();
}
(async () => {
  console.log = text => collect(log, text); console.warn = text => collect(warn, text);
  try {
    // Known unsupported output and a meaning-preserving synonym establish what
    // the deterministic validator rejects; these are not live-model responses.
    for (const after of [String.raw`\item Built REST APIs using Node.js and TensorFlow in production.`,
      String.raw`\item Developed REST APIs using Node.js for synthetic inventory project 1.`]) {
      await run({ generate: async ({ evidence }) => ({ type: "rewrite", targetEvidenceId: evidence[0].id,
        before: evidence[0].rawText, after, evidenceIds: [evidence[0].id], reason: "Calibration", confidence: 0.8 }) }, 1, report.calibration);
    }
    for (const count of [1, 3, 12]) await run(new OpenRouterLLMProvider(), count, report.cases);
  } finally { console.log = log; console.warn = warn; save(); }
  console.log(JSON.stringify({ reportPath, results: report.cases.map(item => ({ evidenceCount: item.evidenceCount, elapsedMs: item.elapsedMs, outcome: item.outcome })) }));
})().catch(error => { console.log = log; console.warn = warn; console.error(error.name, "Synthetic diagnostic probe interrupted; partial report retained", reportPath); process.exitCode = 1; });
