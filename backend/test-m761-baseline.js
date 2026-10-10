const assert = require("node:assert/strict");
const { RequirementExtractorService } = require("./dist/modules/job-tailoring/services/requirement-extractor.service");
const { EvidenceRankerService } = require("./dist/modules/job-tailoring/services/evidence-ranker.service");
const { MatchClassifierService } = require("./dist/modules/job-tailoring/services/match-classifier.service");
const { EvidenceValidatorService } = require("./dist/modules/job-tailoring/services/evidence-validator.service");

console.log("=== M7.6.1 BASELINE DIAGNOSTIC CHECK ===");

const extractor = new RequirementExtractorService();
const ranker = new EvidenceRankerService();
const classifier = new MatchClassifierService();
const validator = new EvidenceValidatorService();

const req = extractor.extract("Required: 3+ years experience with React.js, Node.js, and MongoDB")[0];
console.log("Extracted Requirement:", req);

const evidenceList = [
  {
    id: "e1",
    resumeId: "r1",
    versionId: "v1",
    section: "experience",
    type: "bullet",
    text: "Engineered scalable backend microservices using Node.js and MongoDB.",
    source: { fileId: "f1", fileName: "resume.tex", lineStart: 10, lineEnd: 10 },
    technologies: ["Node.js", "MongoDB"],
    normalizedTechnologies: ["nodejs", "mongodb"],
    entities: [],
  }
];

const ranked = ranker.rank(req, evidenceList);
console.log("Ranked Evidence Score:", ranked[0]?.score);

const verified = validator.validate(req, ranked);
console.log("Verified Evidence supports?:", verified[0]?.supports, "reason:", verified[0]?.reason);

const match = classifier.classifyDetailed(req, ranked);
console.log("Match Classification Result:", match);
assert.equal(match.classification, "PARTIAL", "multi-technology requirements should not discard matching technologies");

console.log("=== BASELINE CHECK COMPLETED ===");
