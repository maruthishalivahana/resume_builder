const assert = require("node:assert/strict");
const { applySourcePatchContent } = require("./dist/modules/job-tailoring/services/source-patch.service");
const { hashSourceText } = require("./dist/modules/job-tailoring/utils/source-hash.util");

function patch(before, after, lineStart, lineEnd = lineStart) {
  return {
    fileId: "file-a", fileName: "experience.tex", evidenceId: "e1",
    lineStart, lineEnd, before, after, beforeHash: hashSourceText(before),
  };
}

const single = applySourcePatchContent("first\nBuilt REST APIs using Node.js.\nlast", patch("Built REST APIs using Node.js.", "Developed REST APIs using Node.js.", 2));
assert.equal(single.updatedContent, "first\nDeveloped REST APIs using Node.js.\nlast");

const multi = applySourcePatchContent("a\nline one\nline two\nz", patch("line one\nline two", "replacement", 2, 3));
assert.equal(multi.updatedContent, "a\nreplacement\nz");

const relocated = applySourcePatchContent("header\nBuilt REST APIs using Node.js.\nfooter", patch("Built REST APIs using Node.js.", "Updated REST APIs using Node.js.", 8));
assert.equal(relocated.location.lineStart, 2);

assert.throws(
  () => applySourcePatchContent("a\nsame\nsame\nz", patch("same", "new", 8)),
  /AMBIGUOUS_SOURCE|multiple times/
);
assert.throws(
  () => applySourcePatchContent("a\nchanged\nz", patch("original", "new", 2)),
  /SOURCE_CHANGED|not found/
);
console.log("Source patch tests passed");
