const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript"), React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const filename = path.join(__dirname, "../components/latex/latex-editor.tsx");
let context;
const workspace = new Module(filename, module); workspace.filename = filename; workspace.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = workspace.require.bind(workspace);
workspace.require = name => name === "@/hooks/use-resume" ? { useResume: () => context }
  : name.startsWith("@/components/") ? { PDFPreview: () => null, LatexCodeEditor: () => null, SaveConflictPanel: () => null } : originalRequire(name);
workspace._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, filename);
const files = [{ id: "root", path: "Maruthi_Kummari_Resume_root.tex", name: "Maruthi_Kummari_Resume_root.tex" },
  { id: "entry", path: "resume/resume.tex", name: "resume.tex" }];
for (const stale of [false, true]) {
  context = { activeFile: files[0], files, entryFileId: "entry", fileSaveStatus: "saved", saveConflicts: [], recoveryDrafts: [],
    compileErrors: [], compileStatus: "success", uploadStatus: "idle", compileLog: "", editorContent: "ROOT EDIT DISTINCTIVE",
    isPdfStale: stale, isCompiling: false };
  const html = renderToStaticMarkup(React.createElement(workspace.exports.LatexWorkspace));
  assert.match(html, /Compile entry: resume\/resume.tex/); // Tooltip remains explicit even for stale PDF.
  assert.match(html, stale ? /<span[^>]*>Recompile PDF: resume\/resume.tex<\/span>/ : /<span[^>]*>Compile entry: resume\/resume.tex<\/span>/);
  assert.match(html, /Editing Maruthi_Kummari_Resume_root.tex/);
  assert.match(html, /Compile builds resume\/resume.tex/);
  assert.match(html, /Use open file as compile target/);
  assert.match(html, /value="entry" selected=""/);
  assert.equal(context.entryFileId, "entry");
  context.activeFile = files[1];
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(workspace.exports.LatexWorkspace)), /Use open file as compile target|Compile builds/);
}
console.log("Compile-target UI regressions passed (actual React server rendering; mocked provider/editor/preview): explicit target labels, stale tooltip, root-editor/nested-entry notice and deliberate selection action.");
const dialogFilename = path.join(__dirname, "../components/latex/compile-target-dialog.tsx");
const dialogModule = new Module(dialogFilename, module);
dialogModule.filename = dialogFilename; dialogModule.paths = Module._nodeModulePaths(path.dirname(dialogFilename));
const dialogRequire = dialogModule.require.bind(dialogModule);
dialogModule.require = name => name === "@/hooks/use-resume" ? { useResume: () => context } : dialogRequire(name);
dialogModule._compile(ts.transpileModule(fs.readFileSync(dialogFilename, "utf8"), { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, dialogFilename);
context = { compileTargetChoice: { openPath: "b.tex", entryPath: "a.tex" }, resolveCompileTarget: () => {} };
const choiceHtml = renderToStaticMarkup(React.createElement(dialogModule.exports.CompileTargetDialog));
for (const text of ["You are editing b.tex", "selected target is a.tex", "Compile selected target", "Compile open file without changing default", "Cancel"]) assert.ok(choiceHtml.includes(text), text);
context.compileTargetChoice = null;
assert.doesNotMatch(renderToStaticMarkup(React.createElement(dialogModule.exports.CompileTargetDialog)), /Compile selected target/);
console.log("Compile-choice dialog rendering passed (SSR only; native showModal/focus/Escape require browser verification).");
