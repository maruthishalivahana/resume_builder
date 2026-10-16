const assert = require("node:assert/strict");
require("tsx/cjs");
const { GroundedGenerationService } = require("./src/modules/job-tailoring/services/grounded-generation.service.ts");
const { ClaimValidatorService } = require("./src/modules/job-tailoring/services/claim-validator.service.ts");
const evidence = [{ id: "e1", text: "Built Node.js APIs for PRIVATE_MARKER_731.", rawText: String.raw`\item Built Node.js APIs for PRIVATE_MARKER_731.`, score: 0.9 }];
const proposed = { type: "rewrite", targetEvidenceId: "e1", before: evidence[0].rawText,
  after: String.raw`\item Built Node.js APIs using TensorFlow in production for PRIVATE_MARKER_731.`,
  reason: "Unsafe edit", evidenceIds: ["e1"], confidence: 0.8 };
const input = { requirement: { id: "r1", text: "Node.js" }, match: { classification: "STRONG", evidenceIds: ["e1"] }, evidence };
const originalLog = console.log, originalWarn = console.warn;
const logs = [], rejections = [];
(async () => {
  console.log = text => logs.push(text); console.warn = text => logs.push(text);
  try {
    const service = new GroundedGenerationService({ generate: async () => proposed }, undefined, new ClaimValidatorService(), entry => {
      rejections.push(entry); entry.suggestion.after = "Audit observer mutation";
    });
    assert.equal(await service.generate(input), null);
    assert.equal(service.getLastReasonCode(), "CLAIM_VALIDATION_FAILED");
    assert.equal(rejections.length, 1);
    assert.equal(rejections[0].validation.valid, false);
    assert.equal(rejections[0].evidence[0].rawText, evidence[0].rawText);
    assert.notEqual(proposed.after, "Audit observer mutation");
    assert.ok(rejections[0].validation.unsupportedClaims[0].claim.includes("TensorFlow"));
    assert.equal(logs.join("\n").includes("PRIVATE_MARKER_731"), false, "Default logs must never contain source or rejected claim text");
    const event = logs.map(line => JSON.parse(line)).find(event => event.event === "generation.rejected.claim_validation");
    assert.equal(event.requirementId, "r1"); assert.ok(JSON.parse(event.validationReasons).length);
    const brokenObserver = new GroundedGenerationService({ generate: async () => proposed }, undefined, new ClaimValidatorService(), () => { throw new Error("Audit disk full"); });
    assert.equal(await brokenObserver.generate(input), null, "Diagnostic observer errors must not change generation behavior");
    const ordinary = new GroundedGenerationService({ generate: async () => proposed });
    assert.equal(await ordinary.generate(input), null);
  } finally { console.log = originalLog; console.warn = originalWarn; }
  console.log("Generation diagnostics passed: detailed audit capture, isolated observer, safe default logs, unchanged rejection contract");
})().catch(error => { console.error(error); process.exitCode = 1; });
