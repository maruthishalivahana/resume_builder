const assert = require("node:assert/strict");
const { MatchClassifierService } = require("./dist/modules/job-tailoring/services/match-classifier.service");

const classifier = new MatchClassifierService();
const requirement = (id, text, category = "skill") => ({
  id,
  text,
  category,
  importance: "required",
  extractedTerms: text.toLowerCase().split(/\W+/).filter(Boolean),
  normalizedTerms: text.toLowerCase().split(/\W+/).filter((term) => term.length > 2),
});
const evidence = (id, text, technologies = [], normalizedTechnologies = technologies.map((item) => item.toLowerCase().replace(/[.\s]/g, "_"))) => ({
  id,
  text,
  technologies,
  normalizedTechnologies,
  metadata: { normalizedTechnologies },
  score: 0.9,
  lexicalScore: 0.9,
  semanticScore: 0.9,
  hybridScore: 0.9,
});
const classify = (req, item) => classifier.classifyDetailed(req, item ? [item] : []).classification;

assert.equal(classify(requirement("1", "Node.js"), evidence("e1", "Built backend services using Node.js", ["Node.js"], ["nodejs"])), "STRONG");
assert.notEqual(classify(requirement("2", "AWS Lambda"), evidence("e2", "Used AWS S3", ["AWS S3"], ["aws_s3"])), "STRONG");
assert.equal(classify(requirement("3", "Kubernetes"), undefined), "MISSING");
assert.equal(classify(requirement("4", "Develop REST APIs", "responsibility"), evidence("e4", "Built REST APIs using Express.js", ["REST API", "Express.js"], ["rest_api", "expressjs"])), "STRONG");
assert.notEqual(classify(requirement("5", "Managed a team of 10 engineers", "responsibility"), evidence("e5", "Worked with a software development team")), "STRONG");
assert.equal(classify(requirement("6", "3+ years of experience", "experience"), evidence("e6", "6-month software engineering internship")), "CONFLICT");
assert.equal(classify(requirement("7", "2+ years of Node.js experience", "experience"), evidence("e7", "Built a Node.js project", ["Node.js"], ["nodejs"])), "PARTIAL");
assert.notEqual(classify(requirement("8", "React"), evidence("e8", "Built React Native mobile applications", ["React Native"], ["react_native"])), "STRONG");
assert.notEqual(classify(requirement("9", "Java"), evidence("e9", "Built JavaScript applications", ["JavaScript"], ["javascript"])), "STRONG");
assert.notEqual(classify(requirement("10", "PostgreSQL"), evidence("e10", "Designed MongoDB collections", ["MongoDB"], ["mongodb"])), "STRONG");
assert.notEqual(classify(requirement("11", "Docker"), evidence("e11", "Managed Kubernetes deployments", ["Kubernetes"], ["kubernetes"])), "STRONG");
assert.notEqual(classify(requirement("12", "GitHub Actions"), evidence("e12", "Maintained Jenkins pipelines", ["Jenkins"], ["jenkins"])), "STRONG");
assert.notEqual(classify(requirement("13", "3 years experience"), evidence("e13", "3 months experience")), "STRONG");
assert.notEqual(classify(requirement("14", "Expert communication", "soft_skill"), evidence("e14", "Familiar with team communication")), "STRONG");
assert.notEqual(classify(requirement("15", "Professional experience with Python", "experience"), evidence("e15", "Python coursework")), "STRONG");
assert.equal(classify(requirement("16", "Bachelor's degree", "education"), evidence("e16", "Bachelor of Science degree in Computer Science")), "STRONG");
assert.equal(classify(requirement("17", "AWS certification", "certification"), evidence("e17", "AWS Certified Developer certification")), "STRONG");

const dataset = [
  ["Node.js", "Built backend services using Node.js", "STRONG"],
  ["AWS Lambda", "Used AWS S3", "PARTIAL"],
  ["Kubernetes", "", "MISSING"],
  ["Develop REST APIs", "Built REST APIs using Express.js", "STRONG"],
  ["Managed a team of 10 engineers", "Worked with a software development team", "WEAK"],
  ["3+ years of experience", "6-month internship", "CONFLICT"],
  ["2+ years of Node.js experience", "Built a Node.js project", "PARTIAL"],
  ["React", "Built React Native mobile applications", "PARTIAL"],
  ["Java", "Built JavaScript applications", "WEAK"],
  ["PostgreSQL", "Designed MongoDB collections", "WEAK"],
  ["Docker", "Managed Kubernetes deployments", "WEAK"],
  ["GitHub Actions", "Maintained Jenkins pipelines", "WEAK"],
  ["Bachelor's degree", "Bachelor of Science degree", "STRONG", "education"],
  ["AWS certification", "AWS Certified Developer certification", "STRONG", "certification"],
  ["Python", "Python API development", "STRONG", "skill"],
  ["TypeScript", "JavaScript frontend development", "WEAK", "skill"],
  ["GraphQL", "Built REST APIs", "WEAK", "skill"],
  ["Lead a team", "Led a software team", "STRONG", "responsibility"],
  ["5+ years experience", "1 year experience", "CONFLICT", "experience"],
  ["Cloud deployment", "Deployed applications to AWS", "WEAK", "responsibility"],
];
let passed = 0;
let falsePositives = 0;
for (const [text, textEvidence, expected, category = "skill"] of dataset) {
  const actual = classify(requirement(text, text, category), textEvidence ? evidence(text, textEvidence) : undefined);
  const isPass = actual === expected;
  if (isPass) passed += 1;
  if (["PARTIAL", "WEAK", "MISSING", "CONFLICT"].includes(expected) && actual === "STRONG") falsePositives += 1;
  console.log(`${text} | expected=${expected} actual=${actual} ${isPass ? "PASS" : "FAIL"}`);
}
console.log(`accuracy=${(passed / dataset.length).toFixed(3)}`);
console.log(`false-positive-rate=${(falsePositives / dataset.length).toFixed(3)}`);
assert.equal(falsePositives, 0);
console.log("Match classification tests passed");
