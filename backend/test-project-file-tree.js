const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript");
require("tsx/cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { buildProjectTree, visibleProjectTree } = require("../lib/project-tree.ts");
const { FileSaveManager } = require("../lib/file-save-manager.ts");
const sidebarPath = path.join(__dirname, "../components/app-shell/resume-sidebar.tsx");
const sidebarSource = fs.readFileSync(sidebarPath, "utf8");
// Load the actual sidebar renderer. Only its unused provider import is replaced;
// React, row components, lucide icons and the tree traversal run normally in SSR.
const sidebar = new Module(sidebarPath, module);
sidebar.filename = sidebarPath; sidebar.paths = Module._nodeModulePaths(path.dirname(sidebarPath));
const requireModule = sidebar.require.bind(sidebar);
sidebar.require = name => name === "@/hooks/use-resume" ? { useResume: () => assert.fail("tree must not access provider state") }
  : name === "@/lib/project-tree" ? require("../lib/project-tree.ts") : requireModule(name);
sidebar._compile(ts.transpileModule(sidebarSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, sidebarPath);
const { ProjectFileTree, ProjectFileItem, ProjectFolderItem } = sidebar.exports;
const folder = (id, parentFolderId = null, name = id) => ({ id, name, parentFolderId, path: `path/${id}`, projectId: "P" });
const file = (id, folderId = null, content = "", revision = 0) => ({ id, name: `${id}.tex`, folderId, path: `path/${id}.tex`, content, contentRevision: revision, contentLoaded: true });
const folders = [folder("root"), folder("sub", "root", "same"), folder("third", "sub"), folder("fourth", "third"),
  folder("other"), folder("duplicate-name", "other", "same"), folder("empty", "other")];
const files = [file("deep", "fourth"), file("in-sub", "sub"), file("separate", "duplicate-name"), file("root-file")];
const expanded = folders.map(f => f.id);
const noop = () => {};
function props(filesValue = files, foldersValue = folders, extra = {}) {
  return { files: filesValue, folders: foldersValue, activeFileId: "deep", expandedFolderIds: expanded, entryFileId: "deep",
    onToggleFolder: noop, onSelectFile: noop, onAddFileToFolder: noop, onAddFolderToFolder: noop,
    onRenameFile: noop, onDeleteFile: noop, onSetEntryFile: noop, onRenameFolder: noop, onDeleteFolder: noop, onNewFileClick: noop, ...extra };
}
function markup(options) { return renderToStaticMarkup(React.createElement(ProjectFileTree, options)); }
function ids(html) { return [...html.matchAll(/data-tree-id="([^"]+)"/g)].map(match => match[1]); }
function elements(element, type, result = []) {
  if (Array.isArray(element)) element.forEach(child => elements(child, type, result));
  else if (React.isValidElement(element)) {
    if (element.type === type) result.push(element);
    elements(element.props.children, type, result);
  }
  return result;
}
function renderingTests() {
  const snapshot = JSON.stringify({ files, folders });
  const tree = buildProjectTree(files, folders);
  assert.deepEqual(tree.diagnostics, []);
  const rows = visibleProjectTree(tree.roots, expanded);
  for (const { node } of rows) {
    if (node.kind === "folder") for (const child of node.children) {
      assert.equal(child.kind === "file" ? child.item.folderId : child.item.parentFolderId, node.item.id, "every displayed child uses its actual parent ID");
    }
  }
  assert.equal(rows.find(row => row.node.item.id === "deep").depth, 4);
  assert.equal(rows.find(row => row.node.item.id === "duplicate-name").depth, 1);
  assert.equal(rows.find(row => row.node.item.id === "sub").depth, 1);
  assert.equal(rows.find(row => row.node.item.id === "root-file").depth, 0, "slash in path must not hide an ID-root file");
  const html = markup(props());
  assert.deepEqual(ids(html).sort(), [...files, ...folders].map(item => item.id).sort());
  assert.equal(new Set(ids(html)).size, files.length + folders.length);
  assert.match(html, /aria-level="5"/); assert.match(html, /ENTRY/);
  const collapsed = ids(markup(props(files, folders, { expandedFolderIds: expanded.filter(id => id !== "root") })));
  for (const id of ["sub", "third", "fourth", "deep", "in-sub"]) assert.equal(collapsed.includes(id), false);
  for (const id of ["root", "other", "duplicate-name", "separate", "empty", "root-file"]) assert.equal(collapsed.includes(id), true);
  assert.equal(JSON.stringify({ files, folders }), snapshot, "rendering must not modify content/revisions/parents");
  assert.match(markup(props([], [])), /No files yet/);
  assert.deepEqual(ids(markup(props([], folders))).sort(), folders.map(item => item.id).sort());
  assert.deepEqual(ids(markup(props([], [folder("only-empty")]))), ["only-empty"]);

  const brokenFolders = [folder("orphan", "missing"), folder("orphan-child", "orphan"), folder("cycle-a", "cycle-b"), folder("cycle-b", "cycle-a"),
    folder("self", "self"), folder("valid")];
  const brokenFiles = [file("orphan-file", "missing"), file("cycle-file", "cycle-b"), file("child-file", "orphan-child")];
  const brokenTree = buildProjectTree(brokenFiles, brokenFolders);
  assert.equal(brokenTree.diagnostics.length, 4);
  const brokenHtml = markup(props(brokenFiles, brokenFolders, { expandedFolderIds: brokenFolders.map(f => f.id) }));
  assert.match(brokenHtml, /Inaccessible records/); assert.match(brokenHtml, /Folder parent cycle/); assert.match(brokenHtml, /missing parent missing/);
  assert.deepEqual(ids(brokenHtml).sort(), [...brokenFolders, ...brokenFiles].map(item => item.id).sort());
  const hiddenOrphans = ids(markup(props(brokenFiles, brokenFolders, { expandedFolderIds: ["cycle-a", "cycle-b", "self"] })));
  assert.equal(hiddenOrphans.includes("orphan-child"), false); assert.equal(hiddenOrphans.includes("child-file"), false);
  assert.equal(hiddenOrphans.includes("orphan-file"), true);
  // Very deep trees use an explicit stack, rather than imposing a fixed depth or risking call-stack overflow.
  const deepFolders = Array.from({ length: 20000 }, (_, i) => folder(`d${i}`, i ? `d${i - 1}` : null));
  const deepTree = buildProjectTree([], deepFolders);
  const deepRows = visibleProjectTree(deepTree.roots, deepFolders.map(f => f.id));
  assert.equal(deepRows.length, 20000); assert.equal(deepRows.at(-1).depth, 19999);
  assert.equal(visibleProjectTree(deepTree.roots, []).length, 1);
  const deepHtml = markup(props([], deepFolders.slice(0, 200), { expandedFolderIds: deepFolders.slice(0, 200).map(f => f.id) }));
  assert.equal(ids(deepHtml).length, 200); assert.match(deepHtml, /aria-level="200"/);
  assert.match(deepHtml, /padding-left:120px/); assert.doesNotMatch(deepHtml, /padding-left:2794px/);

  const calls = [];
  const element = ProjectFileTree(props(files, folders, {
    onSelectFile: id => calls.push(["select", id]), onRenameFile: value => calls.push(["rename", value.id]),
    onDeleteFile: value => calls.push(["delete", value.id]), onSetEntryFile: value => calls.push(["entry", value.id]),
    onToggleFolder: id => calls.push(["toggle", id]), onAddFolderToFolder: id => calls.push(["folder", id]), onAddFileToFolder: id => calls.push(["file", id]),
    onRenameFolder: value => calls.push(["rename-folder", value.id]), onDeleteFolder: value => calls.push(["delete-folder", value.id]),
  }));
  const deepItem = elements(element, ProjectFileItem).find(item => item.props.name === "deep.tex");
  deepItem.props.onClick(); deepItem.props.onRename(); deepItem.props.onDelete(); deepItem.props.onSetEntryFile();
  assert.equal(deepItem.props.isEntryFile, true); assert.equal(deepItem.props.isActive, true);
  const parentItem = elements(element, ProjectFolderItem).find(item => item.props.name === "fourth");
  parentItem.props.onToggle(); parentItem.props.onAddFolder(); parentItem.props.onAddFile();
  parentItem.props.onRename(); parentItem.props.onDelete();
  for (const duplicate of elements(element, ProjectFolderItem).filter(item => item.props.name === "same")) duplicate.props.onAddFolder();
  assert.deepEqual(calls, [["select", "deep"], ["rename", "deep"], ["delete", "deep"], ["entry", "deep"], ["toggle", "fourth"], ["folder", "fourth"], ["file", "fourth"],
    ["rename-folder", "fourth"], ["delete-folder", "fourth"], ["folder", "sub"], ["folder", "duplicate-name"]]);
}
function callback(source, name, dependencies) {
  const ast = ts.createSourceFile("callback.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = (ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer).getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(expression, name);
  const code = ts.transpileModule(`const callback = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(dependencies), code + "return callback;")(...Object.values(dependencies));
}
async function creationAndRefreshTests() {
  for (const parent of [null, "fourth"]) {
    const calls = [], errors = [];
    let selectedParent = "previous", opened = false;
    const open = callback(sidebarSource, "openFolderDialog", { setSelectedParentForFolder: value => { selectedParent = value; },
      setNewFolderName: noop, setModalError: noop, setIsFolderModalOpen: value => { opened = value; } });
    open(parent); assert.equal(selectedParent, parent); assert.equal(opened, true);
    const submit = callback(sidebarSource, "handleCreateFolderSubmit", { newFolderName: "  child  ", selectedParentForFolder: selectedParent,
      createFolder: async (...args) => calls.push(args), setModalError: value => errors.push(value), setIsFolderModalOpen: noop,
      setNewFolderName: noop, setSelectedParentForFolder: noop });
    await submit({ preventDefault: noop }); assert.deepEqual(calls, [["child", parent]]); assert.deepEqual(errors, [null]);
  }
  const hookSource = fs.readFileSync(path.join(__dirname, "../hooks/use-resume.tsx"), "utf8");
  let view = [], resolveSave;
  const writes = [];
  const saveGate = new Promise(resolve => { resolveSave = resolve; });
  const manager = new FileSaveManager(async (id, content, revision) => { writes.push({ id, content, revision }); await saveGate; return { content, contentRevision: revision + 1 }; }, noop, 100000);
  const refresh = callback(hookSource, "mergeProjectFiles", { saveManagerRef: { current: manager }, setFiles: update => { view = update(view); } });
  try {
    manager.merge(file("dirty", "sub", "base", 3), "P"); manager.edit("dirty", "unsaved");
    manager.merge(file("empty", "sub", "", 6), "P");
    manager.merge(file("flight", "sub", "base", 8), "P"); manager.edit("flight", "first save");
    const saving = manager.save("flight"); manager.edit("flight", "newer local edit");
    const incoming = [file("dirty", "sub", "stale server", 3), file("empty", "sub", "stale server", 6), file("flight", "sub", "stale server", 8)]
      .map(item => ({ ...item, contentLoaded: false }));
    refresh(incoming, "P");
    assert.deepEqual(view.map(item => [item.content, item.contentRevision, item.contentLoaded]), [["unsaved", 3, true], ["", 6, true], ["newer local edit", 8, true]]);
    const tree = buildProjectTree(view, folders);
    assert.deepEqual(visibleProjectTree(tree.roots, expanded).filter(row => row.node.kind === "file").map(row => row.node.item.content), ["unsaved", "", "newer local edit"]);
    resolveSave(); await saving;
    refresh(incoming, "P");
    assert.equal(view.find(item => item.id === "flight").content, "newer local edit"); assert.equal(view.find(item => item.id === "flight").contentRevision, 10);
    assert.deepEqual(writes, [{ id: "flight", content: "first save", revision: 8 }, { id: "flight", content: "newer local edit", revision: 9 }]);
    refresh([file("B-file")], "Q");
    assert.deepEqual(view.map(item => item.id), ["B-file"], "dirty P records must not leak into Q's tree");
    assert.equal(manager.drafts().some(draft => draft.id === "dirty" && draft.projectId === "P" && draft.content === "unsaved"), true);
  } finally { manager.deactivate(); }
}
(async () => { renderingTests(); await creationAndRefreshTests(); console.log("Project file-tree regressions passed: real React SSR, ID ancestry, nesting/duplicate names, exactly-once rows, collapse, empty/folder-only projects, orphan/cycle diagnostics, 20,000-level traversal, action IDs, nested creation and dirty/empty/in-flight refresh (mocked hook state/network)."); })().catch(error => { console.error(error); process.exitCode = 1; });
