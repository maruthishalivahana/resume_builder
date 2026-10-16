// Isolated opt-in browser harness. Uses the actual PDF controller and preview renderer,
// real temporary PDFs, and the entry suite's mocked model methods. Never connects to MongoDB.
const express = require("express"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript"), React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const assert = require("node:assert/strict"), { createHash } = require("node:crypto"), { execFileSync } = require("node:child_process");
module.exports = async (records, pdfController, sandbox) => {
  let context;
  const filename = path.join(__dirname, "../components/preview/pdf-preview.tsx");
  const preview = new Module(filename, module); preview.filename = filename; preview.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = preview.require.bind(preview);
  preview.require = name => name === "@/hooks/use-resume" ? { useResume: () => context } : name === '@/components/preview/pdf-document-view' ? {PdfDocumentView:({url})=>React.createElement('div',{'data-pdf-url':url})} : originalRequire(name);
  preview._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename);
  const app = express();
  app.get("/api/latex/projects/:projectId/pdf", (req, res, next) => {
    res.on("finish", () => console.log(`Browser PDF request ${req.originalUrl} -> HTTP ${res.statusCode}`));
    void pdfController(req, res, next);
  });
  app.get("/", (req, res) => {
    const selected = records.find(record => record._id === req.query.build) || records[0];
    context = { pdfUrl: `/api/latex/projects/${selected.projectId}/pdf?compilationId=${selected._id}`, pdfState: "valid", compileStatus: "success",
      compileErrors: [], files: [{ id: selected.compiledEntryFileId, path: selected.mainFile }], entryFileId: selected.compiledEntryFileId,
      isCompiling: false, compileLatex: () => {}, compileDuration: selected.durationMs, lastCompiledAt: new Date() };
    const view = renderToStaticMarkup(React.createElement(preview.exports.PDFPreview));
    res.send(`<!doctype html><title>RESUME.ENG isolated artifact verification</title><style>body{font:16px sans-serif;background:#fafafa}iframe{width:100%;height:75vh}button{margin:8px}a{margin-right:20px}</style><h1>Real PDF / actual RESUME.ENG preview renderer</h1><p>Mocked provider/database; actual PDF endpoint. Requested compilation ${selected._id}, source ${selected.mainFile}.</p><nav><a href="/?build=${records[0]._id}">Older nested build</a><a href="/?build=${records[1]._id}">Newer root build</a><a href="/client">Mounted React switching test</a><a href="/finish">Finish isolated verification</a></nav>${view}`);
  });
  // Mount the actual preview component in React; only useResume is replaced with
  // an isolated provider. This verifies src updates without a full-page reload.
  const builds = records.slice(0, 2).map(({ _id, projectId, mainFile, compiledEntryFileId }) => ({ _id, projectId, mainFile, compiledEntryFileId }));
  const bundle = await require("esbuild").build({ bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    stdin: { loader: "tsx", resolveDir: path.join(__dirname, ".."), contents: `
      import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
      import {PDFPreview} from ${JSON.stringify(filename)}; import {PreviewProvider} from '@/hooks/use-resume';
      const builds=${JSON.stringify(builds)};
      function Harness(){const [build,setBuild]=useState(builds[1]); const url='/api/latex/projects/'+build.projectId+'/pdf?compilationId='+build._id;
        return <><h1>Mounted actual React PDFPreview</h1><p>Mocked provider/database. Requested compilation <span id="requested-id">{build._id}</span>.</p>
        <p>navigator.pdfViewerEnabled: <span id="native-pdf-capability">{String(navigator.pdfViewerEnabled)}</span></p>
        <button onClick={()=>setBuild(builds[1])}>Newer root build</button><button onClick={()=>setBuild(builds[0])}>Older nested build</button><a href="/finish">Finish isolated verification</a>
        <PreviewProvider value={{pdfUrl:url,pdfState:'valid',compileStatus:'success',compileErrors:[],files:[{id:build.compiledEntryFileId,path:build.mainFile}],entryFileId:build.compiledEntryFileId,isCompiling:false,compileLatex:()=>{}}}><PDFPreview /></PreviewProvider></>;
      }createRoot(document.getElementById('root')).render(<Harness/>);` },
    plugins: [{ name: "isolated-resume-provider", setup(build) {
      build.onLoad({filter:/pdf-document-view\.tsx$/}, args=>({loader:'tsx', contents:fs.readFileSync(args.path,'utf8').replace('new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()',JSON.stringify('/pdf.worker.mjs'))}));
      build.onResolve({ filter: /^@\/hooks\/use-resume$/ }, () => ({ path: "provider", namespace: "isolated" }));
      build.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({ loader: "js", resolveDir: path.join(__dirname, ".."), contents:
        "import React from 'react'; const context=React.createContext(null); export const PreviewProvider=context.Provider; export function useResume(){return React.useContext(context)}" }));
    } }],
  });
  app.get("/client", (req, res) => res.send('<!doctype html><title>Mounted PDF preview verification</title><style>body{font:16px sans-serif}[data-pdf-url]{height:70vh;overflow:auto;box-sizing:border-box}button,a{margin:12px}</style><div id="root"></div><script src="/preview-test.js"></script>'));
  app.get('/pdf.worker.mjs', (req,res)=>res.type('application/javascript').sendFile(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs', {paths:[path.join(__dirname,'..')]})));
  app.get("/preview-test.js", (req, res) => res.type("application/javascript").send(bundle.outputFiles[0].text));
  app.use((error, req, res, next) => { void next; res.status(error.statusCode || 500).json({ error: error.message }); });
  const server = await new Promise(resolve => { const server = app.listen(0, "127.0.0.1", () => resolve(server)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const sha = bytes => createHash("sha256").update(bytes).digest("hex");
    const seen = [];
    for (const record of [records[1], records[0], records[1], records[0]]) {
      const response = await fetch(`${origin}/api/latex/projects/${record.projectId}/pdf?compilationId=${record._id}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/pdf");
      assert.equal(Number(response.headers.get("content-length")), bytes.length);
      assert.match(response.headers.get("content-disposition"), /^inline;/);
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-"); assert.ok(bytes.length > 100);
      assert.equal(sha(bytes), sha(fs.readFileSync(path.resolve(record.pdfPath))), "HTTP body must match the exact build's on-disk artifact");
      const ranged = await fetch(`${origin}/api/latex/projects/${record.projectId}/pdf?compilationId=${record._id}`, { headers: { Range: "bytes=0-15" } });
      assert.equal(ranged.status, 206); assert.equal(ranged.headers.get("content-range"), `bytes 0-15/${bytes.length}`);
      assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), bytes.subarray(0, 16));
      const input = path.join(sandbox, `http-${record._id}.pdf`); fs.writeFileSync(input, bytes);
      const text = execFileSync(process.env.RESUME_ENTRY_PDFTOTEXT || "pdftotext", [input, "-"], { encoding: "utf8", windowsHide: true });
      if (record === records[0]) { assert.match(text, /ENTRY NESTED DISTINCTIVE.*Technical Skills/); assert.doesNotMatch(text, /ROOT AFTER EDIT/); }
      else { assert.match(text, /ROOT AFTER EDIT DISTINCTIVE/); assert.doesNotMatch(text, /Technical Skills|ENTRY NESTED/); }
      seen.push(sha(bytes));
      console.log(JSON.stringify({ compilationId: record._id, status: response.status, contentType: response.headers.get("content-type"),
        contentLength: bytes.length, signature: bytes.subarray(0, 8).toString(), sha256: sha(bytes), parserText: text.trim(),
        contentDisposition: response.headers.get("content-disposition"), cacheControl: response.headers.get("cache-control"),
        acceptRanges: response.headers.get("accept-ranges"), xFrameOptions: response.headers.get("x-frame-options"), contentSecurityPolicy: response.headers.get("content-security-policy") }));
    }
    assert.notEqual(seen[0], seen[1]); assert.equal(seen[0], seen[2]); assert.equal(seen[1], seen[3]);
    console.log("PDF HTTP-byte regressions passed: newer -> older, correct headers/length/signature, exact artifact SHA-256, parsed distinctive text, build-scoped 206 ranges; no HTML/empty/wrong-build response.");
    if (process.env.RESUME_ENTRY_BROWSER) {
      console.log(`BROWSER_VERIFICATION_URL=${origin}/client`);
      await new Promise(resolve => app.get("/finish", (req, res) => { res.send("Isolated browser verification finished."); server.close(resolve); }));
    }
  } finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
};
