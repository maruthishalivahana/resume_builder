const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
require("tsx/cjs");
const { FileSaveManager } = require("../lib/file-save-manager.ts");
const { ProjectViewStateStore, reconcileProjectViewState } = require("../lib/project-view-state.ts");
const api = require("../lib/api/latex.ts");
const source = fs.readFileSync(path.join(__dirname, "../hooks/use-resume.tsx"), "utf8");
const ast = ts.createSourceFile("use-resume.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name, dependencies) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const callback = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(dependencies), code + "\nreturn callback;")(...Object.values(dependencies));
}
const A = "aaaaaaaaaaaaaaaaaaaaaaaa", B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const file = (id, content = "", revision = 0) => ({ id, name: `${id}.tex`, path: `${id}.tex`, content, contentRevision: revision, contentLoaded: true });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function workspace(overrides = {}) {
  const state = { projectId: null, name: null, files: [], folders: [], active: "", entry: null, loading: false, error: null, code: "", pdf: null };
  const identity = { current: null }, sequence = { current: 0 }, active = { current: "" };
  const manager = new FileSaveManager(async () => { throw new Error("offline; preserve dirty buffers"); }, () => {}, 100000);
  const setter = key => update => { state[key] = typeof update === "function" ? update(state[key]) : update; };
  const noop = () => {};
  const deps = {
    resolveCompileTarget: noop,
    readCompileTarget: (id, files, fallback) => fallback, writeCompileTarget: noop,
    compileTargetRef: { current: null }, targetRequestSeq: { current: 0 }, setCompileTargetId: noop, setBuildHistory: noop, setPreviewBuild: noop, setTargetLoadError: noop, fetchCompilationHistory: async () => ({builds:[],page:1,hasMore:false}),
    projectLoadSeq: sequence, projectIdRef: identity, activeFileIdRef: active, saveManagerRef: { current: manager },
    projectViewStoreRef: { current: new ProjectViewStateStore(() => undefined) }, viewProjectIdRef: { current: null }, reconcileProjectViewState,
    setProjectId: setter("projectId"), setProjectName: setter("name"), setEntryFileId: setter("entry"),
    setFiles: setter("files"), setFolders: setter("folders"), setActiveFileId: value => { state.active = active.current = value; },
    setExpandedFolderIds: setter("expanded"), setLatexCode: setter("code"), setIsProjectLoading: setter("loading"), setProjectLoadError: setter("error"),
    setPdfUrl: setter("pdf"), setPdfState: noop, setCompileStatus: noop, setCompileErrors: noop, setCompileLog: noop,
    setCompileDuration: noop, setLastCompiledAt: noop, setIsPdfStale: noop, markPdfSourceChanged: noop,
    fetchLatexProject: async id => ({ id, name: id, entryFileId: null }), fetchProjectFiles: async () => ({ files: [], folders: [] }),
    fetchLatexFile: async id => file(id), fetchLatestCompilation: async () => null,
    applyCompilationState: value => { state.pdf = value; }, ...overrides,
  };
  deps.mergeProjectFiles = callback("mergeProjectFiles", deps);
  const load = callback("loadProject", deps);
  return { state, identity, manager, load, deps };
}
async function restorationTests() {
  // Execute the actual route effect: demo is an alias, and only real route IDs load.
  let routeEffect;
  function findEffect(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]?.getText(ast).includes("loadProject(requestedProjectId)")) routeEffect = node.arguments[0].getText(ast);
    ts.forEachChild(node, findEffect);
  }
  findEffect(ast); assert.ok(routeEffect);
  for (const id of [A, "demo", undefined]) {
    let loaded, cancelled = 0;
    const code = ts.transpileModule(`const effect = ${routeEffect};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    const effect = new Function("requestedProjectId", "loadProject", "setIsProjectLoading", "setProjectLoadError", "cancelProjectLoad", code + "return effect;")(
      id, async value => { loaded = value; }, () => {}, () => {}, () => cancelled++);
    const cleanup = effect(); await tick();
    assert.equal(loaded, id === A ? A : undefined);
    if (cleanup) cleanup(); assert.equal(cancelled, id === A ? 1 : 0);
  }
  // Use actual API adapters: B has the latest file, but no /latest request is allowed.
  const originalFetch = global.fetch;
  const requests = [];
  try {
    global.fetch = async url => {
      requests.push(url);
      let data;
      if (url.endsWith(`/projects/${A}`)) data = { project: { id: A, name: "A", entryFileId: null } };
      else if (url.endsWith(`/projects/${A}/files`)) data = { files: [file("A-file", "A source", 4)], folders: [] };
      else if (url.endsWith("/files/A-file")) data = { file: file("A-file", "A source", 4) };
      else if (url.endsWith(`/projects/${A}/compilation/latest`)) data = { state: "none", latest: null };
      else if (url.endsWith("/latest")) data = { project: { id: B }, file: file("B-file", "wrong source") };
      else assert.fail(`Unexpected request: ${url}`);
      return { ok: true, status: 200, json: async () => ({ success: true, data }) };
    };
    const w = workspace({ fetchLatexProject: api.fetchLatexProject, fetchProjectFiles: api.fetchProjectFiles,
      fetchLatexFile: api.fetchLatexFile, fetchLatestCompilation: api.fetchLatestCompilation });
    await w.load(A);
    assert.equal(w.state.projectId, A); assert.equal(w.state.files[0].content, "A source"); assert.equal(w.state.files[0].contentRevision, 4);
    assert.equal(w.state.files[0].contentLoaded, true); assert.equal(w.state.entry, null);
    assert.equal(requests.some(url => url.endsWith("/api/latex/latest")), false); w.manager.deactivate();
    global.fetch = async () => ({ ok: false, status: 503, json: async () => ({ success: false, message: "Project tree recovery is pending" }) });
    await assert.rejects(api.fetchProjectFiles(A), /tree recovery/);
  } finally { global.fetch = originalFetch; }

  for (const folders of [[], [{ id: "folder", name: "empty-folder", path: "empty-folder", parentFolderId: null }]]) {
    let contentReads = 0;
    const w = workspace({ fetchProjectFiles: async () => ({ files: [], folders }), fetchLatexFile: async () => { contentReads++; } });
    await w.load(A); assert.equal(w.state.projectId, A); assert.deepEqual(w.state.files, []); assert.deepEqual(w.state.folders, folders);
    assert.equal(w.state.active, ""); assert.equal(w.state.entry, null); assert.equal(w.state.code, ""); assert.equal(contentReads, 0); w.manager.deactivate();
  }
  for (const id of ["", "invalid", "demo"]) {
    let requests = 0;
    const w = workspace({ fetchLatexProject: async () => { requests++; } });
    await assert.rejects(w.load(id), /valid project ID/);
    assert.equal(requests, 0); assert.equal(w.state.projectId, null); assert.equal(w.state.loading, false); assert.match(w.state.error, /valid project ID/); w.manager.deactivate();
  }
  const missing = workspace({ fetchLatexProject: async () => { throw new Error("Project not found"); } });
  await assert.rejects(missing.load(A), /not found/); assert.equal(missing.state.error, "Project not found"); assert.deepEqual(missing.state.files, []); missing.manager.deactivate();
  const recovering = workspace({ fetchProjectFiles: async () => { throw new Error("Project tree recovery is pending"); } });
  await assert.rejects(recovering.load(A), /tree recovery/); assert.match(recovering.state.error, /tree recovery/); recovering.manager.deactivate();
  const noContent = workspace({ fetchProjectFiles: async () => ({ files: [{ ...file("unloaded"), contentLoaded: false }], folders: [] }), fetchLatexFile: async () => null });
  await assert.rejects(noContent.load(A), /selected file/); assert.match(noContent.state.error, /selected file/); noContent.manager.deactivate();

  // Race each awaited stage, including rejected stale requests and the PDF response.
  for (const stage of ["metadata", "tree", "content", "pdf", "failure"]) {
    const gate = deferred();
    const w = workspace({
      fetchLatexProject: async id => { if (id === A && ["metadata", "failure"].includes(stage)) { await gate.promise; if (stage === "failure") throw new Error("stale error"); } return { id, name: id, entryFileId: `${id}-file` }; },
      fetchProjectFiles: async id => { if (id === A && stage === "tree") await gate.promise; return { files: [{ ...file(`${id}-file`), contentLoaded: false }], folders: [] }; },
      fetchLatexFile: async id => { if (id.startsWith(A) && stage === "content") await gate.promise; return file(id, `${id} source`, 2); },
      fetchLatestCompilation: async id => { if (id === A && stage === "pdf") await gate.promise; return { projectId: id }; },
    });
    const loadingA = w.load(A); await tick(); await w.load(B); gate.resolve(); await loadingA;
    assert.equal(w.state.projectId, B); assert.equal(w.identity.current, B); assert.equal(w.state.name, B);
    assert.equal(w.state.files[0].id, `${B}-file`); assert.equal(w.state.files[0].contentRevision, 2); assert.equal(w.state.code, `${B}-file source`);
    assert.deepEqual(w.state.pdf, { projectId: B }); assert.equal(w.state.error, null); assert.equal(w.state.loading, false); w.manager.deactivate();
  }

  const w = workspace({ fetchProjectFiles: async id => ({ files: [{ ...file(`${id}-file`), contentLoaded: false }], folders: [] }) });
  await w.load(A);
  w.manager.edit(`${A}-file`, "unsaved A");
  await w.load(B); assert.equal(w.manager.drafts()[0].content, "unsaved A");
  await w.load(A); assert.equal(w.state.files[0].content, "unsaved A"); assert.equal(w.state.files[0].contentLoaded, true);
  // A recovered draft against a newer server revision becomes an explicit conflict.
  w.manager.restore([{ id: "draft", projectId: B, content: "local draft", revision: 0, baseContent: "base", savedAt: 1 }]);
  w.deps.fetchProjectFiles = async () => ({ files: [{ ...file("draft", "", 2), contentLoaded: false }], folders: [] });
  w.deps.fetchLatexFile = async () => file("draft", "new server", 2);
  const restoreDraft = callback("loadProject", w.deps);
  await restoreDraft(B);
  assert.equal(w.state.files[0].content, "local draft");
  assert.deepEqual(w.manager.conflicts(B)[0], { id: "draft", local: "local draft", server: "new server", revision: 2 });
  await assert.rejects(w.manager.flush(B), /Resolve/);
  w.manager.deactivate();

  // A's rename must not call loadProject(A), even while B's metadata is still pending.
  const renameGate = deferred(), bGate = deferred();
  const race = workspace({ fetchLatexProject: async id => { if (id === B) await bGate.promise; return { id, name: id, entryFileId: null }; } });
  await race.load(A); let reloads = 0;
  const rename = callback("renameFolder", { projectIdRef: race.identity, saveManagerRef: { current: race.manager },
    renameLatexFolder: async () => renameGate.promise, markPdfSourceChanged: () => assert.fail("stale rename UI mutation"), loadProject: async () => { reloads++; } });
  const renaming = rename("A-folder", "new name"); await tick(); const loadingB = race.load(B);
  renameGate.resolve(); await renaming; assert.equal(reloads, 0); assert.equal(race.identity.current, B);
  bGate.resolve(); await loadingB; assert.equal(race.state.projectId, B); race.manager.deactivate();
  // Navigation follows the route during loading, and demo promotes an in-memory project ID.
  let baseExpression;
  function findBase(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "resumeBasePath") baseExpression = node.initializer.getText(ast);
    ts.forEachChild(node, findBase);
  }
  findBase(ast); assert.ok(baseExpression);
  const base = new Function("requestedProjectId", "projectId", `return ${baseExpression};`);
  assert.equal(base(B, A), `/resume/${B}`);
  assert.equal(base("demo", A), `/resume/${A}`); assert.equal(base("demo", null), "/resume/demo");
  const sidebarSource = fs.readFileSync(path.join(__dirname, "../components/app-shell/resume-sidebar.tsx"), "utf8");
  const sidebarAst = ts.createSourceFile("sidebar.tsx", sidebarSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let selectExpression;
  function findSelect(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sidebarAst) === "handleSelectFile") selectExpression = node.initializer.getText(sidebarAst);
    ts.forEachChild(node, findSelect);
  }
  findSelect(sidebarAst); assert.ok(selectExpression);
  const code = ts.transpileModule(`const select = ${selectExpression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const navigation = [], gate = deferred(), location = { pathname: `/resume/${A}/overview` };
  const select = new Function("selectFile", "pathname", "window", "router", "resumeBasePath", code + "return select;")(
    async () => gate.promise, location.pathname, { location }, { push: url => navigation.push(url) }, `/resume/${A}`);
  const selecting = select("A-file"); location.pathname = `/resume/${B}/overview`; gate.resolve(); await selecting;
  assert.deepEqual(navigation, [], "late file selection must not navigate back to A");
  assert.equal(source.includes("fetchLatestLatexFile"), false, "provider must not restore through global /latest");
  console.log("Project restoration regressions passed: requested project/API paths, empty/folder-only projects, invalid/missing IDs, stale responses at every load stage, rename race, dirty buffers/revisions/draft conflicts, tree recovery errors (mocked network; actual hook callbacks/save manager).");
}
restorationTests().catch(error => { console.error(error); process.exitCode = 1; });
