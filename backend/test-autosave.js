const assert = require("node:assert/strict");
require("tsx/cjs");
const { FileSaveManager, afterSaved } = require("../lib/file-save-manager.ts");
const { updateLatexFile } = require("./src/controllers/latex.controller.ts");
const { LatexFile } = require("./src/models/LatexFile.ts");
const { LatexProject } = require("./src/models/LatexProject.ts");
const { updateLatexFile: saveFileApi, fetchLatexFile } = require("../lib/api/latex.ts");

const remote = (id, content = "original", revision = 0) => ({ id, content, contentRevision: revision, contentLoaded: true });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

async function run() {
  // Switching files cannot cancel the first file's independent debounce.
  const stored = new Map();
  const manager = new FileSaveManager(async (id, content, revision) => {
    stored.set(id, content); return { contentRevision: revision + 1 };
  }, () => {}, 5);
  manager.merge(remote("A"), "project"); manager.merge(remote("B"), "project");
  manager.edit("A", "edited A"); manager.edit("B", "edited B");
  await new Promise(resolve => setTimeout(resolve, 25));
  await manager.flush("project");
  assert.equal(stored.get("A"), "edited A"); assert.equal(stored.get("B"), "edited B");

  // A second same-file request cannot complete ahead of the first: it is serialized.
  const first = deferred(), second = deferred(), calls = [];
  const ordered = new FileSaveManager(async (id, content, revision) => {
    calls.push({ content, revision });
    await (calls.length === 1 ? first.promise : second.promise);
    return { contentRevision: revision + 1 };
  });
  ordered.merge(remote("A"), "project"); ordered.edit("A", "old edit");
  const saving = ordered.save("A");
  ordered.edit("A", "new edit"); const joined = ordered.save("A");
  assert.equal(calls.length, 1);
  first.resolve(); await tick();
  assert.deepEqual(calls, [{ content: "old edit", revision: 0 }, { content: "new edit", revision: 1 }]);
  second.resolve(); await Promise.all([saving, joined]);
  assert.equal(ordered.merge(remote("A", "stale GET", 0), "project").content, "new edit");
  assert.equal(ordered.status("project"), "saved");

  // Failure preserves dirty content through reload, then retry saves it.
  let fail = true, persisted;
  const retry = new FileSaveManager(async (id, content, revision) => {
    if (fail) throw new Error("offline");
    persisted = content; return { contentRevision: revision + 1 };
  });
  retry.merge(remote("A"), "project"); retry.edit("A", "keep this");
  await assert.rejects(retry.flush("project"), /offline.*Local edits are retained/);
  assert.equal(retry.status("project"), "error");
  assert.equal(retry.merge(remote("A", "server"), "project").content, "keep this");
  let compiled = 0;
  await assert.rejects(afterSaved(retry, "project", async () => { compiled++; }), /offline/);
  assert.equal(compiled, 0, "compilation must not start after a failed save");
  fail = false;
  await afterSaved(retry, "project", async () => { compiled++; });
  assert.equal(persisted, "keep this"); assert.equal(compiled, 1);

  // Empty is loaded content, and both dirty and previously saved buffers resist stale GETs.
  manager.edit("A", "");
  assert.equal(manager.merge(remote("A", "stale", 0), "project").content, "");
  await manager.flush("project");
  const empty = manager.merge({ id: "A", content: "", contentLoaded: false, contentRevision: 0 }, "project");
  assert.equal(empty.content, ""); assert.equal(empty.contentLoaded, true);

  // A successful HTTP status without a confirmed revision is still a failed save.
  const unconfirmed = new FileSaveManager(async () => ({}));
  unconfirmed.merge(remote("A"), "project"); unconfirmed.edit("A", "unconfirmed edit");
  await assert.rejects(unconfirmed.flush("project"), /did not confirm/);
  assert.equal(unconfirmed.status("project"), "error");
  assert.equal(unconfirmed.merge(remote("A", "server"), "project").content, "unconfirmed edit");

  // Controller CAS: deliver a newer request first, then an older same-base request.
  // Model methods are stubbed; no database connection, writes, or deletions occur.
  const originals = [LatexFile.findOneAndUpdate, LatexFile.exists, LatexProject.findByIdAndUpdate, LatexFile.findById, LatexFile.updateOne];
  const releaseOld = deferred();
  let record = { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", projectId: "bbbbbbbbbbbbbbbbbbbbbbbb", content: "base", name: "a.tex", path: "a.tex", folderId: null };
  LatexFile.findOneAndUpdate = async (filter, update) => {
    if (update.$set.content === "older") await releaseOld.promise;
    const expected = filter.$or ? 0 : filter.contentRevision;
    if ((record.contentRevision ?? 0) !== expected) return null;
    assert.equal(update.$inc.contentRevision, 1);
    record = { ...record, ...update.$set, contentRevision: expected + 1 };
    return { ...record };
  };
  LatexFile.exists = async () => true;
  LatexProject.findByIdAndUpdate = async () => ({});
  LatexFile.findById = async () => ({ ...record });
  LatexFile.updateOne = async () => { delete record.pendingWrite; return { matchedCount: 1 }; };
  const request = async (content, expectedRevision) => {
    let status, body, error;
    await updateLatexFile({ params: { fileId: record._id }, body: { content, expectedRevision } },
      { status(code) { status = code; return this; }, json(value) { body = value; } }, e => { error = e; });
    return { status, body, error };
  };
  try {
    const old = request("older", 0);
    const newer = await request("newer", 0);
    assert.equal(newer.status, 200); assert.equal(newer.body.data.file.contentRevision, 1);
    releaseOld.resolve();
    const rejected = await old;
    assert.equal(rejected.error.statusCode, 409); assert.equal(rejected.error.code, "FILE_REVISION_CONFLICT");
    assert.equal(record.content, "newer");
    assert.equal((await request("unversioned", undefined)).error.statusCode, 400);
    const conflict = new FileSaveManager(async () => { throw rejected.error; });
    conflict.merge(remote("A"), "project"); conflict.edit("A", "local conflict");
    await assert.rejects(conflict.flush("project"), /Revision conflict/);
    assert.equal(conflict.merge(remote("A", "newer", 1), "project").content, "local conflict");
  } finally {
    [LatexFile.findOneAndUpdate, LatexFile.exists, LatexProject.findByIdAndUpdate, LatexFile.findById, LatexFile.updateOne] = originals;
  }
  // The real API client passes the revision, propagates conflicts, and loads empty files.
  const originalFetch = global.fetch;
  try {
    global.fetch = async (url, init) => {
      assert.ok(url.endsWith("/api/latex/files/A"));
      assert.equal(init.method, "PATCH");
      assert.deepEqual(JSON.parse(init.body), { content: "", expectedRevision: 7 });
      return { ok: true, json: async () => ({ data: { file: { contentRevision: 8 } } }) };
    };
    assert.equal((await saveFileApi("A", "", 7)).contentRevision, 8);
    global.fetch = async () => ({ ok: false, status: 409, json: async () => ({ message: "Revision conflict" }) });
    await assert.rejects(saveFileApi("A", "local edit", 7), /Revision conflict/);
    global.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: { file: remote("A", "", 8) } }) });
    const loaded = await fetchLatexFile("A");
    assert.equal(loaded.content, ""); assert.equal(loaded.contentLoaded, true);
  } finally {
    global.fetch = originalFetch;
  }
  console.log("Autosave regressions passed: independent debounces, serialization, stale writes, failure/retry, compile barrier, empty/dirty buffers, legacy revision zero, conflicts.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
