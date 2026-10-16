const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
if (process.env.JD_LIVE_CHECK !== "1") throw new Error("Opt in with JD_LIVE_CHECK=1; requires verify-jd-live.js on port 5057.");
const base = "http://localhost:5057";
async function call(url, method = "GET", body) {
  const response = await fetch(base + url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  return { status: response.status, body: data };
}
(async () => {
  const audit = (await call("/audit")).body;
  assert.match(audit.database, /^resume_eng_jd_audit_[a-f0-9]{32}$/);
  const [a] = audit.fixtures;
  let state = (await call("/audit/state")).body;
  const accepted = state.suggestions.find(s => s.status === "accepted");
  assert.ok(accepted, "Browser must have accepted the controlled-provider suggestion first");
  const file = state.files.find(f => f._id === a.fileId);
  assert.equal(file.contentRevision, 2);
  assert.ok(file.content.includes(String.raw`\textbf{Node.js}`));
  assert.ok(file.content.includes("JD_AUDIT_BROWSER_EDIT_842"));
  assert.equal(file.pendingWrite, undefined);
  const liveFailures = state.analyses.filter(row => row.summary?.diagnosticReasons?.PROVIDER_ERROR > 0);
  assert.ok(liveFailures.length >= 1);

  await call("/audit/mode/controlled?delay=1500", "POST");
  const priorCalls = state.providerCalls;
  const pending = call("/api/tailoring/analyze", "POST", { projectId: a.projectId, versionId: "audit-concurrency", rawJobDescription: "Required: Node.js REST APIs" });
  for (let n = 0; n < 30; n++) {
    state = (await call("/audit/state")).body;
    if (state.providerCalls > priorCalls) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(state.providerCalls > priorCalls, "Must edit after evidence was read and provider generation started");
  const nextContent = file.content.replace("JD_AUDIT_BROWSER_EDIT_842", "JD_AUDIT_CONCURRENT_953");
  const write = await call(`/api/latex/files/${a.fileId}`, "PATCH", { content: nextContent, expectedRevision: 2 });
  assert.equal(write.status, 200);
  const concurrent = await pending;
  assert.equal(concurrent.status, 201);
  assert.equal(concurrent.body.data.summary.safeSuggestions, 0);
  assert.equal(concurrent.body.data.summary.diagnosticReasons.SOURCE_PATCH_FAILED, 1);

  await call("/audit/mode/controlled", "POST");
  const fresh = await call("/api/tailoring/analyze", "POST", { projectId: a.projectId, versionId: "audit-concurrency", rawJobDescription: "Required: Node.js REST APIs" });
  assert.equal(fresh.body.data.summary.safeSuggestions, 1);
  state = (await call("/audit/state")).body;
  const pendingSuggestion = state.suggestions.find(s => s.analysisId === fresh.body.data.analysisId);
  const finalContent = nextContent.replace("JD_AUDIT_CONCURRENT_953", "JD_AUDIT_AFTER_ANALYSIS_164");
  assert.equal((await call(`/api/latex/files/${a.fileId}`, "PATCH", { content: finalContent, expectedRevision: 3 })).status, 200);
  const stale = await call(`/api/tailoring/suggestions/${pendingSuggestion.suggestionId}/accept`, "POST", { projectId: a.projectId, versionId: "audit-concurrency" });
  assert.equal(stale.status, 409); assert.equal(stale.body.code, "SOURCE_CHANGED");
  const badRevision = await call(`/api/latex/files/${a.fileId}`, "PATCH", { content: "MUST NOT SAVE", expectedRevision: 2 });
  assert.equal(badRevision.status, 409);
  state = (await call("/audit/state")).body;
  const final = state.files.find(f => f._id === a.fileId);
  assert.equal(final.content, finalContent); assert.equal(final.contentRevision, 4); assert.equal(final.pendingWrite, undefined);
  assert.equal(state.suggestions.find(s => s.suggestionId === pendingSuggestion.suggestionId).status, "pending");
  const report = { database: audit.database, topology: audit.topology, projectId: a.projectId, fileId: a.fileId,
    browserAcceptedSuggestion: accepted.suggestionId, acceptedContentRevision: 2,
    realProviderFailures: liveFailures.map(row => ({ analysisId: row.analysisId, reasons: row.summary.diagnosticReasons })),
    concurrentAnalysis: concurrent.body.data, staleAcceptance: { status: stale.status, code: stale.body.code },
    staleSaveStatus: badRevision.status, finalContentRevision: final.contentRevision, finalContent: final.content,
    limits: ["Controlled provider acceptance is not a successful live OpenRouter suggestion", "No immutable cross-file analysis snapshot", "No general semantic entailment guarantee"] };
  const reportPath = path.join(__dirname, `${audit.database}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, ...report, reportPath }));
})().catch(error => { console.error(error); process.exitCode = 1; });
