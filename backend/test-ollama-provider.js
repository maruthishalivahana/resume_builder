/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression test. */
const assert = require("node:assert/strict");
require("tsx/cjs");
const { OllamaHighlightProvider } = require("./src/modules/job-tailoring/providers/ollama-highlight.provider.ts");
const { GroundedGenerationService } = require("./src/modules/job-tailoring/services/grounded-generation.service.ts");
const { createEvidenceSourcePatch } = require("./src/modules/job-tailoring/utils/source-range.util.ts");
const env = { NODE_ENV: "test", OLLAMA_TIMEOUT_MS: "1000" };
const evidence = [{ id: "e1", text: "Used Docker for a coursework project.", rawText: String.raw`\item Used Docker for a coursework project.`,
  source: { fileId: "f1", fileName: "resume.tex", lineStart: 1, lineEnd: 1 }, score: 0.9 }];
const input = { requirement: { id: "r1", text: "Experience with Docker" }, evidence,
  match: { classification: "STRONG", evidenceIds: ["e1"], evidenceScores: [], confidence: 0.9, reason: "Direct" },
  constraints: { mayInventFacts: false, mayChangeMeaning: false, mustReferenceEvidence: true } };
const valid = { type: "highlight", targetEvidenceId: "e1", highlightText: "Docker", reason: "Highlights supplied skill", evidenceIds: ["e1"], confidence: 0.8 };
const selection = { candidateId: "c1" };
const reply = proposal => new Response(JSON.stringify({ model: "qwen3:1.7b", done: true, done_reason: "stop", message: { content: JSON.stringify({ selection: proposal }) } }), { status: 200 });
const originalFetch = global.fetch;
(async () => {
  for (const url of ["https://cloud.example", "http://localhost:11435", "http://127.0.0.1:11435/api", "http://user:secret@127.0.0.1", "http://127.0.0.1?x=1"]) {
    assert.throws(() => new OllamaHighlightProvider({ ...env, OLLAMA_BASE_URL: url }), /loopback/);
  }
  assert.throws(() => new OllamaHighlightProvider({ NODE_ENV: "production" }), /development/);
  assert.throws(() => new OllamaHighlightProvider({}), /development/);
  assert.throws(() => new OllamaHighlightProvider({ ...env, OLLAMA_MODEL: "qwen3:cloud" }), /downloaded model/);
  assert.throws(() => new OllamaHighlightProvider({ ...env, OLLAMA_TIMEOUT_MS: "120001" }), /integer/);
  const requests = [];
  global.fetch = async (url, options) => {
    assert.equal(url, "http://127.0.0.1:11435/api/chat"); assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body); requests.push(body);
    assert.equal(body.model, "qwen3:1.7b"); assert.equal(body.think, false);
    assert.equal(body.options.num_gpu, 0); assert.equal(body.options.num_ctx, 4096);
    assert.equal(body.format.properties.selection.anyOf.length, 2);
    return reply(selection);
  };
  const provider = new OllamaHighlightProvider(env);
  assert.deepEqual(await provider.generate(input), { ...valid, reason: "Highlight existing resume text relevant to this requirement.", confidence: 0.5 });
  const generator = new GroundedGenerationService(provider);
  const generated = await generator.generate(input);
  assert.equal(generated.suggestion.after, String.raw`\item Used \textbf{Docker} for a coursework project.`);
  assert.equal(createEvidenceSourcePatch(evidence[0].rawText, evidence[0], generated.suggestion).after, generated.suggestion.after);
  let calls = 0;
  global.fetch = async () => { calls++; return reply(null); };
  assert.equal(await provider.generate(input), null); assert.equal(calls, 1);
  await assert.rejects(provider.generate({ ...input, evidence: [{ ...evidence[0], rawText: "x".repeat(4000) }] }), /context limit/);
  assert.equal(calls, 1, "Oversized evidence must not be silently truncated or sent");
  for (const bad of [{ ...selection, type: "rewrite", before: "Docker", after: "TensorFlow" }, { ...selection, after: "added text" },
    { candidateId: "unknown" }, { candidateId: 1 }, {},
    { ...selection, highlightText: "Docker Docker" }, { ...selection, highlightText: "one two three four five six seven eight nine" },
    { ...selection, confidence: 2 }, { ...selection, evidenceId: "unknown" }, { ...selection, evidenceIds: ["e1", "unknown"] }]) {
    global.fetch = async () => reply(bad);
    await assert.rejects(provider.generate(input), /only exact|overbroad|repetitive/);
  }
  for (const rawText of [String.raw`\label{Docker}`, String.raw`\textbf{Docker}`, "Docker Docker"]) {
    global.fetch = async () => { assert.fail("Unsafe candidates must not reach inference"); };
    assert.equal(await generator.generate({ ...input, evidence: [{ ...evidence[0], rawText, text: rawText }] }), null);
  }
  global.fetch = async () => reply({ ...selection, evidenceId: "unknown" });
  assert.equal(await generator.generate(input), null); assert.equal(generator.getLastReasonCode(), "PROVIDER_ERROR");
  const stableId = "persisted-evidence-731";
  global.fetch = async () => reply(selection);
  const mapped = await provider.generate({ ...input, match: { ...input.match, evidenceIds: ["other-id", stableId] }, evidence: [{ ...evidence[0], id: "other-id", rawText: "Python" }, { ...evidence[0], id: stableId }] });
  assert.equal(mapped.targetEvidenceId, stableId); assert.deepEqual(mapped.evidenceIds, [stableId]);
  global.fetch = async () => reply({ candidateId: "c2" });
  const second = await provider.generate({ ...input, match: { ...input.match, evidenceIds: ["e1", stableId] },
    evidence: [evidence[0], { ...evidence[0], id: stableId, rawText: "Built Docker tools." }] });
  assert.equal(second.targetEvidenceId, stableId); assert.equal(second.highlightText, "Docker");
  assert.deepEqual(second.evidenceIds, [stableId]);
  await assert.rejects(provider.generate({ ...input, evidence: [evidence[0], evidence[0]] }), /must be unique/);
  let fallbackCalls = 0; calls = 0;
  const guarded = new GroundedGenerationService(provider, { generate: async () => { fallbackCalls++; return valid; } });
  for (const status of [404, 503]) {
    global.fetch = async () => { calls++; return new Response("unavailable", { status }); };
    assert.equal(await guarded.generate(input), null); assert.equal(guarded.getLastReasonCode(), "PROVIDER_ERROR");
  }
  assert.equal(calls, 2); assert.equal(fallbackCalls, 0);
  global.fetch = async () => { throw new TypeError("connection refused"); };
  await assert.rejects(provider.generate(input), /unavailable.*No cloud fallback/);
  global.fetch = async () => new Response("PRIVATE_SOURCE_MARKER invalid JSON");
  await assert.rejects(provider.generate(input), error => /invalid JSON/.test(error.message) && !error.message.includes("PRIVATE_SOURCE_MARKER"));
  global.fetch = async (_url, options) => ({ ok: true, json: () => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })) });
  await assert.rejects(new OllamaHighlightProvider({ ...env, OLLAMA_TIMEOUT_MS: "100" }).generate(input), /timed out/);
  global.fetch = async () => new Response(JSON.stringify({ model: "qwen3:1.7b", done: true, done_reason: "length", message: { content: "{}" } }));
  await assert.rejects(provider.generate(input), /incomplete/);
  // Provider resolution is scoped to JD mode and does not require a cloud key.
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = "test"; process.env.TAILORING_LLM_PROVIDER = "ollama"; process.env.LLM_PROVIDER = "openrouter";
    const { resolveTailoringProviderConfig } = require("./src/modules/job-tailoring/config/tailoring-provider.config.ts");
    const config = resolveTailoringProviderConfig();
    assert.equal(config.normalizedProvider, "ollama"); assert.equal(config.fallbackProvider, undefined);
    assert.equal(process.env.LLM_PROVIDER, "openrouter", "JD override must not mutate conversational configuration");
    process.env.NODE_ENV = "production"; assert.throws(resolveTailoringProviderConfig, /development/);
  } finally { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
  console.log("Local provider regressions passed: loopback/dev gates, highlight-only schema, deadline through body, unavailable/no fallback, exact patches, evidence checks and JD-only config");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
