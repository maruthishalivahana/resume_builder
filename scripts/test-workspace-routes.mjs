// Live Next.js routing regression. Does not start a server or contact MongoDB.
// HTTP page resolution is separate from the client's persisted-project API load.
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.RESUME_ROUTING_URL || "http://localhost:3000";
const projectId = process.env.RESUME_ROUTING_PROJECT_ID || "aaaaaaaaaaaaaaaaaaaaaaaa";
assert.match(projectId, /^[a-f\d]{24}$/i, "Use a valid persisted-project ID for the route comparison");
assert.ok(fs.existsSync(new URL("../app/resume/[id]/latex/page.tsx", import.meta.url)), "Dynamic LaTeX route page must exist");
async function run() {
  for (const id of ["demo", projectId]) {
    const pathname = `/resume/${id}/latex`;
    let response;
    try { response = await fetch(new URL(pathname, origin), { redirect: "manual", signal: AbortSignal.timeout(60000) }); }
    catch (error) { throw new Error(`Cannot verify ${pathname}. Start the local Next server or set RESUME_ROUTING_URL. ${error.message}`); }
    const html = await response.text();
    assert.equal(response.status, 200, `${pathname} must resolve through app/resume/[id]/latex/page.tsx; got HTTP ${response.status}`);
    assert.equal(response.headers.get("location"), null, `${pathname} must not redirect to another project`);
    // Successful App Router responses serialize a not-found fallback in RSC data.
    // Check rendered markup, not incidental text inside those payloads.
    assert.doesNotMatch(html, /<h1[^>]*>404<\/h1>/, `${pathname} must not render Next's 404 heading`);
    assert.match(html, /Compilation entry|Loading project/, `${pathname} must render the workspace or its project loading guard`);
    console.log(`${pathname}: HTTP 200, no redirect, workspace resolved`);
  }
  console.log("Workspace HTTP routing regressions passed (live Next server; backend restoration/browser hydration tested separately).");
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
