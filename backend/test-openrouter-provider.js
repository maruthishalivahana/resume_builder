const assert = require("node:assert/strict");
require("tsx/cjs");
const { OpenRouterLLMProvider } = require("./src/modules/job-tailoring/providers/openrouter-llm.provider.ts");
const { GroundedGenerationService } = require("./src/modules/job-tailoring/services/grounded-generation.service.ts");
const input = {
  requirement: { id: "r1", text: "Node.js", category: "skill", importance: "required", extractedTerms: ["Node.js"], normalizedTerms: ["nodejs"] },
  evidence: [{ id: "e1", text: "Built REST APIs using Node.js.", rawText: "Built REST APIs using Node.js.", section: "experience", type: "bullet", score: 0.9,
    source: { fileId: "f1", fileName: "resume.tex", lineStart: 1, lineEnd: 1 } }],
  match: { classification: "STRONG", evidenceIds: ["e1"], evidenceScores: [], confidence: 0.9, reason: "Direct" },
  constraints: { mayInventFacts: false, mayChangeMeaning: false, mustReferenceEvidence: true },
};
const valid = { type: "highlight", targetEvidenceId: "e1", before: input.evidence[0].text,
  after: String.raw`\textbf{Built REST APIs using Node.js.}`, reason: "Highlights existing work", evidenceIds: ["e1"], confidence: 0.8 };
const provider = () => new OpenRouterLLMProvider({ OPENROUTER_API_KEY: "synthetic-test-key", OPENROUTER_MODEL: "test-model", OPENROUTER_BASE_URL: "https://provider.invalid/v1", OPENROUTER_TIMEOUT_MS: "25" });
const envelope = content => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { "content-type": "application/json" } });
const originalFetch = global.fetch, originalLog = console.log, originalWarn = console.warn;
const diagnostics = [];
let calls = 0;
const record = text => { try { diagnostics.push(JSON.parse(text)); } catch { /* Non-diagnostic output */ } };
async function failed(mock, message, reason) {
  diagnostics.length = 0; calls = 0;
  let requestSignal;
  global.fetch = async (...args) => { calls++; requestSignal = args[1].signal; return mock(...args); };
  await assert.rejects(provider().generate(input), message);
  assert.equal(calls, 1, "No automatic retry is allowed");
  assert.equal(diagnostics.some(item => item.event === "openrouter.request.failed" && item.reason === reason), true, JSON.stringify(diagnostics));
  assert.equal(diagnostics.some(item => item.event === "openrouter.request.completed"), false, "Invalid responses must not be logged as completed");
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(requestSignal.aborted, reason === "timeout", "Failure paths must also clear the timer");
}
(async () => {
  console.log = record; console.warn = record;
  try {
    // Native Response JSON reader with a never-ending body. Simulate the fetch
    // transport rejecting that reader when its request signal is aborted.
    let signal, streamController, bodyReadStarted = false;
    const body = new ReadableStream({ start(controller) {
      streamController = controller;
      controller.enqueue(new TextEncoder().encode('{"choices":'));
    } });
    const stalledResponse = new Response(body, { status: 200 });
    const readJson = stalledResponse.json.bind(stalledResponse);
    stalledResponse.json = () => { bodyReadStarted = true; return readJson(); };
    global.fetch = async (_url, options) => {
      signal = options.signal;
      signal.addEventListener("abort", () => streamController.error(Object.assign(new Error("Body aborted"), { name: "AbortError" })), { once: true });
      return stalledResponse;
    };
    diagnostics.length = 0;
    let watchdog;
    const result = await Promise.race([
      provider().generate(input).then(value => ({ value }), error => ({ error })),
      new Promise(resolve => { watchdog = setTimeout(() => resolve({ stalled: true }), 200); }),
    ]);
    clearTimeout(watchdog);
    if (result.stalled) streamController.error(new Error("Test cleanup"));
    assert.equal(result.stalled, undefined, "The provider deadline must cover a stalled response body");
    assert.match(result.error.message, /timed out/);
    assert.equal(bodyReadStarted, true, "This case must time out during body reading, not while receiving headers");
    assert.equal(signal.aborted, true);
    assert.equal(diagnostics.find(item => item.event === "openrouter.request.failed").reason, "timeout");
    const timeoutEvent = diagnostics.find(item => item.event === "openrouter.request.failed");
    assert.equal(timeoutEvent.stage, "body");
    assert.ok(timeoutEvent.durationMs >= 25);
    assert.ok(timeoutEvent.promptBytes > 0); assert.ok(timeoutEvent.requestBytes >= timeoutEvent.promptBytes);
    assert.equal(timeoutEvent.requestId, diagnostics.find(item => item.event === "openrouter.request.started").requestId);

    await failed((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("Headers aborted"), { name: "AbortError" })), { once: true });
    }), /timed out/, "timeout");
    await failed(async () => new Response("rate limited", { status: 429, headers: { "retry-after": "3" } }), /status 429; retry-after=3/, "http_error");
    assert.equal(diagnostics.find(item => item.reason === "http_error").retryAfter, "3");
    await failed(async () => new Response("unavailable", { status: 503 }), /status 503/, "http_error");
    await failed(async () => { throw new Error("network unavailable"); }, /could not be completed/, "network_error");
    await failed(async () => new Response("not JSON", { status: 200 }), /invalid JSON response envelope/, "invalid_json");
    await failed(async () => ({ ok: true, json: async () => { throw new Error("body connection lost"); } }), /body|could not be completed/i, "body_read_error");
    for (const content of [undefined, null, "", "   "]) await failed(async () => envelope(content), /no structured content/, "no_content");
    await failed(async () => new Response("null", { status: 200 }), /invalid.*envelope/i, "invalid_envelope");
    await failed(async () => new Response("[]", { status: 200 }), /invalid.*envelope/i, "invalid_envelope");
    await failed(async () => envelope({ invalid: true }), /invalid.*content/i, "invalid_structured_output");
    await failed(async () => envelope("not JSON"), /invalid JSON for grounded suggestion/, "invalid_structured_output");
    await failed(async () => envelope('{"type":"rewrite"}'), /invalid schema/, "invalid_structured_output");
    await failed(async () => new Response(JSON.stringify({ model: "synthetic-model", usage: { prompt_tokens: 123, completion_tokens: 45 },
      choices: [{ message: { content: '{"type":"rewrite"}' } }] }), { status: 200 }), /invalid schema/, "invalid_structured_output");
    const schemaFailure = diagnostics.find(item => item.event === "openrouter.request.failed");
    assert.equal(schemaFailure.resolvedModel, "synthetic-model");
    assert.equal(schemaFailure.promptTokens, 123); assert.equal(schemaFailure.completionTokens, 45);

    // A synchronous parse cannot be preempted. Simulate elapsed parsing time to
    // prove an over-deadline parsed result is rejected rather than returned.
    const originalNow = Date.now, originalParse = JSON.parse;
    let now = originalNow();
    const validText = JSON.stringify(valid);
    try {
      Date.now = () => now;
      JSON.parse = function(text, ...args) {
        const value = originalParse.call(this, text, ...args);
        if (text === validText) now += 100;
        return value;
      };
      await failed(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: validText } }] }) }), /timed out/, "timeout");
    } finally { Date.now = originalNow; JSON.parse = originalParse; }

    const spanProposal = { type: "highlight", targetEvidenceId: "e1", highlightText: "Node.js",
      reason: "Highlights existing skill", evidenceIds: ["e1"], confidence: 0.8 };
    for (const content of [JSON.stringify(valid), JSON.stringify(spanProposal), "null"]) {
      let requestSignal;
      global.fetch = async (url, options) => {
        assert.equal(url, "https://provider.invalid/v1/chat/completions");
        assert.equal(JSON.parse(options.body).response_format.type, "json_object");
        requestSignal = options.signal;
        return envelope(content);
      };
      diagnostics.length = 0;
      assert.deepEqual(await provider().generate(input), JSON.parse(content));
      await new Promise(resolve => setTimeout(resolve, 40));
      assert.equal(requestSignal.aborted, false, "Settled requests must clear their timeout");
      assert.equal(diagnostics.filter(item => item.event === "openrouter.request.completed").length, 1);
      const complete = diagnostics.find(item => item.event === "openrouter.request.completed");
      assert.equal(complete.requirementId, "r1"); assert.ok(complete.durationMs >= 0);
      assert.ok(complete.headersDurationMs >= 0); assert.ok(complete.bodyDurationMs >= 0);
      assert.equal(JSON.stringify(diagnostics).includes("synthetic-test-key"), false);
      assert.equal(JSON.stringify(diagnostics).includes("Built REST APIs using Node.js."), false);
    }
    // A user-initiated subsequent call succeeds; failures never invoke fallback.
    let fallbackCalls = 0, attempts = 0;
    global.fetch = async () => { attempts++; return attempts === 1 ? new Response("rate limited", { status: 429 }) : envelope(JSON.stringify(valid)); };
    const generator = new GroundedGenerationService(provider(), { generate: async () => { fallbackCalls++; return valid; } });
    assert.equal(await generator.generate(input), null);
    assert.equal(generator.getLastReasonCode(), "PROVIDER_ERROR");
    assert.equal(attempts, 1);
    const retry = await generator.generate(input);
    assert.deepEqual(retry.suggestion, valid);
    assert.equal(attempts, 2); assert.equal(fallbackCalls, 0);
  } finally { global.fetch = originalFetch; console.log = originalLog; console.warn = originalWarn; }
  console.log("OpenRouter provider regressions passed (mocked transport, native Response/ReadableStream; no live requests)");
})().catch(error => { console.error(error); process.exitCode = 1; });
