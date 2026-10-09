const { MockEmbeddingProvider } = require("./dist/modules/job-tailoring/providers/interfaces");
const { InMemoryVectorSearchProvider } = require("./dist/modules/job-tailoring/providers/interfaces");
const { InMemoryLexicalSearchProvider } = require("./dist/modules/job-tailoring/providers/bm25-lexical-search.provider");
const { SemanticRetrievalService } = require("./dist/modules/job-tailoring/services/semantic-retrieval.service");
const { HybridRetrievalService } = require("./dist/modules/job-tailoring/services/hybrid-retrieval.service");

(async () => {
  const provider = new MockEmbeddingProvider(64);
  const texts = [
    ["e1", "Node.js backend REST API development", "experience"],
    ["e2", "React frontend development with TypeScript", "projects"],
    ["e3", "MongoDB database design and optimization", "skills"],
    ["e4", "Python machine learning model training", "projects"],
  ];
  const records = await Promise.all(texts.map(async ([id, text, section]) => ({
    projectId: "evaluation",
    versionId: "1",
    evidenceId: id,
    text,
    section,
    type: "bullet",
    source: { fileId: id, fileName: `${id}.tex`, lineStart: 1, lineEnd: 1 },
    embedding: await provider.embed(text),
    score: 0,
  })));
  const lexical = new InMemoryLexicalSearchProvider(records);
  const semantic = new SemanticRetrievalService(provider, new InMemoryVectorSearchProvider(records));
  const hybrid = new HybridRetrievalService(lexical, semantic);
  for (const query of ["Node.js backend REST API", "React frontend development", "MongoDB database", "Python machine learning"]) {
    const result = await hybrid.search({ projectId: "evaluation", versionId: "1", query, limit: 1 });
    const top = result.results[0];
    console.log(`Query: ${query}`);
    console.log(`Evidence: ${top?.evidenceId ?? "none"}`);
    console.log(`Lexical: ${top?.lexicalScore.toFixed(3) ?? "0.000"} Semantic: ${top?.semanticScore.toFixed(3) ?? "0.000"} Hybrid: ${top?.hybridScore.toFixed(3) ?? "0.000"}`);
    console.log(`Section: ${top?.section ?? "none"} Source: ${top?.source.fileName ?? "none"}:${top?.source.lineStart ?? "-"}`);
    console.log("---");
  }
})();
