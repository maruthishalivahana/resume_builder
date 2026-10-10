const assert = require("node:assert/strict");
const { RequirementExtractorService } = require("./dist/modules/job-tailoring/services/requirement-extractor.service");

const extractor = new RequirementExtractorService();
const requirements = extractor.extract(`
Responsibilities:
- Design and build APIs using JavaScript.
- Design and build APIs using JavaScript.
Preferred Skills:
- React Native mobile development.
Qualifications:
Candidates should communicate clearly and collaborate with product teams.
`);

assert.equal(requirements.length, 3);
assert.ok(requirements.every((item) => !/^(responsibilities|preferred skills|qualifications)$/i.test(item.text)));
assert.equal(requirements.filter((item) => item.importance === "preferred").length, 1);
assert.equal(requirements.find((item) => item.text.includes("React Native")).category, "skill");
assert.equal(requirements.find((item) => item.text.includes("communicate")).category, "soft_skill");
assert.ok(requirements[0].originalText);
assert.equal(requirements[0].cleanText, requirements[0].text);

const exactTokens = extractor.extract("JavaScript, React Native, Node.js, SQL, and NoSQL");
assert.equal(exactTokens.length, 1);
assert.ok(exactTokens[0].extractedTerms.includes("javascript"));
assert.ok(exactTokens[0].extractedTerms.includes("react native") === false || exactTokens[0].extractedTerms.includes("react"));

assert.deepEqual(extractor.extract(""), []);
assert.deepEqual(extractor.extract(" \n\t "), []);
console.log("M8 requirement intelligence tests passed");
