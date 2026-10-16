// Isolated local CPU trial. No API credentials, MongoDB, cloud or app config.
const fs = require("node:fs"), path = require("node:path"), { randomUUID } = require("node:crypto");
require("tsx/cjs");
if (process.env.JD_LOCAL_TRIAL !== "1") throw new Error("Set JD_LOCAL_TRIAL=1 after starting the isolated local runtime.");
const { buildGroundedSuggestionPrompt } = require("./src/modules/job-tailoring/prompts/grounded-suggestion.prompt.ts");
const { parseGroundedSuggestion } = require("./src/modules/job-tailoring/providers/openrouter-llm.provider.ts");
const { GroundedGenerationService } = require("./src/modules/job-tailoring/services/grounded-generation.service.ts");
const { createEvidenceSourcePatch } = require("./src/modules/job-tailoring/utils/source-range.util.ts");
const base = "http://127.0.0.1:11435", model = "qwen3:1.7b";
const highlightsOnly = process.env.JD_LOCAL_HIGHLIGHTS_ONLY === "1";
const common = { targetEvidenceId: { type: "string" }, reason: { type: "string" },
  evidenceIds: { type: "array", items: { type: "string" } }, confidence: { type: "number", minimum: 0, maximum: 1 } };
const schema = { type: "object", additionalProperties: false, required: ["suggestion"], properties: { suggestion: { anyOf: [
  { type: "null" },
  { type: "object", additionalProperties: false, required: ["type", "targetEvidenceId", "highlightText", "reason", "evidenceIds", "confidence"],
    properties: { ...common, type: { const: "highlight" }, highlightText: { type: "string" } } },
  { type: "object", additionalProperties: false, required: ["type", "targetEvidenceId", "before", "after", "reason", "evidenceIds", "confidence"],
    properties: { ...common, type: { enum: ["rewrite", "reorder", "keyword"] }, before: { type: "string" }, after: { type: "string" } } },
] } } };
if (highlightsOnly) schema.properties.suggestion.anyOf = schema.properties.suggestion.anyOf.slice(0, 2);
const item = (id, text) => ({ id, text, rawText: `\\item ${text}`, section: "experience", type: "bullet", score: 0.9,
  source: { fileId: "synthetic", fileName: "synthetic.tex", lineStart: 1, lineEnd: 1 } });
const node = item("e1", "Built REST APIs using Node.js for a synthetic inventory project.");
const cases = [
  { name: "supported-node-cold", jd: "Experience building Node.js REST APIs", evidence: [node], expected: "suggestion" },
  { name: "supported-node-warm", jd: "Experience building Node.js REST APIs", evidence: [node], expected: "suggestion" },
  { name: "supported-docker-multiple-evidence", jd: "Experience with Docker", evidence: [node,
    item("e2", "Used Docker for a synthetic coursework project."), item("e3", "Built a React interface for a synthetic demo.")], expected: "suggestion" },
  { name: "unsupported-tensorflow", jd: "Professional TensorFlow machine learning experience", evidence: [node], expected: "abstain" },
  { name: "unsupported-production-metric", jd: "Production application experience reducing latency by 50%", evidence: [node], expected: "abstain" },
];
if (highlightsOnly) cases.push(
  { name: "repeated-span", jd: "Experience with Docker", evidence: [item("e1", "Docker Docker")], expected: "abstain" },
  { name: "already-bold", jd: "Experience with Docker", evidence: [item("e1", String.raw`Used \textbf{Docker} for a synthetic coursework project.`)], expected: "abstain" },
  { name: "label-only", jd: "Experience with Docker", evidence: [item("e1", String.raw`\label{Docker}`)], expected: "abstain" },
);
const reportPath = path.join(__dirname, `jd-local-${randomUUID()}.json`);
const report = { model, base, syntheticOnly: true, databaseUsed: false, cloudRequests: false,
  mode: highlightsOnly ? "highlight-only" : "all-edits", outputTokenCap: highlightsOnly ? 256 : 512,
  appConfigChanged: false, timeoutMs: 120000, contextLength: 4096, think: false, numGpu: 0, cases: [],
  limitations: ["Generation-only trial with forced STRONG classification, including unsupported cases to test abstention; not an end-to-end retrieval test.",
    "Local structured envelope constrains JSON syntax; evidence/claim/source correctness still uses existing validators.",
    "120-second experimental deadline does not change the application's 30-second deadline."] };
const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
async function local(pathname, body) {
  const response = await fetch(base + pathname, { method: body ? "POST" : "GET", signal: AbortSignal.timeout(120000),
    headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Local runtime HTTP ${response.status}`);
  return response.json();
}
(async () => {
  report.runtime = await local("/api/version");
  report.installedModels = await local("/api/tags"); save();
  try {
    for (const test of cases) {
      const record = { name: test.name, expected: test.expected, jd: test.jd };
      const provider = { generate: async input => {
        const payload = await local("/api/chat", { model, stream: false, think: false, format: schema,
          keep_alive: "2m", options: { temperature: 0, num_ctx: 4096, num_predict: highlightsOnly ? 256 : 512, num_gpu: 0 },
          messages: [{ role: "system", content: (highlightsOnly ? [
            "Select one useful exact existing text span to bold, or abstain. Never rewrite text or author a claim.",
            "Return {\"suggestion\":null} unless the evidence explicitly supports the JOB REQUIREMENT as written. Related technologies are not interchangeable.",
            "A Node.js REST API does not establish TensorFlow, production deployment, professional experience or a 50% improvement.",
            "Do not use the job description as resume evidence. Never add words, Markdown, commands, numbers or qualifications to highlightText.",
            "highlightText must occur exactly once in the chosen rawText and contain only ordinary visible text outside all LaTeX commands, braces, comments, options and math.",
            "Do not select text already bold or inside a label, or repeated text. If you cannot select a safe unique span, return {\"suggestion\":null}.",
            "For a safe selection, return {\"suggestion\":{\"type\":\"highlight\",\"targetEvidenceId\":\"existing ID\",\"highlightText\":\"exact existing span\",\"reason\":\"brief reason\",\"evidenceIds\":[\"existing ID\"],\"confidence\":0.8}}.",
            `JOB REQUIREMENT: ${JSON.stringify(input.requirement.text)}`,
            `EVIDENCE: ${JSON.stringify(input.evidence.map(e => ({ id: e.id, rawText: e.rawText })))}`,
          ].join("\n") : buildGroundedSuggestionPrompt(input.requirement, input.evidence, input.match)) +
            '\nFor the local structured API, wrap your result as {"suggestion": <suggestion or null>}. Do not add any other fields.' },
          { role: "user", content: "Generate one safe grounded suggestion or null." }] });
        record.runtimeMetrics = { totalMs: payload.total_duration / 1e6, loadMs: payload.load_duration / 1e6,
          promptEvalMs: payload.prompt_eval_duration / 1e6, generationMs: payload.eval_duration / 1e6,
          promptTokens: payload.prompt_eval_count, outputTokens: payload.eval_count, doneReason: payload.done_reason };
        if (!payload.done || payload.done_reason === "length") throw new Error("Incomplete local structured output");
        record.rawOutput = payload.message?.content;
        const envelope = JSON.parse(record.rawOutput);
        if (!Object.hasOwn(envelope, "suggestion")) throw new Error("Missing structured suggestion");
        record.proposal = parseGroundedSuggestion(JSON.stringify(envelope.suggestion));
        if (highlightsOnly && record.proposal !== null && record.proposal.type !== "highlight") throw new Error("Local highlight trial forbids semantic edits");
        return record.proposal;
      } };
      const service = new GroundedGenerationService(provider);
      const started = Date.now();
      const result = await service.generate({ requirement: { id: test.name, text: test.jd, category: "skill", importance: "required" },
        evidence: test.evidence, match: { classification: "STRONG", evidenceIds: test.evidence.map(e => e.id), confidence: 0.9, evidenceScores: [], reason: "Forced eligibility for synthetic generation-only test" } });
      record.elapsedMs = Date.now() - started;
      record.outcome = result ? "validated_suggestion" : service.getLastReasonCode();
      record.suggestion = result?.suggestion;
      if (result) {
        const target = test.evidence.find(e => e.id === result.suggestion.targetEvidenceId);
        record.sourcePatch = createEvidenceSourcePatch(target.rawText, target, result.suggestion);
      }
      record.meetsExpected = test.expected === "suggestion" ? Boolean(result) : record.proposal === null;
      if (test.expected === "abstain") record.unsafeOrIrrelevantSuggestionAccepted = Boolean(result);
      record.fitsExisting30SecondDeadline = record.elapsedMs < 30000;
      report.cases.push(record); report.loadedModel = await local("/api/ps"); save();
      console.log(JSON.stringify({ name: record.name, outcome: record.outcome, elapsedMs: record.elapsedMs, meetsExpected: record.meetsExpected }));
    }
  } finally { await local("/api/generate", { model, keep_alive: 0 }); save(); }
  console.log(JSON.stringify({ reportPath }));
})().catch(error => { report.interrupted = { name: error.name, message: error.message }; save(); console.error(error.name, error.message, reportPath); process.exitCode = 1; });
