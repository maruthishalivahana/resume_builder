const assert = require("node:assert/strict");
require("tsx/cjs");
const { planTreeChange, mutateTree, recoverTree, assertTreeReady } = require("./src/services/latexTree.service.ts");
const { LatexProject } = require("./src/models/LatexProject.ts");
const { LatexFile } = require("./src/models/LatexFile.ts");
const { LatexFolder } = require("./src/models/LatexFolder.ts");
const { LatexCompilerService } = require("./src/services/latexCompiler.service.ts");
const { getProjectFiles } = require("./src/controllers/latex.controller.ts");
const projectId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const folder = (id, name, parentId = null, path = name) => ({ id, type: "folder", projectId, name, path, parentId });
const file = (id, name, parentId = null, path = name) => ({ id, type: "file", projectId, name, path, parentId, contentRevision: 7 });
const request = (id, name, type = "folder") => ({ kind: "rename", type, id, name });

function plannerTests() {
  for (const name of ["a.b", "(", "a+", "$&"]) {
    const nodes = [folder("root", name), folder("child", "sub", "root", `${name}/sub`), file("f", "a.tex", "child", `${name}/sub/a.tex`),
      folder("other", "axb"), file("unrelated", "a.tex", "other", "axb/a.tex")];
    const original = structuredClone(nodes);
    const changes = planTreeChange(nodes, projectId, request("root", "new$&(+).".slice(0, -1)));
    assert.deepEqual(changes.map(c => c.id), ["root", "child", "f"]);
    assert.equal(changes[2].after.path, "new$&(+)/sub/a.tex"); assert.deepEqual(nodes, original);
    const changedName = planTreeChange(nodes, projectId, request("f", "literal$&(+).tex", "file"));
    assert.equal(changedName[0].after.path, `${name}/sub/literal$&(+).tex`);
  }
  const base = [folder("root", "a"), file("f", "a.tex", "root", "a/a.tex")];
  assert.throws(() => planTreeChange([...base, folder("other", "B")], projectId, request("root", "b")), /collision/);
  assert.throws(() => planTreeChange([...base, file("other", "b.tex")], projectId, request("root", "B.tex")), /collision/);
  assert.throws(() => planTreeChange([file("f", "a.tex"), folder("other", "B.tex")], projectId, request("f", "b.tex", "file")), /collision/);
  assert.throws(() => planTreeChange([file("f", "a.tex", "missing", "missing/a.tex")], projectId, request("f", "b.tex", "file")), /Parent folder/);
  assert.throws(() => planTreeChange([folder("root", "a", "missing", "missing/a")], projectId, request("root", "b")), /Parent folder/);
  assert.throws(() => planTreeChange([{ ...folder("foreign", "foreign"), projectId: "other" }, file("f", "a.tex", "foreign", "foreign/a.tex")], projectId,
    request("f", "b.tex", "file")), /Cross-project/);
  // Legacy destination descendant without a consistent parent must be rejected before any write.
  assert.throws(() => planTreeChange([...base, file("legacy", "a.tex", null, "b/a.tex")], projectId, request("root", "b")), /Path disagrees/);
  assert.throws(() => planTreeChange([...base, file("duplicate", "A.tex", "root", "a/A.tex")], projectId, request("root", "b")), /collision/);
  assert.deepEqual(planTreeChange(base, projectId, request("root", "A")).map(c => c.after.path), ["A", "A/a.tex"]);
  assert.throws(() => planTreeChange(base, projectId, { kind: "create", type: "file", name: "b.tex", parentId: "foreign" }), /Parent folder/);
  assert.throws(() => planTreeChange(base, projectId, { kind: "create", type: "file", name: "b.tex", parentId: "" }), /Invalid parent/);
}

function matches(doc, filter) {
  if (!doc) return false;
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some(branch => matches(doc, branch));
    const actual = key.split(".").reduce((v, part) => v?.[part], doc);
    if (value && typeof value === "object") {
      if ("$exists" in value) return (actual !== undefined) === value.$exists;
      if ("$lt" in value) return actual !== undefined && actual < value.$lt;
      if ("$ne" in value) return actual !== value.$ne;
    }
    return actual == null && value == null || String(actual) === String(value);
  });
}
function apply(doc, update) {
  Object.assign(doc, structuredClone(update.$set));
  for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
  for (const [key, amount] of Object.entries(update.$inc ?? {})) doc[key] = (doc[key] ?? 0) + amount;
}

async function snapshotTests() {
  const original = [LatexProject.findById, LatexFile.find, LatexFolder.find];
  try {
    let reads = 0;
    LatexProject.findById = async () => ({ treeVersion: ++reads === 1 ? 1 : 2 });
    LatexFile.find = LatexFolder.find = () => ({ sort: async () => [] });
    let response = false, error;
    await getProjectFiles({ params: { projectId } }, { status() { response = true; return this; }, json() {} }, value => { error = value; });
    assert.equal(error.code, "TREE_CHANGED"); assert.equal(response, false, "mixed snapshots cannot be returned successfully");
  } finally { [LatexProject.findById, LatexFile.find, LatexFolder.find] = original; }
}

async function journalTests() {
  const originals = [];
  const stub = (object, name, implementation) => { originals.push([object, name, object[name]]); object[name] = implementation; };
  let project, files, folders, writes, failAt, failFinalize, failPrepare, injectEdit;
  const reset = () => {
    project = { _id: projectId, treeVersion: 0, sourceVersion: 10, entryFileId: "f" };
    folders = [{ _id: "root", projectId, name: "a.b", path: "a.b", parentFolderId: null },
      { _id: "sub", projectId, name: "sub", path: "a.b/sub", parentFolderId: "root" },
      { _id: "other", projectId, name: "axb", path: "axb", parentFolderId: null }];
    files = [{ _id: "f", projectId, folderId: "sub", name: "a.tex", path: "a.b/sub/a.tex", content: "unchanged", contentRevision: 7 },
      { _id: "other-file", projectId, folderId: "other", name: "a.tex", path: "axb/a.tex", content: "unrelated", contentRevision: 2 }];
    writes = 0; failAt = Infinity; failFinalize = false; failPrepare = false; injectEdit = false;
  };
  reset();
  try {
    stub(LatexProject, "findById", async () => structuredClone(project));
    stub(LatexProject, "findOneAndUpdate", async (filter, update) => {
      if (!matches(project, filter)) return null; apply(project, update); return structuredClone(project);
    });
    stub(LatexProject, "updateOne", async (filter, update) => {
      if (!matches(project, filter)) return { matchedCount: 0 };
      if (failPrepare && update.$set?.treeOperation?.changes) throw new Error("interrupted manifest persistence");
      if (failFinalize && update.$inc?.sourceVersion) throw new Error("interrupted finalization");
      apply(project, update); return { matchedCount: 1 };
    });
    for (const [model, collection] of [[LatexFile, () => files], [LatexFolder, () => folders]]) {
      stub(model, "find", async filter => collection().filter(doc => matches(doc, filter)).map(doc => structuredClone(doc)));
      stub(model, "findById", async id => structuredClone(collection().find(doc => doc._id === id) ?? null));
      stub(model, "updateOne", async (filter, update, options) => {
        if (injectEdit && model === LatexFile) { files[0].content = "concurrent autosave"; files[0].contentRevision = 8; injectEdit = false; }
        if (++writes === failAt) throw new Error("interrupted node write");
        let doc = collection().find(doc => matches(doc, filter));
        if (!doc && options?.upsert) { doc = structuredClone(update.$setOnInsert); collection().push(doc); }
        if (!doc) return { matchedCount: 0 };
        apply(doc, update); return { matchedCount: 1 };
      });
    }
    const rename = request("root", "new$&(+)");
    for (const interruption of ["prepare", "node", "finalize"]) {
      reset(); failPrepare = interruption === "prepare"; failAt = interruption === "node" ? 3 : Infinity; failFinalize = interruption === "finalize";
      await assert.rejects(mutateTree(projectId, rename));
      assert.ok(project.treeOperation, "durable intent remains after interruption");
      assert.equal(project.entryFileId, "f"); assert.equal(files[0].content, "unchanged"); assert.equal(files[0].contentRevision, 7);
      await assert.rejects(assertTreeReady(projectId), /recovery/);
      await assert.rejects(LatexCompilerService.compileLatexProject({ projectId }), /tree recovery/);
      await assert.rejects(mutateTree(projectId, { kind: "create", type: "file", name: "collision.tex" }), /recovery/);
      failPrepare = failFinalize = false; failAt = Infinity;
      await recoverTree(projectId);
      assert.equal(project.treeOperation, undefined); assert.equal(project.sourceVersion, 11);
      assert.deepEqual(folders.map(f => f.path), ["new$&(+)", "new$&(+)/sub", "axb"]);
      assert.equal(files[0].path, "new$&(+)/sub/a.tex"); assert.equal(files[0].contentRevision, 7); assert.equal(files[0].content, "unchanged");
      assert.equal(files[1].path, "axb/a.tex"); assert.equal(files[1].content, "unrelated"); assert.equal(project.entryFileId, "f");
      await recoverTree(projectId); assert.equal(project.sourceVersion, 11, "completed recovery is a no-op");
    }
    reset(); injectEdit = true; await mutateTree(projectId, rename);
    assert.equal(files[0].content, "concurrent autosave"); assert.equal(files[0].contentRevision, 8); assert.equal(files[0].path, "new$&(+)/sub/a.tex");
    reset(); folders.push({ _id: "collision", projectId, name: "new", path: "new", parentFolderId: null });
    await assert.rejects(mutateTree(projectId, request("root", "NEW")), /collision/);
    assert.equal(writes, 0); assert.equal(project.treeOperation, undefined); assert.equal(project.treeVersion, 0, "preflight collision does not modify project metadata"); assert.equal(project.sourceVersion, 10); assert.equal(folders[0].path, "a.b");
    reset(); files.push({ _id: "collision", projectId, folderId: null, name: "NEW.tex", path: "NEW.tex" });
    await assert.rejects(mutateTree(projectId, { kind: "create", type: "folder", name: "new.tex" }), /collision/); assert.equal(writes, 0);
    reset(); failAt = 2; await assert.rejects(mutateTree(projectId, rename)); failAt = Infinity;
    const previousOwner = structuredClone(project.treeOperation.owner);
    project.treeOperation.owner.instance = "another-live-worker";
    const before = writes;
    await assert.rejects(recoverTree(projectId), /recovery/); assert.equal(writes, before, "cannot take over a living worker");
    project.treeOperation.owner = previousOwner;
    await recoverTree(projectId);
    reset(); failAt = 2; await assert.rejects(mutateTree(projectId, rename)); failAt = Infinity;
    project.treeOperation.owner = { host: require("os").hostname(), pid: 99999999, instance: "dead-worker" };
    stub(process, "kill", () => { throw Object.assign(new Error("dead"), { code: "ESRCH" }); });
    await recoverTree(projectId); assert.equal(project.treeOperation, undefined); assert.equal(files[0].path, "new$&(+)/sub/a.tex");
    reset(); failAt = 2; await assert.rejects(mutateTree(projectId, rename)); failAt = Infinity;
    folders[0].path = "later"; folders[0].name = "later"; folders[0].treeVersion = 99;
    await assert.rejects(recoverTree(projectId), /recovery/); assert.equal(folders[0].path, "later", "old replay cannot overwrite newer tree version");
  } finally { for (const [object, name, original] of originals.reverse()) object[name] = original; }
}

(async () => { plannerTests(); await journalTests(); await snapshotTests(); console.log("Tree rename regressions passed: literal paths, full preflight, shared/case namespace, parent integrity, durable interruptions, fencing, snapshot guard, content/revision/entry preservation (mocked MongoDB)."); })().catch(error => { console.error(error); process.exitCode = 1; });
