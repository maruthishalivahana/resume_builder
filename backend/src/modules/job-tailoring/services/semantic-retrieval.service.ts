import { EmbeddingProvider, ScopedVectorSearchProvider, SemanticSearchResult } from "../providers/interfaces";

export class SemanticRetrievalService {
  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly vectorSearchProvider: ScopedVectorSearchProvider
  ) {}

  async search(input: { projectId: string; versionId: string; query: string; limit?: number }): Promise<{ query: string; results: SemanticSearchResult[] }> {
    const limit = input.limit ?? 10;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be an integer between 1 and 100");
    if (!input.query.trim()) throw new Error("query is required");
    const queryVector = await this.embeddingProvider.embed(input.query);
    const results = await this.vectorSearchProvider.search({
      projectId: input.projectId,
      versionId: input.versionId,
      queryVector,
      limit,
    });
    return { query: input.query, results };
  }
}
