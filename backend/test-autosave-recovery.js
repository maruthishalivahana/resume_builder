const assert = require("node:assert/strict");
require("tsx/cjs");
const { FileSaveManager, afterSaved } = require("../lib/file-save-manager.ts");
const { readDrafts, writeDrafts } = require("../lib/save-drafts.ts");
const { LatexFile } = require("./src/models/LatexFile.ts");
const { LatexProject } = require("./src/models/LatexProject.ts");
const { LatexFolder } = require("./src/models/LatexFolder.ts");
const { updateLatexFile, deleteFile: deleteController } = require("./src/controllers/latex.controller.ts");
const { LatexCompilerService } = require("./src/services/latexCompiler.service.ts");
const { SourcePatchService } = require("./src/modules/job-tailoring/services/source-patch.service.ts");
const { finalizeFileWrite } = require("./src/services/latexWriteRecovery.service.ts");
const { hashSourceText } = require("./src/modules/job-tailoring/utils/source-hash.util.ts");
const Suggestion = require("./src/modules/job-tailoring/models/TailoringSuggestion.ts").default;
const Evidence = require("./src/modules/job-tailoring/models/ResumeEvidence.ts").default;
const remote = (id, content, revision = 0) => ({ id, content, contentRevision: revision, contentLoaded: true });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

// Execute the actual hook callback with injected dependencies, without mounting React.
function hookCallback(name, dependencies) {
  const ts = require("typescript");
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../hooks/use-resume.tsx"), "utf8");
  const ast = ts.createSourceFile("use-resume.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) callback = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(callback, `Missing actual hook callback ${name}`);
  const code = ts.transpileModule(`const callback = ${callback};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(dependencies), code + "\nreturn callback;")(...Object.values(dependencies));
}

async function remainingGapTests() {
  // Exact previous loss: unopened draft + unloaded tree item + Save-and-delete.
  for (const scenario of ["success", "save failure", "newer server", "read failure"]) {
    let saves = 0, deletions = 0;
    let server = { content: scenario === "newer server" ? "newer server" : "base", contentRevision: scenario === "newer server" ? 1 : 0 };
    let fail = scenario === "save failure";
    const m = new FileSaveManager(async (id, content, revision) => {
      saves++; assert.equal(id, "A"); assert.equal(content, "recovered draft"); assert.equal(revision, server.contentRevision);
      if (fail) throw new Error("save failure");
      server = { content, contentRevision: revision + 1 }; return server;
    }, () => {}, 1000, async () => { if (scenario === "read failure") throw new Error("read failure"); return server; });
    m.restore([{ id: "A", projectId: "P", content: "recovered draft", revision: 0, baseContent: "base", savedAt: 1 }]);
    m.merge({ id: "A", content: "", contentRevision: 0, contentLoaded: false }, "P");
    const remove = async revision => { assert.equal(server.content, "recovered draft"); assert.equal(revision, server.contentRevision); deletions++; };
    await assert.rejects(m.delete("A", undefined, remove), /Choose/);
    if (scenario === "success") {
      await m.delete("A", "save", remove);
      assert.equal(saves, 1); assert.equal(deletions, 1); assert.equal(server.contentRevision, 1); assert.equal(m.drafts().length, 0);
    } else {
      await assert.rejects(m.delete("A", "save", remove));
      assert.equal(deletions, 0, "zero saves must never lead to deleting a recovered draft");
      assert.equal(m.drafts().length, 1); assert.equal(m.drafts()[0].content, "recovered draft");
      await assert.rejects(m.flush("P"));
      if (scenario !== "read failure") {
        fail = false;
        if (scenario === "newer server") {
          assert.deepEqual(m.conflicts("P")[0], { id: "A", local: "recovered draft", server: "newer server", revision: 1 });
          assert.equal(saves, 0);
          await m.resolve("A", 1, "recovered draft");
        }
        await m.delete("A", "save", remove);
        assert.equal(deletions, 1); assert.equal(server.content, "recovered draft"); assert.equal(m.drafts().length, 0);
      }
    }
    m.deactivate();
  }

  for (const scenario of ["clean", "new local edits", "read failure"]) {
    let server = { content: "base", contentRevision: 0 }, attempts = 0, failRead = scenario === "read failure";
    const m = new FileSaveManager(async () => { throw new Error("must not overwrite or replay"); }, () => {}, 1000,
      async () => { if (failRead) throw new Error("read unavailable"); return server; });
    m.merge(remote("A", "base"), "P");
    let suggestions = [{ id: "server-suggestion", status: "pending" }], resumeUpdates = 0, pdfInvalidations = 0;
    const callback = hookCallback("acceptAISuggestion", {
      aiSuggestions: suggestions, projectId: "P", currentVersionId: "V", projectIdRef: { current: "P" }, saveManagerRef: { current: m }, files: [{ id: "A" }],
      acceptTailoringSuggestion: async () => {
        attempts++; server = { content: "AI committed", contentRevision: 1 };
        if (scenario === "new local edits") m.edit("A", "new local edits");
        throw new Error("committed acknowledgment lost");
      },
      applyAcceptedSuggestion: () => assert.fail("No acknowledgment available"),
      fetchTailoringSuggestions: async () => [{ suggestionId: "server-suggestion", status: "accepted" }],
      setSuggestionFeedback: () => {}, setResume: () => resumeUpdates++,
      markPdfSourceChanged: () => pdfInvalidations++,
      setAiSuggestions: update => suggestions = update(suggestions), setActiveSuggestion: () => {},
    });
    await callback("server-suggestion"); assert.equal(attempts, 1); assert.equal(resumeUpdates, 0);
    if (scenario === "clean") {
      assert.equal(m.view({ id: "A" }).content, "AI committed"); assert.equal(m.view({ id: "A" }).contentRevision, 1);
      assert.equal(suggestions[0].status, "accepted"); assert.equal(m.status("P"), "saved");
      assert.equal(pdfInvalidations, 1);
    } else {
      await assert.rejects(m.flush("P"), /Resolve/);
      assert.equal(m.hasPending(), true);
      if (scenario === "new local edits") {
        assert.deepEqual(m.conflicts("P")[0], { id: "A", local: "new local edits", server: "AI committed", revision: 1 });
        assert.equal(suggestions[0].status, "accepted");
      } else {
        assert.equal(suggestions[0].status, "pending"); failRead = false; await m.refresh("A");
        assert.equal(m.view({ id: "A" }).content, "AI committed"); assert.equal(m.view({ id: "A" }).contentRevision, 1);
      }
    }
    m.deactivate();
  }

  // Actual deletion callback must not clear B's entry after A's delayed delete.
  const gate = deferred(), identity = { current: "P" };
  const m = new FileSaveManager(async () => ({ contentRevision: 1 })); m.merge(remote("A", "base"), "P");
  let entry = "A", active = "A", files = [{ id: "A", content: "base" }], pdfUpdates = 0, deletes = 0;
  const callback = hookCallback("deleteFile", {
    projectIdRef: identity, entryFileId: "A", activeFileId: "A", saveManagerRef: { current: m },
    setFileOperationBusy: () => {}, deleteLatexFile: async (id, revision) => { assert.equal(id, "A"); assert.equal(revision, 0); await gate.promise; deletes++; },
    markPdfSourceChanged: () => pdfUpdates++, setEntryFileId: update => entry = typeof update === "function" ? update(entry) : update,
    setFiles: update => files = update(files), setActiveFileId: value => active = value, setLatexCode: () => {},
  });
  const deleting = callback("A", "save");
  await new Promise(resolve => setImmediate(resolve));
  identity.current = "Q"; entry = "B-entry"; active = "B-active"; files = [{ id: "B-entry", content: "B content" }];
  gate.resolve(); await deleting;
  assert.equal(deletes, 1); assert.equal(entry, "B-entry"); assert.equal(active, "B-active"); assert.deepEqual(files, [{ id: "B-entry", content: "B content" }]); assert.equal(pdfUpdates, 0);
  m.deactivate();
}

async function managerTests() {
  // Server commits autosave, then AI; AI acknowledgment arrives first.
  const gate = deferred(); let server = { content: "AI", contentRevision: 2 }, requests = 0;
  const manager = new FileSaveManager(async (id, content, revision) => {
    requests++;
    if (requests === 1) { await gate.promise; return { contentRevision: 1 }; }
    assert.equal(revision, server.contentRevision); server = { content, contentRevision: revision + 1 }; return server;
  }, () => {}, 1000, async () => server);
  manager.merge(remote("A", "base"), "P"); manager.edit("A", "local");
  const oldSave = manager.save("A");
  manager.merge(remote("A", "AI", 2), "P");
  gate.resolve(); await assert.rejects(oldSave, /newer server write/);
  assert.deepEqual(manager.conflicts("P")[0], { id: "A", local: "local", server: "AI", revision: 2 });
  await assert.rejects(manager.flush("P"), /Resolve/);
  await assert.rejects(manager.flush("P"), /Resolve/);
  assert.equal(requests, 1, "ordinary retry must not resend stale revisions");
  let compiled = 0;
  await assert.rejects(afterSaved(manager, "P", async () => compiled++), /Resolve/);
  server = { content: "another edit", contentRevision: 3 };
  await assert.rejects(manager.resolve("A", 2, "reconciled"), /Server changed again/);
  assert.equal(manager.conflicts("P")[0].local, "local");
  await manager.resolve("A", 3, "reconciled");
  await afterSaved(manager, "P", async () => compiled++);
  assert.equal(compiled, 1); assert.equal(server.content, "reconciled"); assert.equal(server.contentRevision, 4);
  const refreshGate = deferred();
  const resolving = new FileSaveManager(async () => ({ contentRevision: 2 }), () => {}, 1000, async () => { await refreshGate.promise; return { content: "remote", contentRevision: 1 }; });
  resolving.merge(remote("R", "base"), "P"); resolving.edit("R", "local"); resolving.merge(remote("R", "remote", 1), "P");
  const choosing = resolving.resolve("R", 1, "chosen"); resolving.edit("R", "newer local"); refreshGate.resolve();
  await assert.rejects(choosing, /Local edits changed/);
  assert.equal(resolving.conflicts("P")[0].local, "newer local"); resolving.deactivate();

  // Lost response after commit is reconciled by authoritative GET, preserving later typing.
  let committed = { content: "base", contentRevision: 0 };
  const lost = new FileSaveManager(async (id, content, revision) => {
    committed = { content, contentRevision: revision + 1 }; throw new Error("lost acknowledgment");
  }, () => {}, 1000, async () => committed);
  lost.merge(remote("L", "base"), "P"); lost.edit("L", "committed");
  await lost.flush("P"); assert.equal(lost.status("P"), "saved");
  // Display refreshes must not turn local intent into a fabricated server snapshot.
  lost.edit("L", "next local");
  assert.equal(lost.view(remote("L", "stale", 0)).content, "next local");
  assert.equal(lost.drafts()[0].baseContent, "committed");
  lost.deactivate();
  let metadataPending = true, pendingRequests = 0;
  const committedPending = new FileSaveManager(async () => { pendingRequests++; throw new Error("lost acknowledgment"); }, () => {}, 1000,
    async () => ({ content: "intent", contentRevision: 1, recoveryPending: metadataPending }));
  committedPending.merge(remote("M", "base"), "P"); committedPending.edit("M", "intent");
  await assert.rejects(committedPending.flush("P"), /metadata recovery/);
  assert.equal(committedPending.conflicts("P").length, 0);
  assert.equal(committedPending.view(remote("M", "base")).contentRevision, 1);
  metadataPending = false; await committedPending.flush("P");
  assert.equal(pendingRequests, 1); assert.equal(committedPending.status("P"), "saved");

  for (const scenario of ["success", "failure", "conflict"]) {
    let deleted = 0;
    const m = new FileSaveManager(async () => {
      if (scenario !== "success") throw Object.assign(new Error(scenario), { status: scenario === "conflict" ? 409 : 503 });
      return { contentRevision: 1 };
    }, () => {}, 1000, async () => ({ content: scenario === "conflict" ? "other" : "base", contentRevision: scenario === "conflict" ? 1 : 0 }));
    m.merge(remote("D", "base"), "P"); m.edit("D", "keep me");
    await assert.rejects(m.delete("D", undefined, async () => deleted++), /Choose/);
    if (scenario === "success") {
      await m.delete("D", "save", async () => deleted++); assert.equal(m.hasPending(), false);
    } else {
      await assert.rejects(m.delete("D", "save", async () => deleted++));
      assert.equal(deleted, 0); assert.equal(m.drafts()[0].content, "keep me");
      await assert.rejects(m.delete("D", "discard", async () => { throw new Error("delete failed"); }), /delete failed/);
      assert.equal(m.drafts()[0].content, "keep me");
      await m.delete("D", "discard", async () => deleted++);
      await m.flush("P"); assert.equal(m.hasPending(), false);
    }
    assert.equal(deleted, 1);
    m.deactivate();
  }
}

async function draftTests() {
  const storage = new Map();
  const adapter = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  let requests = [];
  const before = new FileSaveManager(async (id, content, revision) => { requests.push({ id, content, revision }); return { contentRevision: revision + 1 }; });
  before.merge(remote("A", "base"), "P"); before.edit("A", "draft");
  writeDrafts(adapter, before.drafts()); before.deactivate();
  const unchanged = new FileSaveManager(async () => ({ contentRevision: 1 }));
  unchanged.restore(readDrafts(adapter)); unchanged.merge(remote("A", "base"), "P");
  await assert.rejects(unchanged.flush("P"), /Resolve/);
  assert.equal(unchanged.conflicts("P")[0].local, "draft");
  const recovered = new FileSaveManager(async (id, content, revision) => { requests.push({ id, content, revision }); return { contentRevision: revision + 1 }; }, () => {}, 1000, async () => ({ content: "remote", contentRevision: 1 }));
  recovered.restore(readDrafts(adapter));
  await assert.rejects(recovered.flush("P"), /Recovered drafts/);
  recovered.merge(remote("A", "remote", 1), "P");
  assert.equal(recovered.conflicts("P")[0].local, "draft");
  await assert.rejects(recovered.flush("P"), /Resolve/);
  await recovered.resolve("A", 1, "draft");
  assert.deepEqual(requests, [{ id: "A", content: "draft", revision: 1 }]);
  writeDrafts(adapter, recovered.drafts()); assert.deepEqual(readDrafts(adapter), []);
  assert.throws(() => writeDrafts(adapter, [{ content: "x".repeat(2 * 1024 * 1024) }]), /limit/);
  // Flushing B cannot cancel or flush A; each pending request retains its owner.
  const gate = deferred();
  const switching = new FileSaveManager(async (id, content, revision) => { if (id === "A") await gate.promise; return { contentRevision: revision + 1 }; });
  switching.merge(remote("A", "base"), "P"); switching.merge(remote("B", "base"), "Q");
  switching.edit("A", "project P"); const savingA = switching.save("A");
  switching.edit("B", "project Q"); await switching.flush("Q");
  assert.equal(switching.isDirty("A", "P"), true);
  gate.resolve(); await savingA; assert.equal(switching.status("P"), "saved");
  const patchGate = deferred(); let deletion = 0, compile = 0;
  const patch = switching.serverOperation("Q", async () => { await patchGate.promise; });
  const removing = switching.delete("B", "save", async revision => { assert.equal(revision, 1); deletion++; });
  const compiling = afterSaved(switching, "Q", async () => compile++);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(deletion, 0); assert.equal(compile, 0);
  patchGate.resolve(); await Promise.all([patch, removing, compiling]);
  assert.equal(deletion, 1); assert.equal(compile, 1);
}

async function backendTests() {
  const replacements = [];
  const stub = (target, key, value) => { replacements.push([target, key, target[key]]); target[key] = value; };
  let file = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", projectId: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "a.tex", path: "a.tex", content: "base", folderId: null };
  let failProject = true, failSuggestion = false, failPhysicalDelete = false, concurrentPatch = false, writes = 0;
  const projectId = file.projectId, fileId = file._id;
  const project = { _id: projectId, treeVersion: 0 };
  const suggestion = { suggestionId: "s", projectId: file.projectId, versionId: "v", validation: "PASS", status: "pending", sourcePatch: {
    fileId: file._id, fileName: "a.tex", evidenceId: "e", lineStart: 1, lineEnd: 1, before: "editor", after: "patched", beforeHash: hashSourceText("editor") } };
  try {
    stub(console, "error", () => {}); // Expected fault injections only.
    stub(LatexFile, "findById", async () => file ? ({ ...file }) : null);
    stub(LatexFile, "exists", async () => true);
    stub(LatexFile, "findOne", async () => ({ ...file }));
    stub(LatexFile, "findOneAndUpdate", async (filter, update) => {
      if (concurrentPatch && update.$inc) { concurrentPatch = false; file = { ...file, content: "concurrent", contentRevision: file.contentRevision + 1 }; }
      if (file.pendingWrite || (file.contentRevision ?? 0) !== (filter.$or ? 0 : filter.contentRevision)) return null;
      if (filter.content !== undefined && filter.content !== file.content) return null;
      if (update.$inc) writes++;
      file = { ...file, ...update.$set, contentRevision: (file.contentRevision ?? 0) + (update.$inc?.contentRevision ?? 0) };
      return { ...file };
    });
    stub(LatexFile, "updateOne", async filter => { assert.equal(filter.contentRevision, file.contentRevision); delete file.pendingWrite; return { matchedCount: 1 }; });
    stub(LatexProject, "findByIdAndUpdate", async () => { if (failProject) throw new Error("project update failed"); return {}; });
    stub(LatexProject, "findOneAndUpdate", async (filter, update) => {
      if (project.treeOperation) return null;
      Object.assign(project, update.$set); project.treeVersion++; return { ...project };
    });
    stub(LatexProject, "updateOne", async (filter, update) => {
      if (filter["treeOperation.id"] && filter["treeOperation.id"] !== project.treeOperation?.id) return { matchedCount: 0 };
      Object.assign(project, update.$set);
      if (update.$unset?.treeOperation) delete project.treeOperation;
      return { matchedCount: 1 };
    });
    stub(LatexProject, "findById", async () => ({ ...project }));
    stub(LatexProject, "findOne", async () => project.treeOperation?.request.kind === "delete" ? { ...project } : null);
    stub(LatexFile, "find", async () => [file]);
    stub(LatexFolder, "find", async () => []);
    stub(LatexFile, "findOneAndDelete", async () => { if (failPhysicalDelete) throw new Error("delete failed"); const deleted = file; file = null; return deleted; });
    stub(Suggestion, "findOne", () => ({ lean: async () => ({ ...suggestion }), select() { return this; } }));
    stub(Suggestion, "findOneAndUpdate", async (filter, update) => { if (failSuggestion) throw new Error("suggestion update failed"); Object.assign(suggestion, update.$set); return suggestion; });
    stub(Evidence, "findOne", () => ({ lean: async () => ({ source: { fileId: file._id, fileName: "a.tex" } }) }));
    stub(Evidence, "deleteOne", async () => ({}));
    let body, error;
    await updateLatexFile({ params: { fileId: file._id }, body: { content: "editor", expectedRevision: 0 } },
      { status() { return this; }, json(value) { body = value; } }, e => error = e);
    assert.equal(error, undefined); assert.equal(body.data.file.recoveryPending, true);
    assert.equal(body.data.file.contentRevision, 1); assert.equal(file.content, "editor"); assert.ok(file.pendingWrite);
    await assert.rejects(LatexCompilerService.compileLatexProject({ projectId }), /awaiting metadata recovery/);
    assert.equal(await finalizeFileWrite({ ...file }), false); // Marker survives repeated failure.
    let blocked;
    await updateLatexFile({ params: { fileId }, body: { content: "must not commit", expectedRevision: 1 } },
      { status() { return this; }, json() {} }, e => blocked = e);
    assert.equal(blocked.statusCode, 503); assert.equal(file.content, "editor"); assert.equal(file.contentRevision, 1);
    failProject = false;
    assert.equal(await finalizeFileWrite({ ...file }), true); assert.equal(file.pendingWrite, undefined);
    const service = new SourcePatchService(); failSuggestion = true;
    const pending = await service.apply({ suggestionId: "s", projectId: file.projectId, versionId: "v" });
    assert.equal(pending.recoveryPending, true); assert.equal(file.contentRevision, 2); assert.equal(file.content, "patched");
    assert.ok(file.pendingWrite); assert.equal(suggestion.status, "pending");
    failSuggestion = false;
    const recovered = await service.apply({ suggestionId: "s", projectId: file.projectId, versionId: "v" });
    assert.equal(recovered.recoveryPending, false); assert.equal(suggestion.status, "accepted");
    assert.equal(file.contentRevision, 2); assert.equal(writes, 2, "retry must not apply a second source patch");
    await service.apply({ suggestionId: "s", projectId: file.projectId, versionId: "v" });
    assert.equal(writes, 2);
    suggestion.suggestionId = "s2"; suggestion.status = "pending";
    suggestion.sourcePatch.before = "patched"; suggestion.sourcePatch.after = "new patch"; suggestion.sourcePatch.beforeHash = hashSourceText("patched");
    concurrentPatch = true;
    await assert.rejects(service.apply({ suggestionId: "s2", projectId, versionId: "v" }), /source changed/);
    assert.equal(file.content, "concurrent"); assert.equal(file.contentRevision, 3); assert.equal(writes, 2);
    const remove = async revision => {
      let status, error;
      await deleteController({ params: { fileId }, body: { expectedRevision: revision } },
        { status(code) { status = code; return this; }, json() {} }, e => error = e);
      return { status, error };
    };
    assert.equal((await remove(2)).error.statusCode, 409); assert.equal(file.pendingDelete, undefined);
    failProject = true;
    assert.equal((await remove(3)).error.statusCode, 503); assert.equal(file.pendingDelete, true);
    await assert.rejects(LatexCompilerService.compileLatexProject({ projectId }), /tree recovery/);
    failProject = false; failPhysicalDelete = true;
    assert.equal((await remove(3)).error.statusCode, 503); assert.ok(file);
    failPhysicalDelete = false;
    assert.equal((await remove(3)).status, 200); assert.equal(file, null);
    assert.equal((await remove(3)).status, 200, "lost deletion acknowledgments are idempotent");
  } finally { for (const [target, key, original] of replacements.reverse()) target[key] = original; }
}
(async () => { await managerTests(); await draftTests(); await remainingGapTests(); await backendTests(); console.log("Autosave recovery regressions passed (actual manager/hook callbacks; mocked persistence, storage, and MongoDB)."); })().catch(error => { console.error(error); process.exitCode = 1; });
