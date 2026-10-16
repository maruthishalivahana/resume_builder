const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
require("tsx/cjs");
const { ProjectViewStateStore, reconcileProjectViewState, projectViewKey } = require("../lib/project-view-state.ts");
const { FileSaveManager } = require("../lib/file-save-manager.ts");
const { buildProjectTree, visibleProjectTree } = require("../lib/project-tree.ts");
const source = fs.readFileSync(path.join(__dirname, "../hooks/use-resume.tsx"), "utf8");
const ast = ts.createSourceFile("use-resume.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function extract(name, dependencies) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.arguments[0].getText(ast);
    if (name === "persistView" && ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" &&
        node.arguments[0]?.getText(ast).includes("projectViewStoreRef.current.save")) expression = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const fn = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(dependencies), code + "\nreturn fn;")(...Object.values(dependencies));
}
const A = "aaaaaaaaaaaaaaaaaaaaaaaa", B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const file = (id, folderId = null) => ({ id, folderId, name: id, path: id, content: "", contentRevision: 7, contentLoaded: true });
const folder = (id, parentFolderId = null) => ({ id, parentFolderId, name: id, path: id });
const treeA = { files: [file("a1"), file("a2", "nested")], folders: [folder("root"), folder("nested", "root"), folder("deep", "nested")] };
const treeB = { files: [file("b1"), file("b2")], folders: [folder("b-folder")] };
function memoryStorage() {
  const values = new Map(), writes = [];
  return { values, writes, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); writes.push({ key, value: JSON.parse(value) }); } };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function workspace(storage, overrides = {}) {
  const state = { projectId: null, activeFileId: "", expandedFolderIds: [], files: [], folders: [], isProjectLoading: false, projectLoadError: null };
  const identity = { current: null }, viewIdentity = { current: null }, sequence = { current: 0 };
  const store = new ProjectViewStateStore(() => storage);
  const manager = new FileSaveManager(overrides.persist || (async () => { throw new Error("offline"); }), () => {
    state.files = state.files.map(item => manager.view(item));
  }, 100000);
  const set = key => value => { state[key] = typeof value === "function" ? value(state[key]) : value; };
  const noop = () => {};
  const deps = {
    resolveCompileTarget: noop,
    readCompileTarget: (id, files, fallback) => fallback, writeCompileTarget: noop,
    compileTargetRef: { current: null }, targetRequestSeq: { current: 0 }, setCompileTargetId: noop, setBuildHistory: noop, setPreviewBuild: noop, setTargetLoadError: noop, fetchCompilationHistory: async () => ({builds:[],page:1,hasMore:false}),
    projectLoadSeq: sequence, projectIdRef: identity, viewProjectIdRef: viewIdentity,
    projectViewStoreRef: { current: store }, reconcileProjectViewState, saveManagerRef: { current: manager },
    setProjectId: set("projectId"), setActiveFileId: set("activeFileId"), setExpandedFolderIds: set("expandedFolderIds"),
    setFiles: set("files"), setFolders: set("folders"), setIsProjectLoading: set("isProjectLoading"), setProjectLoadError: set("projectLoadError"),
    setProjectName: noop, setEntryFileId: set("entry"), setLatexCode: set("code"), setPdfUrl: noop, setPdfState: noop,
    setCompileStatus: noop, setCompileErrors: noop, setCompileLog: noop, setCompileDuration: noop, setLastCompiledAt: noop, setIsPdfStale: noop,
    applyCompilationState: noop, markPdfSourceChanged: noop,
    fetchLatexProject: async id => ({ id, name: id, entryFileId: "compiler-entry-is-independent" }),
    fetchProjectFiles: async id => id === A ? treeA : treeB, fetchLatestCompilation: async () => null,
    fetchLatexFile: async id => file(id), ...overrides,
  };
  deps.mergeProjectFiles = extract("mergeProjectFiles", deps);
  return { state, identity, viewIdentity, sequence, store, manager, deps,
    load: extract("loadProject", deps), toggle: extract("toggleFolder", deps),
    persist: () => extract("persistView", { ...deps, ...state })(),
    capturedPersist: () => extract("persistView", { ...deps, ...state }),
  };
}
async function tests() {
  const storage = memoryStorage();
  const w = workspace(storage);
  await w.load(A);
  assert.equal(w.state.activeFileId, "a1"); assert.deepEqual(w.state.expandedFolderIds, []);
  w.state.activeFileId = "a2"; w.toggle("root"); w.toggle("nested"); w.toggle("nested"); w.persist();
  const raw = storage.values.get(projectViewKey(A));
  assert.deepEqual(JSON.parse(raw), { version: 1, projectId: A, activeFileId: "a2", expandedFolderIds: ["root"] });
  // New store/provider instances simulate a restart, rather than reusing the in-memory cache.
  const reopened = workspace(storage); await reopened.load(A);
  assert.equal(reopened.state.activeFileId, "a2"); assert.deepEqual(reopened.state.expandedFolderIds, ["root"]);
  assert.equal(reopened.state.entry, "compiler-entry-is-independent"); assert.equal(reopened.state.code, "");
  assert.deepEqual(visibleProjectTree(buildProjectTree(reopened.state.files, reopened.state.folders).roots,
    reopened.state.expandedFolderIds).map(row => row.node.item.id), ["root", "nested", "a1"]);
  const contentReads = [];
  const unloaded = workspace(storage, {
    fetchProjectFiles: async () => ({ ...treeA, files: treeA.files.map(item => ({ ...item, contentLoaded: false })) }),
    fetchLatexFile: async id => { contentReads.push(id); return { ...file(id), content: "selected source", contentRevision: 9 }; },
  });
  await unloaded.load(A);
  assert.deepEqual(contentReads, ["a2"]); assert.equal(unloaded.state.code, "selected source");
  assert.equal(unloaded.state.files.find(item => item.id === "a2").contentRevision, 9);
  assert.equal(unloaded.state.files.find(item => item.id === "a2").contentLoaded, true);
  assert.equal(unloaded.state.entry, "compiler-entry-is-independent"); unloaded.manager.deactivate();
  await w.load(B); w.state.activeFileId = "b2"; w.toggle("b-folder"); w.persist();
  await w.load(A); assert.equal(w.state.activeFileId, "a2"); assert.deepEqual(w.state.expandedFolderIds, ["root"]);
  await w.load(B); assert.equal(w.state.activeFileId, "b2"); assert.deepEqual(w.state.expandedFolderIds, ["b-folder"]);
  const restartB = workspace(storage); await restartB.load(B); assert.equal(restartB.state.activeFileId, "b2");
  assert.deepEqual(restartB.state.expandedFolderIds, ["b-folder"]);
  // Same-project tree refresh must preserve an intentionally empty expansion list.
  w.toggle("b-folder"); w.persist(); await w.load(B); assert.deepEqual(w.state.expandedFolderIds, []);
  for (const instance of [w, reopened, restartB]) instance.manager.deactivate();

  const stale = memoryStorage();
  new ProjectViewStateStore(() => stale).save(A, { activeFileId: "deleted", expandedFolderIds: ["root", "gone", "root"] });
  const changed = workspace(stale); await changed.load(A); changed.persist();
  assert.equal(changed.state.activeFileId, "a1"); assert.deepEqual(changed.state.expandedFolderIds, ["root"]);
  assert.equal(JSON.parse(stale.values.get(projectViewKey(A))).activeFileId, "a1"); changed.manager.deactivate();
  for (const folders of [[], [folder("root"), folder("nested", "root")]]) {
    const empty = workspace(stale, { fetchProjectFiles: async () => ({ files: [], folders }),
      fetchLatexFile: async () => assert.fail("Empty project must not read or invent a file") });
    await empty.load(A); empty.persist(); assert.equal(empty.state.activeFileId, "");
    assert.deepEqual(empty.state.files, []); assert.equal(JSON.parse(stale.values.get(projectViewKey(A))).activeFileId, null);
    empty.manager.deactivate();
  }
  for (const rawValue of ["{bad-json", "null", JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, projectId: B, activeFileId: "b1", expandedFolderIds: [] }),
    JSON.stringify({ version: 1, projectId: A, activeFileId: [], expandedFolderIds: [] }),
    JSON.stringify({ version: 1, projectId: A, activeFileId: null, expandedFolderIds: [3] }), " ".repeat(1024 * 1024 + 1)]) {
    const corrupt = memoryStorage(); corrupt.values.set(projectViewKey(A), rawValue);
    const c = workspace(corrupt); await c.load(A); assert.equal(c.state.activeFileId, "a1");
    assert.deepEqual(c.state.expandedFolderIds, []); c.persist(); c.manager.deactivate();
  }
  for (const getStorage of [() => undefined, () => { throw new Error("SecurityError"); },
    () => ({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); } }),
    () => ({ getItem: () => null, setItem: () => { throw new Error("quota"); } })]) {
    const store = new ProjectViewStateStore(getStorage);
    assert.equal(store.read(A), undefined);
    store.save(A, { activeFileId: "a2", expandedFolderIds: [] });
    assert.deepEqual(store.read(A), { activeFileId: "a2", expandedFolderIds: [] });
    assert.equal(store.read(B), undefined);
    const selected = store.read(A); selected.expandedFolderIds.push("mutated");
    assert.deepEqual(store.read(A).expandedFolderIds, []);
  }
  const unavailable = workspace({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); } });
  await unavailable.load(A); unavailable.state.activeFileId = "a2"; unavailable.toggle("root"); unavailable.persist();
  await unavailable.load(B); await unavailable.load(A);
  assert.equal(unavailable.state.activeFileId, "a2"); assert.deepEqual(unavailable.state.expandedFolderIds, ["root"]);
  unavailable.manager.deactivate();
  const failedStorage = memoryStorage(); failedStorage.setItem(projectViewKey(A), raw);
  const failed = workspace(failedStorage, { fetchProjectFiles: async () => { throw new Error("tree recovery pending"); } });
  await assert.rejects(failed.load(A), /tree recovery/); failed.persist();
  assert.equal(failedStorage.values.get(projectViewKey(A)), raw); assert.equal(failedStorage.writes.length, 1);
  assert.equal(failed.viewIdentity.current, null); failed.manager.deactivate();

  // Pending autosave + pending A load + old React effect must not write A's view under B.
  const racingStorage = memoryStorage(), save = deferred(), loadA = deferred();
  let delayA = false;
  const racing = workspace(racingStorage, {
    persist: async (id, content, revision) => { assert.equal(id, "a2"); assert.equal(content, "dirty A"); assert.equal(revision, 7);
      await save.promise; return { content, contentRevision: 8 }; },
    fetchProjectFiles: async id => { if (id === A && delayA) await loadA.promise; return id === A ? treeA : treeB; },
  });
  await racing.load(A); racing.state.activeFileId = "a2"; racing.toggle("root"); racing.persist();
  racing.manager.edit("a2", "dirty A"); const saving = racing.manager.flush(A); await tick();
  const oldEffect = racing.capturedPersist();
  delayA = true; const pendingA = racing.load(A); await tick();
  racing.persist(); assert.equal(racingStorage.writes.length, 1); // Loading must not save temporary state.
  await racing.load(B); racing.state.activeFileId = "b2"; racing.toggle("b-folder"); racing.persist();
  oldEffect(); assert.equal(racingStorage.writes.length, 2); // Old render cannot persist after identity changes.
  save.resolve(); await saving; loadA.resolve(); await pendingA; racing.persist();
  assert.equal(racing.state.projectId, B); assert.equal(racing.state.activeFileId, "b2");
  assert.deepEqual(racing.state.expandedFolderIds, ["b-folder"]);
  assert.deepEqual(racing.store.read(A), { activeFileId: "a2", expandedFolderIds: ["root"] });
  assert.deepEqual(racing.store.read(B), { activeFileId: "b2", expandedFolderIds: ["b-folder"] });
  assert.equal(racing.manager.view(file("a2")).content, "dirty A"); assert.equal(racing.manager.view(file("a2")).contentRevision, 8);
  assert.equal(racing.manager.status(A), "saved"); assert.equal(racing.state.files.some(item => item.id === "a2"), false);
  await racing.load(A); assert.equal(racing.state.activeFileId, "a2");
  assert.equal(racing.state.files.find(item => item.id === "a2").content, "dirty A");
  assert.equal(racing.state.files.find(item => item.id === "a2").contentRevision, 8); racing.manager.deactivate();
}
tests().then(() => console.log("Project view-state regressions passed: actual hook callbacks/effect and save manager, mocked storage/network/state; restart, project isolation, stale/deleted IDs, empty/folder-only, collapsed nesting, corrupt/blocked/quota storage, pending saves and late loads."))
  .catch(error => { console.error(error); process.exitCode = 1; });
