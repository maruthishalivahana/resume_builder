const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
require("tsx/cjs");
const { FileSaveManager } = require("../lib/file-save-manager.ts");
const source = fs.readFileSync(path.join(__dirname, "../hooks/use-resume.tsx"), "utf8");
const ast = ts.createSourceFile("use-resume.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name, dependencies) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.arguments[0].getText(ast);
    if (name === "scopeEffect" && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]?.getText(ast).includes("startNewJdAnalysis()")) expression = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const fn = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(dependencies), code + "\nreturn fn;")(...Object.values(dependencies));
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function workspace(overrides = {}) {
  const state = {}, events = [], identity = { current: "A" }, version = { current: "v1" }, load = { current: 1 }, seq = { current: 0 };
  let server = { content: "old", contentRevision: 0 };
  const manager = new FileSaveManager(overrides.persist || (async (id, content, expectedRevision) => {
    events.push("save"); assert.equal(id, "a"); assert.equal(expectedRevision, server.contentRevision);
    server = { content, contentRevision: expectedRevision + 1 }; return server;
  }), () => {}, 100000);
  manager.merge({ id: "a", ...server, contentLoaded: true }, "A");
  const set = key => value => { state[key] = typeof value === "function" ? value(state[key]) : value; };
  const deps = {
    projectId: "A", currentVersionId: "v1", isProjectLoading: false, projectLoadError: null,
    projectIdRef: identity, currentVersionIdRef: version, projectLoadSeq: load, jdRequestSeqRef: seq,
    saveManagerRef: { current: manager }, tailoringRefreshSeqRef: { current: 0 }, tailoringAnalysisId: null,
    setActiveJdSession: set("session"), setTailoringSuggestions: set("suggestions"), setTailoringSuggestionsLoading: set("loading"),
    setTailoringSuggestionsError: set("error"), setTailoringAnalysisSummary: set("summary"), setTailoringAnalysisStatus: set("status"),
    setTailoringAnalysisId: set("analysisId"), setTailoringAnalysisRequirements: set("requirements"),
    fetchProjectFiles: async () => { events.push("tree"); return { files: [], folders: [] }; },
    indexTailoringResume: async (id, v) => { events.push("index"); assert.equal(id, identity.current); assert.equal(v, version.current); },
    extractTailoringRequirements: async () => { events.push("extract"); return [{ requirementId: "r1" }]; },
    analyzeTailoring: async () => { events.push("analyze"); return { analysisId: "analysis-A", summary: { total: 1 } }; },
    fetchTailoringAnalysis: async () => { events.push("analysis-result"); return { requirements: [{ requirementId: "r1", text: "Node.js" }] }; },
    fetchTailoringSuggestions: async () => { events.push("suggestions-result"); return [{ suggestionId: "s1", marker: "A" }]; },
    ...overrides,
  };
  return { state, events, identity, version, load, seq, manager, deps, server: () => server,
    run: () => callback("generateTailoringSuggestions", deps)("Node.js engineer"),
    refresh: () => callback("refreshTailoringSuggestions", deps)(),
  };
}

(async () => {
  const w = workspace();
  try {
    w.manager.edit("a", "NEW_SOURCE_731");
    w.deps.indexTailoringResume = async () => {
      w.events.push("index"); assert.equal(w.server().content, "NEW_SOURCE_731"); assert.equal(w.server().contentRevision, 1);
      assert.equal(w.manager.status("A"), "saved");
    };
    await w.run();
    assert.ok(w.events.indexOf("save") < w.events.indexOf("index"));
    assert.equal(w.state.session.status, "completed"); assert.equal(w.state.analysisId, "analysis-A");
  } finally { w.manager.deactivate(); }

  for (const reason of ["save failure", "conflict", "recovered draft", "write recovery", "tree recovery"]) {
    const x = workspace(reason === "save failure" ? { persist: async () => { throw new Error("save failed; local edits retained"); } } : {});
    try {
      if (reason === "save failure") x.manager.edit("a", "LOCAL");
      if (reason === "conflict") { x.manager.edit("a", "LOCAL"); x.manager.merge({ id: "a", content: "REMOTE", contentRevision: 1, contentLoaded: true }, "A"); }
      if (reason === "recovered draft") x.manager.restore([{ id: "unopened", projectId: "A", content: "DRAFT", revision: 0, baseContent: "old", savedAt: 1 }]);
      if (reason === "write recovery") x.manager.merge({ id: "a", content: "old", contentRevision: 0, contentLoaded: true, recoveryPending: true }, "A");
      if (reason === "tree recovery") x.deps.fetchProjectFiles = async () => { throw new Error("Tree recovery pending"); };
      await assert.rejects(x.run());
      assert.equal(x.events.includes("index"), false, reason);
      assert.equal(x.events.includes("analyze"), false, reason);
      assert.equal(x.state.session.status, "failed"); assert.ok(x.state.error); assert.equal(x.state.loading, false);
      if (["conflict", "save failure"].includes(reason)) assert.equal(x.manager.view({ id: "a" }).content, "LOCAL");
      if (reason === "recovered draft") assert.equal(x.manager.drafts()[0].content, "DRAFT");
    } finally { x.manager.deactivate(); }
  }

  for (const fail of [false, true]) {
    const x = workspace();
    try {
      x.deps.extractTailoringRequirements = async () => {
        x.manager.edit("a", "EDIT_DURING_EXTRACTION");
        if (fail) x.manager.merge({ id: "a", content: "REMOTE", contentRevision: 1, contentLoaded: true }, "A");
        return [{ requirementId: "r1" }];
      };
      x.deps.analyzeTailoring = async () => {
        assert.equal(x.server().content, "EDIT_DURING_EXTRACTION"); assert.equal(x.manager.status("A"), "saved");
        x.events.push("analyze"); return { analysisId: "analysis-A", summary: {} };
      };
      if (fail) {
        await assert.rejects(x.run()); assert.equal(x.events.includes("analyze"), false);
        assert.equal(x.manager.view({ id: "a" }).content, "EDIT_DURING_EXTRACTION");
      } else { await x.run(); assert.equal(x.state.session.status, "completed"); }
    } finally { x.manager.deactivate(); }
  }

  for (const overrides of [{ isProjectLoading: true }, { projectLoadError: "Failed to load" }, { currentVersionId: null }, { projectId: null }]) {
    const x = workspace(overrides);
    try { await assert.rejects(x.run()); assert.deepEqual(x.events, []); }
    finally { x.manager.deactivate(); }
  }

  // Every awaited boundary must ignore both late successes and late failures.
  for (const stage of ["flush", "tree", "index", "extract", "analyze", "results"]) {
    for (const failure of [false, true]) {
      const gate = deferred(), x = workspace();
      try {
        const key = { tree: "fetchProjectFiles", index: "indexTailoringResume", extract: "extractTailoringRequirements", analyze: "analyzeTailoring", results: "fetchTailoringAnalysis" }[stage];
        if (stage === "flush") x.deps.saveManagerRef = { current: { flush: async () => gate.promise } };
        else { const next = x.deps[key]; x.deps[key] = async (...args) => { await gate.promise; return next(...args); }; }
        const request = x.run(); await tick();
        x.identity.current = "B"; x.load.current += 1;
        x.state.session = { marker: "B" }; x.state.suggestions = [{ marker: "B" }]; x.state.loading = true;
        const before = structuredClone(x.state);
        if (failure) gate.reject(new Error("old A failed")); else gate.resolve();
        await request;
        assert.deepEqual(x.state, before, `${stage}: A must not overwrite B or clear B loading state`);
      } finally { x.manager.deactivate(); }
    }
  }
  for (const change of ["version", "ABA", "new request"]) {
    const gate = deferred(), x = workspace({ analyzeTailoring: async () => { await gate.promise; return { analysisId: "old", summary: {} }; } });
    try {
      const request = x.run(); await tick();
      if (change === "version") x.version.current = "v2";
      if (change === "ABA") x.load.current += 2;
      if (change === "new request") x.seq.current += 1;
      x.state.session = { marker: "new" }; const before = structuredClone(x.state);
      gate.resolve(); await request; assert.deepEqual(x.state, before, change);
    } finally { x.manager.deactivate(); }
  }
  const refreshGate = deferred(), r = workspace({ fetchTailoringSuggestions: async () => { await refreshGate.promise; return [{ marker: "A" }]; } });
  try {
    const request = r.refresh(); await tick(); r.identity.current = "B"; r.load.current++;
    r.state.suggestions = [{ marker: "B" }]; r.state.loading = true; const before = structuredClone(r.state);
    refreshGate.resolve(); await request; assert.deepEqual(r.state, before);
  } finally { r.manager.deactivate(); }
  const e = workspace();
  try {
    e.deps.startNewJdAnalysis = callback("startNewJdAnalysis", e.deps);
    const effect = callback("scopeEffect", e.deps);
    e.state.session = { marker: "old" };
    const cleanup = effect(); assert.equal(e.state.session, null); assert.deepEqual(e.state.suggestions, []);
    const prior = e.seq.current; cleanup(); assert.ok(e.seq.current > prior, "Unmount/scope cleanup must invalidate requests");
  } finally { e.manager.deactivate(); }
  const unavailable = workspace({ fetchTailoringAnalysis: async () => ({ requirements: [], diagnosticReasons: { PROVIDER_ERROR: 1 } }), fetchTailoringSuggestions: async () => [] });
  try {
    await unavailable.run();
    assert.deepEqual(unavailable.state.session.diagnosticReasons, { PROVIDER_ERROR: 1 }, "Persisted failure reasons must reach the UI session");
  } finally { unavailable.manager.deactivate(); }
  const unmountGate = deferred(), u = workspace({ analyzeTailoring: async () => { await unmountGate.promise; return { analysisId: "old", summary: {} }; } });
  try {
    u.deps.startNewJdAnalysis = callback("startNewJdAnalysis", u.deps);
    const cleanup = callback("scopeEffect", u.deps)();
    const request = u.run(); await tick(); cleanup();
    const before = structuredClone(u.state);
    unmountGate.resolve(); await request; assert.deepEqual(u.state, before, "Unmounted analysis must not update state");
  } finally { u.manager.deactivate(); }
  console.log("JD analysis guards passed: saved-source barrier, conflicts/recovery, all stale boundaries, version/ABA/request identity, refresh and cleanup (actual callbacks, mocked APIs)");
})().catch(error => { console.error(error); process.exitCode = 1; });
