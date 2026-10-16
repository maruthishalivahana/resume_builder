// Explicitly opt in to a fresh, isolated localhost MongoDB; never loads .env.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
require("tsx/cjs");
const mongoose = require("mongoose");
const { LatexProject } = require("./src/models/LatexProject.ts");
const { LatexFile } = require("./src/models/LatexFile.ts");
const { LatexFolder } = require("./src/models/LatexFolder.ts");
const { mutateTree, recoverTree } = require("./src/services/latexTree.service.ts");
const { LatexCompilerService } = require("./src/services/latexCompiler.service.ts");
const uri = process.env.TREE_TEST_MONGODB_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27139\/resume_eng_tree_verification(?:[?].*)?$/.test(uri)) {
  throw new Error("Use the isolated test MongoDB on port 27139 with database resume_eng_tree_verification; configured application databases are refused.");
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  if (process.env.TREE_RENAME_CHILD === "1") {
    // Persist a real partial rename then exit, leaving a durable journal owned by this dead process.
    const update = LatexFolder.updateOne.bind(LatexFolder);
    let writes = 0;
    LatexFolder.updateOne = (...args) => {
      if (++writes === 2) throw new Error("simulated process interruption before descendant folder write");
      return update(...args);
    };
    await assert.rejects(mutateTree(process.env.TREE_TEST_PROJECT_ID, {
      kind: "rename", type: "folder", id: process.env.TREE_TEST_FOLDER_ID, name: "new$&(+)",
    }), error => error.code === "TREE_RECOVERY_PENDING");
    return;
  }
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.equal(hello.setName, undefined, "exercise standalone recovery, not transactions");
  const project = await LatexProject.create({ name: "isolated tree verification" });
  const projectId = project._id.toString();
  const root = await LatexFolder.create({ projectId, name: "a.b", path: "a.b" });
  const sub = await LatexFolder.create({ projectId, name: "sub", path: "a.b/sub", parentFolderId: root._id });
  const file = await LatexFile.create({ projectId, folderId: sub._id, name: "a.tex", path: "a.b/sub/a.tex", content: "confirmed source", contentRevision: 7 });
  const other = await LatexFolder.create({ projectId, name: "axb", path: "axb" });
  await LatexProject.updateOne({ _id: projectId }, { $set: { entryFileId: file._id } });
  const child = spawnSync(process.execPath, [__filename], { encoding: "utf8", env: {
    ...process.env, TREE_RENAME_CHILD: "1", TREE_TEST_PROJECT_ID: projectId, TREE_TEST_FOLDER_ID: root._id.toString(),
  } });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  let pending = await LatexProject.findById(projectId);
  assert.ok(pending.treeOperation?.changes.length);
  assert.equal((await LatexFolder.findById(root._id)).path, "new$&(+)");
  assert.equal((await LatexFolder.findById(sub._id)).path, "a.b/sub");
  assert.equal((await LatexFile.findById(file._id)).path, "new$&(+)/sub/a.tex");
  await assert.rejects(LatexCompilerService.compileLatexProject({ projectId }), /tree recovery/);
  await assert.rejects(mutateTree(projectId, { kind: "create", type: "folder", name: "blocked" }), /recovery/);
  // Real restart ownership takeover: child PID is gone, and all writes below use actual MongoDB CAS.
  await recoverTree(projectId);
  pending = await LatexProject.findById(projectId);
  assert.equal(pending.treeOperation, undefined);
  assert.equal(pending.entryFileId.toString(), file._id.toString());
  assert.equal(pending.sourceVersion, 1);
  let current = await LatexFile.findById(file._id);
  assert.equal(current.path, "new$&(+)/sub/a.tex");
  assert.equal(current.content, "confirmed source"); assert.equal(current.contentRevision, 7);
  assert.equal((await LatexFolder.findById(sub._id)).path, "new$&(+)/sub");
  assert.equal((await LatexFolder.findById(other._id)).path, "axb");
  await recoverTree(projectId);
  assert.equal((await LatexProject.findById(projectId)).sourceVersion, 1);
  await mutateTree(projectId, { kind: "rename", type: "file", id: file._id.toString(), name: "literal$&(+).tex" });
  current = await LatexFile.findById(file._id);
  assert.equal(current.path, "new$&(+)/sub/literal$&(+).tex"); assert.equal(current.contentRevision, 7);
  await mutateTree(projectId, { kind: "create", type: "folder", name: "collision.tex", parentId: sub._id.toString() });
  const snapshot = current.toObject();
  await assert.rejects(mutateTree(projectId, { kind: "rename", type: "file", id: file._id.toString(), name: "COLLISION.tex" }), /collision/);
  current = await LatexFile.findById(file._id);
  assert.equal(current.path, snapshot.path); assert.equal(current.content, snapshot.content); assert.equal(current.contentRevision, snapshot.contentRevision);
  const foreignProject = await LatexProject.create({ name: "foreign project" });
  const foreign = await LatexFolder.create({ projectId: foreignProject._id, name: "foreign", path: "foreign" });
  for (const parentId of [new mongoose.Types.ObjectId().toString(), foreign._id.toString()]) {
    await assert.rejects(mutateTree(projectId, { kind: "create", type: "file", name: "invalid.tex", parentId }), /Parent folder/);
  }
  assert.equal(await LatexFile.countDocuments({ projectId }), 1, "invalid parents never insert files");
  assert.equal((await LatexProject.findById(projectId)).treeOperation, undefined);
  console.log("Live isolated standalone MongoDB passed: partial rename/process restart recovery, exact paths/content/revisions/entry IDs, collision preflight, invalid/cross-project parents, compile guard. No configured application data touched.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
