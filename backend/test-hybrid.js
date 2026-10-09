const assert = require("node:assert/strict");
const {
  tokenize,
  Bm25LexicalSearchProvider,
  InMemoryLexicalSearchProvider,
} = require("./dist/modules/job-tailoring/providers/bm25-lexical-search.provider");
const { HybridRetrievalService, validateWeights } = require("./dist/modules/job-tailoring/services/hybrid-retrieval.service");

const source = (id) => ({ fileId: id, fileName: `${id}.tex`, lineStart: 1, lineEnd: 2 });
assert.deepEqual(tokenize("Node.js React.js REST APIs React Native Spring Boot"), [
  "nodejs", "reactjs", "rest", "api", "react", "native", "spring", "boot",
]);

const documents = [
  { projectId: "a", versionId: "1", evidenceId: "a1", score: 0, text: "Built REST APIs using Node.js and Express.js", section: "experience", type: "bullet", source: source("a1") },
  { projectId: "a", versionId: "1", evidenceId: "a2", score: 0, text: "Developed backend services using Java and Spring Boot", section: "experience", type: "bullet", source: source("a2") },
  { projectId: "a", versionId: "2", evidenceId: "a3", score: 0, text: "Built Python data pipelines", section: "experience", type: "bullet", source: source("a3") },
  { projectId: "b", versionId: "1", evidenceId: "b1", score: 0, text: "Built Java Spring Boot services", section: "experience", type: "bullet", source: source("b1") },
];
const bm25 = new Bm25LexicalSearchProvider();
const ranked = bm25.rank("Node.js REST API", documents.slice(0, 2));
assert.equal(ranked[0].evidenceId, "a1");
assert.equal(ranked.length, 1);

const lexical = new InMemoryLexicalSearchProvider(documents);
const semantic = {
  async search({ projectId, versionId }) {
    return {
      query: "Node.js REST API",
      results: documents
        .filter((item) => item.projectId === projectId && item.versionId === versionId)
        .map((item, index) => ({ ...item, score: 0.9 - index * 0.1 })),
    };
  },
};
const hybrid = new HybridRetrievalService(lexical, semantic, { lexical: 0.5, semantic: 0.5 });
(async () => {
  const result = await hybrid.search({ projectId: "a", versionId: "1", query: "Node.js REST API", limit: 1 });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].evidenceId, "a1");
  assert.equal(result.results[0].hybridScore, 1);
  assert.ok(result.results[0].lexicalScore >= 0);
  assert.ok(result.results[0].semanticScore >= 0);
  assert.ok(result.results.every((item) => item.evidenceId.startsWith("a")));

  const lexicalOnly = new HybridRetrievalService(lexical, {
    async search() { throw new Error("semantic unavailable"); },
  }, { lexical: 1, semantic: 0 });
  const fallback = await lexicalOnly.search({ projectId: "a", versionId: "1", query: "Node.js", limit: 5 });
  assert.ok(fallback.warnings[0].includes("Semantic retrieval failed"));
  assert.ok(fallback.results.length > 0);

  assert.throws(() => validateWeights({ lexical: 0.2, semantic: 0.2 }));
  assert.throws(() => new HybridRetrievalService(lexical, semantic, { lexical: -1, semantic: 2 }));
  console.log("Hybrid retrieval tests passed");
})();
