const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript"), React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const filename = path.join(__dirname, "../components/preview/pdf-preview.tsx");
let context;
const preview = new Module(filename, module); preview.filename = filename; preview.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = preview.require.bind(preview);
preview.require = name => name === "@/hooks/use-resume" ? { useResume: () => context } : originalRequire(name);
preview._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, filename);
const project = "aaaaaaaaaaaaaaaaaaaaaaaa", older = "000000000000000000000001", newer = "000000000000000000000002";
context = { pdfState: "valid", compileStatus: "success", compileErrors: [], isCompiling: false,
  entryFileId: "entry", files: [{ id: "entry", path: "resume/resume.tex" }] };
for (const compilationId of [newer, older, newer, older]) {
  const url = `http://localhost:5000/api/latex/projects/${project}/pdf?compilationId=${compilationId}`;
  context.pdfUrl = url;
  const html = renderToStaticMarkup(React.createElement(preview.exports.PDFPreview));
  const frames = [...html.matchAll(/<iframe[^>]*src="([^"]+)"/g)];
  assert.equal(frames.length, 1); assert.equal(frames[0][1], url);
  assert.match(html, /title="Compiled LaTeX PDF Preview"/);
  assert.doesNotMatch(frames[0][1], new RegExp(compilationId === older ? newer : older));
}
context.isCompiling = true;
assert.doesNotMatch(renderToStaticMarkup(React.createElement(preview.exports.PDFPreview)), /<iframe/);
context.isCompiling = false; context.pdfState = "none";
assert.doesNotMatch(renderToStaticMarkup(React.createElement(preview.exports.PDFPreview)), /<iframe/);
console.log("Native PDF preview regressions passed (actual React SSR; mocked provider): newer/older build URLs bind the iframe exactly; compiling/no-artifact states hide it. Browser-native PDF pixels remain outside SSR coverage.");
