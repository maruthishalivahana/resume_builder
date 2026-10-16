const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");
require("tsx/cjs");
const { LatexProject } = require("./src/models/LatexProject.ts");
const { LatexFile } = require("./src/models/LatexFile.ts");
const { LatexFolder } = require("./src/models/LatexFolder.ts");
const { LatexCompilation } = require("./src/models/LatexCompilation.ts");
const { LatexCompilerService: compiler } = require("./src/services/latexCompiler.service.ts");
const { resolveEntryFile } = require("./src/services/latexEntryFile.service.ts");
const controllers = require("./src/controllers/latex.controller.ts");
const mongoose = require("mongoose");
const { AppError } = require("./src/middleware/error.middleware.ts");
const { FileSaveManager, afterSaved } = require("../lib/file-save-manager.ts");
const { ProjectViewStateStore, reconcileProjectViewState } = require("../lib/project-view-state.ts");
const source = fs.readFileSync(path.join(__dirname, "../hooks/use-resume.tsx"), "utf8");
const ast = ts.createSourceFile("use-resume.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name, deps) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const fn = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(deps), code + "\nreturn fn;")(...Object.values(deps));
}
function uploadCallback(deps) {
  const input = fs.readFileSync(path.join(__dirname, "src/controllers/latex.controller.ts"), "utf8");
  const syntax = ts.createSourceFile("controller.ts", input, ts.ScriptTarget.Latest, true);
  const declaration = syntax.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "uploadTexFile");
  const code = ts.transpileModule(`const fn = ${declaration.getText(syntax).replace(/^export\s+/, "")};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(deps), code + "\nreturn fn;")(...Object.values(deps));
}
const P = "aaaaaaaaaaaaaaaaaaaaaaaa", A = "bbbbbbbbbbbbbbbbbbbbbbbb", B = "cccccccccccccccccccccccc";
const document = text => `\\documentclass{article}\n\\begin{document}\n${text}\n\\end{document}\n`;
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function callController(fn, body, extra = {}) {
  let result, error;
  await fn({ params: { projectId: P }, body, ...extra }, { status() { return this; }, json(value) { result = value; } }, e => error = e);
  if (error) throw error;
  return result;
}
async function run() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "resume-entry-test-"));
  const replacements = [];
  const stub = (object, key, value) => { replacements.push([object, key, object[key]]); object[key] = value; };
  const project = { _id: P, name: "Independent resumes", entryFileId: A, sourceVersion: 1, treeVersion: 0 };
  const files = [
    { _id: A, projectId: P, folderId: null, name: "a.tex", path: "a.tex", content: document("Resume A ONLY"), contentRevision: 0, updatedAt: new Date() },
    { _id: B, projectId: P, folderId: null, name: "b.tex", path: "b.tex", content: document("Resume B ORIGINAL"), contentRevision: 0, updatedAt: new Date() },
  ];
  const records = [];
  let folderRecords = [], requests = 0;
  const clientFiles = () => files.map(f => ({ ...f, id: f._id, contentLoaded: true }));
  const state = { projectId: P, entryFileId: A, activeFileId: A, files: clientFiles(), folders: [], isCompiling: false, pdfState: "none" };
  const set = key => value => { state[key] = typeof value === "function" ? value(state[key]) : value; };
  const noop = () => {};
  const manager = new FileSaveManager(async (id, content, revision) => {
    const f = files.find(f => f._id === id);
    assert.equal(f.contentRevision, revision); f.content = content; f.contentRevision++; f.updatedAt = new Date(); project.sourceVersion++;
    return { content, contentRevision: f.contentRevision };
  }, () => { state.files = state.files.map(f => manager.view(f)); }, 100000);
  const deps = {
    resolveCompileTarget: noop,
    readCompileTarget: (id, files, fallback) => fallback, writeCompileTarget: noop,
    compileTargetRef: { current: null }, targetRequestSeq: { current: 0 }, setCompileTargetId: noop, setBuildHistory: noop, setPreviewBuild: noop, setTargetLoadError: noop, fetchCompilationHistory: async () => ({builds:[],page:1,hasMore:false}),
    projectIdRef: { current: P }, projectLoadSeq: { current: 0 }, entrySelectionPendingRef: { current: false },
    compileSubmissionRef: { current: false }, requestCompileTarget: async () => "configured",
    viewProjectIdRef: { current: P }, projectViewStoreRef: { current: new ProjectViewStateStore(() => undefined) }, reconcileProjectViewState,
    saveManagerRef: { current: manager }, afterSaved, setEntryFileId: set("entryFileId"), setActiveFileId: set("activeFileId"),
    setFiles: set("files"), setFolders: set("folders"), setExpandedFolderIds: set("expandedFolderIds"), setLatexCode: set("code"),
    setProjectId: set("projectId"), setProjectName: noop, setActiveErrorLine: noop, setIsProjectLoading: set("loading"), setProjectLoadError: set("loadError"),
    setIsCompiling: set("isCompiling"), setCompileStatus: set("compileStatus"), setCompileLog: set("compileLog"),
    setCompileDuration: noop, setCompileErrors: set("compileErrors"), setPdfState: set("pdfState"), setIsPdfStale: noop,
    setLastCompiledAt: noop, setPdfUrl: set("pdfUrl"), markPdfSourceChanged: noop, applyCompilationState: noop,
    getLatexPdfUrl: () => "/same-pdf-pipeline", fetchLatestCompilation: async () => null,
    fetchLatexProject: async () => (await callController(controllers.getProject, {})).data.project,
    fetchProjectFiles: async () => ({ files: clientFiles(), folders: folderRecords }),
    fetchLatexFile: async id => clientFiles().find(f => f.id === id),
    setLatexProjectEntryFile: async (id, entryFileId) => (await callController(controllers.setProjectEntryFile, { entryFileId })).data.project.entryFileId,
    compileLatexProject: async (projectId, entryFileId) => { requests++; return compiler.compileLatexProject({ projectId, entryFileId }); },
  };
  deps.selectCompileTarget = async id => { deps.compileTargetRef.current = id; };
  const hook = name => callback(name, { ...deps, ...state });
  try {
    stub(LatexProject, "findById", async () => ({ ...project }));
    stub(LatexProject, "updateOne", async (filter, update) => {
      assert.equal(filter._id, P); assert.deepEqual(filter.treeOperation, { $exists: false });
      if (project.treeOperation || (filter.treeVersion !== undefined && filter.treeVersion !== project.treeVersion)) return { matchedCount: 0 };
      Object.assign(project, update.$set); project.sourceVersion += update.$inc.sourceVersion; return { matchedCount: 1 };
    });
    stub(LatexFile, "find", async () => files.map(f => ({ ...f })));
    stub(LatexFile, "findOne", async filter => files.find(f => f._id === filter._id && f.projectId === filter.projectId));
    stub(LatexFile, "findById", async id => files.find(f => f._id === id));
    stub(LatexFolder, "find", async () => folderRecords);
    stub(LatexCompilation, "create", async data => { const record = { ...data, _id: (records.length + 1).toString(16).padStart(24, "0") }; records.push(record); return record; });
    stub(LatexCompilation, "findOne", filter => ({ sort: async () => [...records].reverse().find(record =>
      record.projectId === filter.projectId && record.status === filter.status && record.pdfPath && (!filter._id || record._id === filter._id)) ?? null }));
    stub(compiler, "getStorageDir", () => path.join(sandbox, "artifacts"));
    stub(console, "info", noop);
    // Default mode uses a process-level compiler fixture and explicitly does not claim real PDF validation.
    const fixture = path.join(sandbox, "compiler.js");
    fs.writeFileSync(fixture, `const fs=require('fs'),path=require('path');const args=process.argv.slice(2);const entry=args.at(-1);const out=args.find(a=>a.startsWith('-output-directory=')).split('=').slice(1).join('=');fs.writeFileSync(path.join(out,path.basename(entry,path.extname(entry))+'.pdf'),fs.readFileSync(entry));`);
    if (!process.env.RESUME_ENTRY_LIVE) {
      stub(compiler, "checkCompilerAvailability", async () => ({ available: true, compiler: "test fixture" }));
      stub(compiler, "getCompilerCommand", () => ({ command: process.execPath, prefixArgs: [fixture] }));
    } else {
      stub(compiler, "getCompilerCommand", () => ({ command: process.env.RESUME_ENTRY_LATEX || "pdflatex", prefixArgs: ["--disable-installer"] }));
    }
    const pdfText = record => {
      const artifact = path.resolve(record.pdfPath);
      assert.ok(fs.existsSync(artifact));
      return process.env.RESUME_ENTRY_LIVE ? execFileSync(process.env.RESUME_ENTRY_PDFTOTEXT || "pdftotext", [artifact, "-"], { encoding: "utf8", windowsHide: true }) : fs.readFileSync(artifact, "utf8");
    };
    // Reproduce the screenshot's three-file project before testing any changed UI behavior.
    const originalFiles = files.map(file => ({ ...file })), originalProject = { ...project };
    let scenarioManager;
    try {
      files[0].name = files[0].path = "Maruthi_Kummari_Resume_root.tex";
      files[0].content = document("ROOT BEFORE EDIT Technical Skills");
      files[1].name = "resume.tex"; files[1].path = "resume/resume.tex"; files[1].folderId = "resume-folder";
      files[1].content = document("ENTRY NESTED DISTINCTIVE Technical Skills");
      files.push({ ...files[0], _id: "dddddddddddddddddddddddd", name: "resume2.tex", path: "resume2.tex", content: document("OTHER RESUME") });
      folderRecords = [{ _id: "resume-folder", projectId: P, name: "resume", path: "resume", parentFolderId: null }]; project.entryFileId = B;
      state.entryFileId = B; state.activeFileId = A; state.files = clientFiles();
      scenarioManager = new FileSaveManager(async (id, content, revision) => {
        assert.equal(id, A); assert.equal(revision, 0);
        files[0].content = content; files[0].contentRevision = 1; project.sourceVersion++;
        return { content, contentRevision: 1 };
      }, () => { state.files = state.files.map(file => scenarioManager.view(file)); }, 100000);
      deps.saveManagerRef.current = scenarioManager;
      state.files.forEach(file => scenarioManager.merge(file, P));
      await hook("selectFile")(A);
      scenarioManager.edit(A, document("ROOT AFTER EDIT DISTINCTIVE"));
      const originalCompile = deps.compileLatexProject;
      deps.compileLatexProject = async (projectId, entryFileId) => {
        assert.equal(entryFileId, B); assert.equal(files[0].contentRevision, 1);
        assert.doesNotMatch(files[0].content, /Technical Skills/); // Confirmed server content BEFORE invoking compiler.
        assert.match(files[0].content, /ROOT AFTER EDIT DISTINCTIVE/);
        return originalCompile(projectId, entryFileId);
      };
      await hook("compileLatex")(); deps.compileLatexProject = originalCompile;
      assert.equal(state.compileStatus, "success", state.compileLog);
      const nestedBuild = records.at(-1);
      assert.equal(nestedBuild.compiledEntryFileId, B); assert.equal(nestedBuild.mainFile, "resume/resume.tex");
      assert.match(pdfText(nestedBuild), /ENTRY NESTED DISTINCTIVE.*Technical Skills/);
      assert.doesNotMatch(pdfText(nestedBuild), /ROOT AFTER EDIT DISTINCTIVE/);
      assert.ok(state.pdfUrl.endsWith(`compilationId=${nestedBuild._id}`));
      // Selecting the intended root entry is deliberate; opening/editing it did not select it.
      assert.equal(project.entryFileId, B); await hook("setEntryFile")(A);
      const previousFetch = deps.fetchLatestCompilation, previousApply = deps.applyCompilationState;
      deps.fetchLatestCompilation = async () => ({ pdf: { url: `/api/latex/projects/${P}/pdf?compilationId=${nestedBuild._id}` } });
      deps.applyCompilationState = value => { state.pdfUrl = value.pdf.url; };
      await hook("compileLatex")(); deps.fetchLatestCompilation = previousFetch; deps.applyCompilationState = previousApply;
      assert.equal(state.compileStatus, "success", state.compileLog);
      const rootBuild = records.at(-1);
      assert.ok(state.pdfUrl.endsWith(`compilationId=${rootBuild._id}`), "Metadata for another build cannot replace the just-compiled preview");
      assert.equal(rootBuild.compiledEntryFileId, A); assert.match(pdfText(rootBuild), /ROOT AFTER EDIT DISTINCTIVE/);
      assert.doesNotMatch(pdfText(rootBuild), /Technical Skills|ENTRY NESTED/);
      const delivered = async (compilationId, projectId = P) => {
        let sentPath, error; const headers = {};
        await controllers.getProjectPdf({ params: { projectId }, query: { compilationId } }, {
          setHeader: (key, value) => headers[key] = value, sendFile: value => sentPath = value,
        }, value => error = value);
        return { sentPath, error, headers };
      };
      const current = await delivered(rootBuild._id);
      assert.equal(current.sentPath, path.resolve(rootBuild.pdfPath)); assert.equal(current.error, undefined);
      assert.match(current.headers["Cache-Control"], /no-store/);
      // Requesting the prior compilation must not deliver the newer build at the same project URL.
      assert.equal((await delivered(nestedBuild._id)).sentPath, path.resolve(nestedBuild.pdfPath));
      assert.equal((await delivered(rootBuild._id, "ffffffffffffffffffffffff")).error?.statusCode, 404);
      assert.equal((await delivered("eeeeeeeeeeeeeeeeeeeeeeee")).error?.statusCode, 404);
      assert.equal((await delivered("invalid")).error?.statusCode, 400);
      for (const invalid of [{ status: "failed", pdfPath: rootBuild.pdfPath }, { status: "success", pdfPath: null },
        { status: "success", pdfPath: path.join(sandbox, "missing.pdf") }]) {
        const record = { ...rootBuild, ...invalid, _id: (records.length + 1).toString(16).padStart(24, "0") };
        records.push(record); assert.equal((await delivered(record._id)).error?.statusCode, 404);
      }
      console.log("Exact root-editor/nested-entry reproduction: edited root saved at revision 1 before compilation; configured nested entry PDF retains Technical Skills; explicit root-entry PDF removes it; delivery binds project and compilation ID.");
    } finally {
      scenarioManager?.deactivate(); deps.saveManagerRef.current = manager;
      files.splice(0, files.length, ...originalFiles); Object.assign(project, originalProject); folderRecords = [];
      Object.assign(state, { entryFileId: A, activeFileId: A, files: clientFiles(), isCompiling: false, pdfState: "none" });
    }
    state.files.forEach(f => manager.merge(f, P));
    // Shared compile guard: capture choices without changing editor selection.
    await hook("selectFile")(B);
    const choiceGate = deferred(); let choices = 0;
    deps.requestCompileTarget = async (openPath, entryPath) => {
      choices++; assert.equal(openPath, "b.tex"); assert.equal(entryPath, "a.tex");
      return choiceGate.promise;
    };
    const priorRequests = requests, priorVersion = project.sourceVersion;
    const choosing = hook("compileLatex")(); await tick();
    await hook("compileLatex")(); assert.equal(choices, 1); assert.equal(requests, priorRequests);
    choiceGate.resolve("cancel"); await choosing;
    assert.equal(requests, priorRequests); assert.equal(project.sourceVersion, priorVersion);
    assert.equal(project.entryFileId, A); assert.equal(deps.compileSubmissionRef.current, false);
    deps.requestCompileTarget = async () => "configured";
    await hook("compileLatex")(); assert.equal(records.at(-1).compiledEntryFileId, A);
    assert.equal(project.entryFileId, A); assert.match(pdfText(records.at(-1)), /Resume A ONLY/);
    deps.requestCompileTarget = async () => "open";
    const originalPersist = deps.setLatexProjectEntryFile;
    deps.setLatexProjectEntryFile = async () => { throw new Error("Entry persistence failed"); };
    const beforeFailure = requests; await hook("compileLatex")();
    assert.equal(requests, beforeFailure + 1); assert.equal(project.entryFileId, A);
    assert.equal(records.at(-1).compiledEntryFileId, B);
    const failedSave = new FileSaveManager(async () => { throw new Error("Choice save failed"); }, noop, 100000);
    failedSave.merge({ id: B, content: files[1].content, contentRevision: 0, contentLoaded: true }, P);
    failedSave.edit(B, "local unsaved choice content");
    deps.saveManagerRef.current = failedSave; deps.setLatexProjectEntryFile = originalPersist;
    await hook("compileLatex")(); assert.equal(requests, beforeFailure + 1);
    assert.equal(project.entryFileId, A); assert.equal(state.entryFileId, A);
    assert.match(state.compileLog, /Choice save failed/);
    assert.equal(failedSave.drafts()[0].content, "local unsaved choice content"); failedSave.deactivate();
    deps.saveManagerRef.current = manager; await hook("setEntryFile")(A);
    await hook("compileLatex")(); assert.equal(records.at(-1).compiledEntryFileId, B);
    assert.equal(project.entryFileId, A); assert.equal(state.entryFileId, A);
    assert.match(pdfText(records.at(-1)), /Resume B ORIGINAL/);
    deps.requestCompileTarget = async () => "configured";
    await hook("selectFile")(A);
    console.log("Compile choice regressions passed: selected/open/cancel, duplicate guard, no default persistence, save failure preserves buffer and blocks compile.");
    await hook("setEntryFile")(A); await hook("compileLatex")();
    assert.equal(state.compileStatus, "success", state.compileLog); assert.equal(records.at(-1).compiledEntryFileId, A);
    assert.match(pdfText(records.at(-1)), /Resume A ONLY/); assert.doesNotMatch(pdfText(records.at(-1)), /Resume B/);
    await hook("selectFile")(B); assert.equal(state.activeFileId, B); assert.equal(project.entryFileId, A); assert.equal(state.entryFileId, A);
    const previousSourceVersion = project.sourceVersion;
    await hook("setEntryFile")(B); assert.equal(project.entryFileId, B); assert.equal(state.entryFileId, B);
    assert.equal(project.sourceVersion, previousSourceVersion + 1, "Entry selection and source invalidation commit together");
    manager.edit(B, document("Resume B SAVED LATEST"));
    await hook("compileLatex")();
    assert.equal(state.compileStatus, "success", state.compileLog); assert.equal(files[1].contentRevision, 1);
    assert.equal(records.at(-1).compiledEntryFileId, B); assert.equal(records.at(-1).mainFile, "b.tex");
    assert.match(pdfText(records.at(-1)), /Resume B SAVED LATEST/); assert.doesNotMatch(pdfText(records.at(-1)), /Resume A|ORIGINAL/);
    assert.ok(state.pdfUrl.startsWith("/same-pdf-pipeline?compilationId="));
    deps.mergeProjectFiles = hook("mergeProjectFiles");
    await hook("loadProject")(P); assert.equal(state.entryFileId, B); // Actual metadata + restoration callback.
    await hook("selectFile")(A); assert.equal(state.entryFileId, B); assert.equal(project.entryFileId, B);
    const defaultBefore = project.entryFileId, versionBefore = project.sourceVersion;
    for (const target of [A, B]) {
      const result = (await callController(controllers.compileProject, { entryFileId: target })).data;
      assert.equal(result.entryFileId, target); assert.equal(result.entryFilePath, target === A ? "a.tex" : "b.tex");
      assert.equal(records.at(-1)._id, result.compilationId);
      assert.equal(records.at(-1).compiledEntryFileId, target);
      assert.ok(result.pdf.url.endsWith(`compilationId=${result.compilationId}`));
      assert.match(pdfText(records.at(-1)), target === A ? /Resume A ONLY/ : /Resume B SAVED LATEST/);
      assert.doesNotMatch(pdfText(records.at(-1)), target === A ? /Resume B/ : /Resume A/);
      assert.equal(project.entryFileId, defaultBefore); assert.equal(project.sourceVersion, versionBefore);
    }
    for (const invalid of ["bad-id", "", null, {}, "eeeeeeeeeeeeeeeeeeeeeeee"]) {
      const count = records.length;
      await assert.rejects(callController(controllers.compileProject, { entryFileId: invalid }), /Invalid entryFileId|missing or outside/);
      assert.equal(records.length, count); assert.equal(project.entryFileId, defaultBefore);
    }
    const existingDefault = project.entryFileId; project.entryFileId = null;
    assert.equal((await compiler.compileLatexProject({ projectId: P, entryFileId: A })).entryFileId, A);
    await assert.rejects(compiler.compileLatexProject({ projectId: P }), /No entry file configured/);
    project.entryFileId = existingDefault;
    // A server save after capture cannot change the captured workspace or provenance.
    const availability = compiler.checkCompilerAvailability, savedA = { ...files[0] }, savedVersion = project.sourceVersion;
    compiler.checkCompilerAvailability = async () => {
      files[0].content = document("SERVER CHANGED AFTER CAPTURE"); files[0].contentRevision++;
      project.sourceVersion++;
      return { available: true, compiler: "test" };
    };
    try {
      const capturedBuild = await compiler.compileLatexProject({ projectId: P, entryFileId: A });
      const record = records.at(-1), entryCapture = record.sourceCapture.files.find(file => file.fileId === A);
      assert.equal(entryCapture.contentRevision, savedA.contentRevision);
      assert.equal(entryCapture.sha256, require('node:crypto').createHash('sha256').update(savedA.content).digest('hex'));
      assert.equal(record.sourceVersion, savedVersion); assert.deepEqual(capturedBuild.sourceCapture, record.sourceCapture);
      assert.match(pdfText(record), /Resume A ONLY/); assert.doesNotMatch(pdfText(record), /SERVER CHANGED AFTER CAPTURE/);
      assert.equal((await compiler.getProjectCompilationState(P, A)).state, "stale");
    } finally { compiler.checkCompilerAvailability = availability; Object.assign(files[0], savedA); project.sourceVersion = savedVersion; }
    compiler.checkCompilerAvailability = async () => ({ available: false, compiler: "missing-test-compiler" });
    try {
      const failedBuild = await compiler.compileLatexProject({ projectId: P, entryFileId: A });
      assert.equal(failedBuild.status, "failed"); assert.equal(failedBuild.sourceCapture.entryFileId, A);
      assert.equal(records.at(-1).sourceCapture.hash, failedBuild.sourceCapture.hash);
    } finally { compiler.checkCompilerAvailability = availability; }
    const originalParent = files[1].folderId; files[1].folderId = "missing-parent";
    await assert.rejects(compiler.compileLatexProject({ projectId: P, entryFileId: B }), /Parent folder/);
    files[1].folderId = originalParent;
    files.push({ ...files[0], _id: "ffffffffffffffffffffffff" });
    await assert.rejects(compiler.compileLatexProject({ projectId: P, entryFileId: B }), /Shared path collision/);
    files.pop();
    const originalFileProject = files[1].projectId; files[1].projectId = "ffffffffffffffffffffffff";
    await assert.rejects(compiler.compileLatexProject({ projectId: P, entryFileId: B }), /outside this project/);
    files[1].projectId = originalFileProject;
    assert.equal((await resolveEntryFile(project, files))._id, B);
    for (const invalid of ["bad-id", "eeeeeeeeeeeeeeeeeeeeeeee", null, {}]) {
      await assert.rejects(callController(controllers.setProjectEntryFile, { entryFileId: invalid }), /required|not found/);
      assert.equal(project.entryFileId, B);
    }
    files[1].name = "B.TEX"; files[1].path = "nested/B.TEX"; files[1].folderId = "nested";
    files[1].content = document("Nested resume B \\input{nested/part}");
    folderRecords = [{ _id: "nested", projectId: P, name: "nested", path: "nested", parentFolderId: null }];
    files.push({ _id: "dddddddddddddddddddddddd", projectId: P, name: "part.tex", folderId: "nested", path: "nested/part.tex", content: "Dependency FOUND", contentRevision: 0 });
    await hook("setEntryFile")(B); await hook("compileLatex")();
    assert.equal(state.compileStatus, "success", state.compileLog); assert.equal(records.at(-1).mainFile, "nested/B.TEX");
    assert.match(pdfText(records.at(-1)), /Nested resume B/);
    if (process.env.RESUME_ENTRY_LIVE) assert.match(pdfText(records.at(-1)), /Dependency FOUND/);
    const removed = files.splice(1, 1)[0];
    await assert.rejects(compiler.compileLatexProject({ projectId: P, entryFileId: B }), /Requested entry file is missing/);
    await assert.rejects(compiler.compileLatexProject({ projectId: P }), /Configured entry file is missing/);
    files.splice(1, 0, removed);
    for (const fault of ["missing", "outside", "extension", "traversal", "none", "legacy"]) {
      const saved = { ...project }, old = { ...files[1] };
      if (fault === "missing") project.entryFileId = "eeeeeeeeeeeeeeeeeeeeeeee";
      if (fault === "outside") files[1].projectId = "ffffffffffffffffffffffff";
      if (fault === "extension") files[1].path = "nested/b.txt";
      if (fault === "traversal") files[1].path = "../b.tex";
      if (["none", "legacy"].includes(fault)) { project.entryFileId = null; project.entryFileSelectionRequired = false; files[0].path = "main.tex"; }
      const count = records.length;
      await assert.rejects(compiler.compileLatexProject({ projectId: P }), /entry file|Entry file/);
      assert.equal(records.length, count, "Must stop before invoking the compiler or creating an artifact");
      Object.assign(project, saved); Object.assign(files[1], old); files[0].path = "a.tex";
    }
    const projectRead = LatexProject.findById; let reads = 0;
    stub(LatexProject, "findById", async () => ({ ...project, entryFileId: ++reads === 1 ? B : A }));
    await assert.rejects(compiler.compileLatexProject({ projectId: P }), /entry changed while preparing/);
    reads = 0;
    assert.equal((await compiler.compileLatexProject({ projectId: P, entryFileId: B })).entryFileId, B);
    LatexProject.findById = projectRead;
    for (const marker of ["treeOperation", "pendingWrite", "pendingDelete"]) {
      if (marker === "treeOperation") project[marker] = { id: "rename-recovery" }; else files[1][marker] = true;
      await assert.rejects(compiler.compileLatexProject({ projectId: P }), /recovery/);
      await assert.rejects(compiler.compileLatexProject({ projectId: P, entryFileId: A }), /recovery/);
      if (marker === "treeOperation") { await assert.rejects(hook("setEntryFile")(B), /tree changed|recovery/); delete project[marker]; } else delete files[1][marker];
    }
    // Actual compile hook is blocked on a pending save, then uses confirmed content.
    const gate = deferred(); let began = false;
    deps.saveManagerRef.current = new FileSaveManager(async (id, content, revision) => {
      began = true; await gate.promise; assert.equal(id, B); assert.equal(revision, 1); files[1].content = content; files[1].contentRevision = 2;
      return { content, contentRevision: 2 };
    }, noop, 100000);
    deps.saveManagerRef.current.merge({ id: B, content: "base", contentRevision: 1, contentLoaded: true }, P);
    deps.saveManagerRef.current.edit(B, document("Confirmed AFTER FLUSH"));
    const before = requests, compiling = hook("compileLatex")(); await tick(); assert.equal(began, true); assert.equal(requests, before);
    gate.resolve(); await compiling; assert.equal(requests, before + 1); assert.match(pdfText(records.at(-1)), /Confirmed AFTER FLUSH/);
    deps.saveManagerRef.current.deactivate();
    for (const message of ["save failed", "Resolve conflict", "write recovery pending"]) {
      const blocked = new FileSaveManager(async () => { throw new Error(message); }, noop, 100000);
      blocked.merge({ id: B, content: "base", contentRevision: 2, contentLoaded: true }, P); blocked.edit(B, "local retained");
      if (message === "Resolve conflict") blocked.merge({ id: B, content: "server retained", contentRevision: 3, contentLoaded: true }, P);
      deps.saveManagerRef.current = blocked;
      const count = requests; await hook("compileLatex")(); assert.equal(requests, count); assert.equal(state.compileStatus, "error");
      assert.equal(blocked.drafts()[0].content, "local retained"); blocked.deactivate();
    }
    deps.saveManagerRef.current = manager;
    // A late compile response must not replace B's selected target or preview.
    await hook("setEntryFile")(A); await hook("selectFile")(A);
    const compileGate = deferred(), originalCompileRequest = deps.compileLatexProject;
    deps.compileLatexProject = async (id, target) => { const result = await originalCompileRequest(id, target); await compileGate.promise; return result; };
    const pendingCompile = hook("compileLatex")(); await tick();
    const selectTarget = hook("selectCompileTarget"); await selectTarget(B);
    const selectedPdf = state.pdfUrl; compileGate.resolve(); await pendingCompile;
    assert.equal(deps.compileTargetRef.current, B); assert.equal(state.pdfUrl, selectedPdf);
    deps.compileLatexProject = originalCompileRequest;
    await hook("setEntryFile")(A);
    const refreshGate = deferred(), refreshEntered = deferred(), originalRefresh = deps.fetchLatestCompilation;
    deps.fetchLatestCompilation = async (id, target) => {
      if (target === A) { refreshEntered.resolve(); return refreshGate.promise; }
      return null;
    };
    const refreshingCompile = hook("compileLatex")(); await refreshEntered.promise;
    await hook("selectCompileTarget")(B); const bPreview = state.pdfUrl;
    refreshGate.resolve({ pdf: { url: "wrong-A.pdf" } }); await refreshingCompile;
    assert.equal(deps.compileTargetRef.current, B); assert.equal(state.pdfUrl, bPreview);
    deps.fetchLatestCompilation = originalRefresh;
    deps.entrySelectionPendingRef.current = true;
    const count = requests; await hook("compileLatex")(); assert.equal(requests, count); assert.match(state.compileLog, /selection is still saving/);
    deps.entrySelectionPendingRef.current = false;
    state.entryFileId = null; deps.compileTargetRef.current = null; await hook("compileLatex")(); assert.equal(requests, count); assert.match(state.compileLog, /Select a .tex/);
    let uploadRequest;
    const upload = uploadCallback({ mongoose, LatexProject, LatexFile, AppError,
      mutateTree: async (id, request) => { assert.equal(id, P); uploadRequest = request; return B; } });
    await callController(upload, { projectId: P }, { file: { originalname: "b.tex", buffer: Buffer.from(document("upload")) } });
    assert.equal(uploadRequest.selectEntry, false); assert.equal(project.entryFileId, A);
    project.entryFileId = null;
    await callController(upload, { projectId: P }, { file: { originalname: "b.tex", buffer: Buffer.from(document("upload")) } });
    assert.equal(uploadRequest.selectEntry, false); assert.equal(project.entryFileId, null);
    console.log(`Entry compilation regressions passed (${process.env.RESUME_ENTRY_LIVE ? "real MiKTeX PDFs + pdftotext" : "compiler process fixture"}; mocked MongoDB/hook state): explicit A/B without default/sourceVersion mutation, resolved response identity, saved content, reopen, nested dependency, invalid/deleted/cross-project entries, tree parent/collision checks, legacy default race, save/conflict/recovery barriers.`);
    if (process.env.RESUME_ENTRY_BROWSER || process.env.RESUME_ENTRY_DELIVERY) {
      assert.ok(process.env.RESUME_ENTRY_LIVE, "Browser verification requires real PDF artifacts");
      await require("./verify-entry-browser.js")(records, controllers.getProjectPdf, sandbox);
    }
  } finally {
    manager.deactivate(); deps.saveManagerRef.current.deactivate();
    for (const [object, key, original] of replacements.reverse()) object[key] = original;
    assert.equal(path.dirname(sandbox), os.tmpdir());
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
