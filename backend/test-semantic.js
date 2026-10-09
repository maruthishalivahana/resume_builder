const assert = require("node:assert/strict");
const {
  MockEmbeddingProvider,
  InMemoryVectorSearchProvider,
} = require("./dist/modules/job-tailoring/providers/interfaces");
const { SemanticRetrievalService } = require("./dist/modules/job-tailoring/services/semantic-retrieval.service");

(async () => {
  const provider = new MockEmbeddingProvider(32);
  const records = [];
  for (const item of [
    ["a1", "a", "1", "Built Node.js backend REST APIs with MongoDB", "experience"],
    ["a2", "a", "2", "Built Python Django machine learning services", "experience"],
    ["b1", "b", "1", "Built Java Spring Boot services", "experience"],
  ]) {
    records.push({
      evidenceId: item[0],
      projectId: item[1],
      versionId: item[2],
      text: item[3],
      section: item[4],
      type: "bullet",
      source: { fileId: item[0], fileName: `${item[0]}.tex`, lineStart: 1, lineEnd: 1 },
      embedding: await provider.embed(item[3]),
    });
  }
  const retrieval = new SemanticRetrievalService(
    provider,
    new InMemoryVectorSearchProvider(records)
  );
  const result = await retrieval.search({
    projectId: "a",
    versionId: "1",
    query: "Node.js backend",
    limit: 1,
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].evidenceId, "a1");
  assert.ok(result.results[0].score > 0);
  assert.ok(result.results.every((item) => item.evidenceId.startsWith("a")));
  await assert.rejects(() => retrieval.search({
    projectId: "a",
    versionId: "1",
    query: "Node.js",
    limit: 0,
  }));
  console.log("Semantic retrieval tests passed");
})();
