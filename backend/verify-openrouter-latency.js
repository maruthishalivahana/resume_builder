// Opt-in, synthetic-only benchmark. No MongoDB, application writes or config edits.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
require("tsx/cjs");
if (process.env.JD_LATENCY_LIVE !== "1") throw new Error("Opt in with JD_LATENCY_LIVE=1 for up to twelve synthetic free-model requests.");
const env = { ...require("dotenv").parse(fs.readFileSync(path.join(__dirname, ".env"))), ...process.env };
const { OpenRouterLLMProvider } = require("./src/modules/job-tailoring/providers/openrouter-llm.provider.ts");
const { GroundedGenerationService } = require("./src/modules/job-tailoring/services/grounded-generation.service.ts");
const models = ["openrouter/free", "nvidia/nemotron-3-super-120b-a12b:free", "liquid/lfm-2.5-2.6b:free"];
const reportPath = path.join(__dirname, `jd-latency-${randomUUID()}.json`);
const report = { startedAt: new Date().toISOString(), syntheticOnly: true, databaseUsed: false,
  productionConfigChanged: false, automaticRetries: false, cases: [], catalog: [],
  limitations: ["Exploratory sample, one request per model/evidence-count cell; not a percentile or reliability estimate.",
    "Headers include connection, network, server queueing and processing; body includes remaining inference and transfer.",
    "Extended-deadline trials are separate fresh requests, not continuations of timed-out requests."] };
const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
const originalLog = console.log, originalWarn = console.warn;
let events;
function collect(method, text) {
  try { const event = JSON.parse(text); if (events && event.scope === "job-tailoring") events.push(event); } catch { /* Ordinary output */ }
  method(text);
}
const input = count => {
  const evidence = Array.from({ length: count }, (_, index) => {
    const text = `Built REST APIs using Node.js for synthetic inventory project ${index + 1}.`;
    return { id: `synthetic-${index + 1}`, projectId: "synthetic", versionId: "latency-audit",
      text, rawText: `\\item ${text}`, section: "experience", type: "bullet", score: 0.9,
      technologies: ["Node.js", "REST API"], normalizedTechnologies: ["nodejs", "rest_api"],
      source: { fileId: "synthetic-file", fileName: "synthetic.tex", lineStart: index + 1, lineEnd: index + 1 } };
  });
  return { requirement: { id: `latency-${count}`, text: "Experience building Node.js REST APIs", category: "skill", importance: "required",
    extractedTerms: ["node.js", "rest api"], normalizedTerms: ["nodejs", "rest_api"] },
  match: { classification: "STRONG", confidence: 0.9, evidenceIds: evidence.map(e => e.id), evidenceScores: [], reason: "Explicit synthetic evidence" }, evidence };
};
async function trial(model, count, timeoutMs, phase) {
  events = [];
  const provider = new OpenRouterLLMProvider({ ...env, OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
    OPENROUTER_MODEL: model, OPENROUTER_TIMEOUT_MS: String(timeoutMs) });
  const originalGenerate = provider.generate.bind(provider);
  let proposal, providerReturned = false;
  provider.generate = async params => { proposal = await originalGenerate(params); providerReturned = true; return proposal; };
  const generator = new GroundedGenerationService(provider);
  const started = Date.now();
  const result = await generator.generate(input(count));
  const elapsedMs = Date.now() - started;
  const terminal = events.findLast(event => ["openrouter.request.completed", "openrouter.request.failed"].includes(event.event));
  const record = { phase, requestedModel: model, evidenceCount: count, timeoutMs, elapsedMs,
    outcome: result ? "validated_suggestion" : generator.getLastReasonCode(),
    providerReturned, proposal, suggestion: result?.suggestion, terminal, diagnostics: events };
  report.cases.push(record); events = undefined; save();
  originalLog(JSON.stringify({ trial: report.cases.length, model, count, timeoutMs, elapsedMs, outcome: record.outcome,
    stage: terminal?.stage, failure: terminal?.reason, resolvedModel: terminal?.resolvedModel }));
}
(async () => {
  // Public catalog lookup uses no key; fail closed if any candidate stops being free.
  const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
  assert.equal(response.ok, true, "Model catalog unavailable");
  const catalog = (await response.json()).data;
  for (const model of models) {
    const entry = catalog.find(entry => entry.id === model);
    assert.ok(entry && Number(entry.pricing?.prompt) === 0 && Number(entry.pricing?.completion) === 0, `Model is unavailable or not free: ${model}`);
    assert.ok(entry.supported_parameters.includes("response_format"));
    report.catalog.push({ id: entry.id, pricing: entry.pricing, supported_parameters: entry.supported_parameters });
  }
  save();
  console.log = text => collect(originalLog, text); console.warn = text => collect(originalWarn, text);
  try {
    // Rotate model order to avoid always testing one model first; no concurrency.
    for (const [index, count] of [1, 3, 12].entries()) {
      for (let offset = 0; offset < models.length; offset++) await trial(models[(index + offset) % models.length], count, 30000, "baseline");
    }
    // At most one explicitly planned 60-second trial per model that timed out.
    // This is diagnostic only and never an application retry/fallback policy.
    for (const model of models) {
      const timeout = report.cases.find(record => record.phase === "baseline" && record.requestedModel === model && record.terminal?.reason === "timeout");
      if (timeout) await trial(model, timeout.evidenceCount, 60000, "extended-deadline");
    }
  } finally {
    console.log = originalLog; console.warn = originalWarn;
    report.finishedAt = new Date().toISOString(); save();
  }
  originalLog(JSON.stringify({ reportPath, requests: report.cases.length }));
})().catch(error => {
  console.log = originalLog; console.warn = originalWarn;
  report.interrupted = { name: error.name, message: error.message }; save();
  console.error("Synthetic latency audit interrupted; partial report retained", reportPath, error.name);
  process.exitCode = 1;
});
