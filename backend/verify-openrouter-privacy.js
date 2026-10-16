// Synthetic-only route eligibility probe; no application/config/database changes.
const fs = require("node:fs"), path = require("node:path"), { randomUUID } = require("node:crypto");
if (process.env.JD_PRIVACY_LIVE !== "1") throw new Error("Set JD_PRIVACY_LIVE=1 for two free-model synthetic privacy probes.");
const env = { ...require("dotenv").parse(fs.readFileSync(path.join(__dirname, ".env"))), ...process.env };
const reportPath = path.join(__dirname, `jd-privacy-${randomUUID()}.json`);
const report = { date: new Date().toISOString(), syntheticOnly: true, productionConfigChanged: false, databaseUsed: false,
  providerPolicy: { data_collection: "deny", zdr: true, allow_fallbacks: false, max_price: { prompt: 0, completion: 0 } }, cases: [] };
const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
(async () => {
  if (!env.OPENROUTER_API_KEY) throw new Error("Configured OpenRouter key unavailable");
  const models = process.env.JD_PRIVACY_GEMMA === "1"
    ? ["google/gemma-4-26b-a4b-it:free", "google/gemma-4-31b-it:free"]
    : ["nvidia/nemotron-3-super-120b-a12b:free", "liquid/lfm-2.5-2.6b:free"];
  const catalogResponse = await fetch("https://openrouter.ai/api/v1/models?zdr=true", { signal: AbortSignal.timeout(15000) });
  if (!catalogResponse.ok) throw new Error("Free-model catalog unavailable");
  const catalog = (await catalogResponse.json()).data;
  report.catalog = models.map(model => {
    const candidate = catalog.find(entry => entry.id === model);
    // An entry absent from the ZDR catalog is not sent to inference.
    return { model, eligibleForProbe: Boolean(candidate && model.endsWith(":free") &&
      candidate.pricing?.prompt === "0" && candidate.pricing?.completion === "0" &&
      Number(candidate.pricing?.request ?? 0) === 0) };
  });
  save();
  for (const model of models) {
    if (!report.catalog.find(candidate => candidate.model === model).eligibleForProbe) {
      report.cases.push({ model, skipped: "Not listed as zero-price in ZDR catalog" }); save(); continue;
    }
    const started = Date.now();
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, provider: report.providerPolicy, max_tokens: 32,
          messages: [{ role: "user", content: "Synthetic route eligibility test. Reply with OK." }] }),
      });
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      report.cases.push({ model, httpStatus: response.status, elapsedMs: Date.now() - started,
        resolvedModel: payload.model, provider: payload.provider,
        error: payload.error ? { code: payload.error.code, message: payload.error.message } : undefined,
        hasContent: typeof content === "string" && content.trim().length > 0,
        finishReason: payload.choices?.[0]?.finish_reason });
    } catch (error) {
      report.cases.push({ model, elapsedMs: Date.now() - started, transportError: error.name });
    }
    save(); console.log(JSON.stringify(report.cases.at(-1)));
  }
  console.log(JSON.stringify({ reportPath }));
})().catch(error => { save(); console.error("Privacy probe interrupted", error.name); process.exitCode = 1; });
