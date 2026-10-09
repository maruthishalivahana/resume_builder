const assert = require("node:assert/strict");
const { RequirementExtractorService } = require("./dist/modules/job-tailoring/services/requirement-extractor.service");
const { EvidenceRankerService } = require("./dist/modules/job-tailoring/services/evidence-ranker.service");
const { MatchClassifierService } = require("./dist/modules/job-tailoring/services/match-classifier.service");
const { EvidenceValidatorService } = require("./dist/modules/job-tailoring/services/evidence-validator.service");
const { ClaimValidatorService } = require("./dist/modules/job-tailoring/services/claim-validator.service");
const { ResumeEvidenceParserService } = require("./dist/modules/job-tailoring/services/resume-evidence-parser.service");

const requirement = new RequirementExtractorService().extract("Required: 3+ years of React experience")[0];
assert.equal(requirement.category, "experience");
assert.equal(requirement.importance, "required");

const evidence = [{
  id: "evidence-1",
  resumeId: "resume-1",
  versionId: "version-1",
  section: "experience",
  type: "bullet",
  text: "Built React applications with 1 year of experience.",
  source: { fileId: "file-1", fileName: "resume.tex", lineStart: 1, lineEnd: 1 },
  technologies: ["React"],
  entities: [],
}];
const ranked = new EvidenceRankerService().rank(requirement, evidence);
assert.equal(new MatchClassifierService().classify(requirement, ranked), "CONFLICT");
assert.equal(new EvidenceValidatorService().validate(requirement, ranked)[0].supports, true);
assert.equal(new ClaimValidatorService().validate({
  requirementId: requirement.id,
  type: "highlight",
  targetEvidenceId: evidence[0].id,
  before: evidence[0].text,
  after: evidence[0].text,
  reason: "Highlight existing evidence.",
  evidenceIds: [evidence[0].id],
  confidence: 0.5,
}, ranked), "PASS");
assert.equal(new ClaimValidatorService().validate({
  requirementId: requirement.id,
  type: "rewrite",
  targetEvidenceId: evidence[0].id,
  after: "Led a 10-year React transformation.",
  reason: "Unsupported claim.",
  evidenceIds: [evidence[0].id],
  confidence: 0.5,
}, ranked), "FAIL");

console.log("Tailoring unit tests passed");

const parser = new ResumeEvidenceParserService();
const files = [
  {
    id: "file-main",
    name: "main.tex",
    content: String.raw`\section{Summary}
Experienced engineer.
\section{Projects}
\resumeProject{Bus Tracking Platform}{React Native, Node.js, MongoDB}
\begin{itemize}
\item Built real-time APIs using Express.js and MongoDB.
\item Added Docker deployment.
\end{itemize}
% hidden comment
\section{Unusual Section}
\item Preserved source mapping.
`,
  },
  {
    id: "file-education",
    name: "sections/education.tex",
    content: String.raw`\section{Education}
\item Bachelor of Science in Computer Science
\section{Technical Skills}
Python, TypeScript, PostgreSQL`,
  },
];
const parsed = parser.parseFiles("project-1", "version-1", files);
assert.ok(parsed.sections.has("summary"));
assert.ok(parsed.sections.has("projects"));
assert.ok(parsed.sections.has("education"));
assert.ok(parsed.sections.has("skills"));
assert.ok(parsed.sections.has("other"));
assert.ok(parsed.evidence.some((item) => item.text.includes("real-time APIs")));
assert.ok(parsed.evidence.some((item) => item.source.fileId === "file-education"));
assert.ok(parsed.evidence.every((item) => !item.text.includes("hidden comment")));
const projectEvidence = parsed.evidence.find((item) => item.text.includes("Bus Tracking Platform"));
assert.ok(projectEvidence);
assert.deepEqual(projectEvidence.technologies, ["React Native", "Node.js", "MongoDB"]);
assert.deepEqual(projectEvidence.normalizedTechnologies, ["react_native", "nodejs", "mongodb"]);
assert.equal(projectEvidence.source.lineStart, 4);
const repeated = parser.parseFiles("project-1", "version-1", files);
assert.deepEqual(repeated.evidence.map((item) => item.id), parsed.evidence.map((item) => item.id));
assert.notDeepEqual(
  parser.parseFiles("project-1", "version-2", files).evidence.map((item) => item.id),
  parsed.evidence.map((item) => item.id)
);
const commandOnly = parser.parseFiles("project-1", "version-1", [{ id: "empty", name: "empty.tex", content: String.raw`\documentclass{article}
\begin{document}
\end{document}` }]);
assert.equal(commandOnly.evidence.length, 0);
console.log("Resume evidence parser tests passed");
