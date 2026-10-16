const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript"), React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const filename = path.join(__dirname, "../components/ai/resume-ai-floating.tsx");
let context;
const component = new Module(filename, module); component.filename = filename; component.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = component.require.bind(component);
component.require = name => name === "@/hooks/use-resume" ? { useResume: () => context }
  : name === "react" ? { ...React, useState: initial => React.useState(initial === "chat" ? "jd" : initial) }
  : originalRequire(name);
component._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, filename);
context = { isAIAssistantOpen: true, chatMessages: [], activeJdSession: {
  status: "completed", jobDescription: "Required: Node.js", requirements: [], suggestions: [], summary: { total: 1, strong: 1, safeSuggestions: 0 },
  submittedAt: new Date().toISOString(), diagnosticReasons: { PROVIDER_ERROR: 1 },
} };
let html = renderToStaticMarkup(React.createElement(component.exports.ResumeAIFloating));
assert.match(html, /Suggestion generation unavailable/);
assert.match(html, /provider failed or timed out/);
assert.match(html, /Retry Analysis/);
assert.doesNotMatch(html, /risking unsupported claims/);
context.activeJdSession.diagnosticReasons = { NO_EDIT_NEEDED: 1 };
html = renderToStaticMarkup(React.createElement(component.exports.ResumeAIFloating));
assert.match(html, /Analysis completed with no safe suggestions/);
assert.doesNotMatch(html, /provider failed or timed out|Retry Analysis/);
context.activeJdSession.diagnosticReasons = { PROVIDER_ERROR: 1 };
context.activeJdSession.suggestions = [{ suggestionId: "s1", status: "pending", requirement: "Node.js", evidence: [], confidence: 0.8 }];
html = renderToStaticMarkup(React.createElement(component.exports.ResumeAIFloating));
assert.match(html, /Some suggestion generation failed or timed out/);
console.log("JD provider status passed (actual React SSR, injected JD mode/context): provider unavailable differs from no safe edit");
