import { LexicalSearchProvider, LexicalSearchResult } from "../providers/interfaces";
import { SemanticRetrievalService } from "./semantic-retrieval.service";

export interface HybridWeights {
  lexical: number;
  semantic: number;
}

export interface HybridSearchResult {
  evidenceId: string;
  text: string;
  section: string;
  type: string;
  source: LexicalSearchResult["source"];
  lexicalScore: number;
  semanticScore: number;
  hybridScore: number;
}

export class HybridRetrievalService {
  constructor(
    private readonly lexicalSearch: LexicalSearchProvider,
    private readonly semanticSearch: SemanticRetrievalService,
    private readonly weights: HybridWeights = { lexical: 0.5, semantic: 0.5 },
    private readonly candidateMultiplier = 4
  ) {
    validateWeights(weights);
  }

  async search(input: {
    projectId: string;
    versionId: string;
    query: string;
    limit?: number;
  }): Promise<{ query: string; results: HybridSearchResult[]; warnings?: string[] }> {
    const limit = input.limit ?? 10;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("limit must be an integer between 1 and 100");
    }
    if (!input.query.trim()) throw new Error("query is required");
    const candidateLimit = Math.min(100, Math.max(limit, limit * this.candidateMultiplier));
    const warnings: string[] = [];
    const lexicalPromise = this.lexicalSearch.search({
      projectId: input.projectId,
      versionId: input.versionId,
      query: input.query,
      limit: candidateLimit,
    });
    const semanticPromise = this.semanticSearch.search({
      projectId: input.projectId,
      versionId: input.versionId,
      query: input.query,
      limit: candidateLimit,
    });
    const [lexicalResult, semanticResult] = await Promise.allSettled([lexicalPromise, semanticPromise]);
    const lexical = lexicalResult.status === "fulfilled" ? lexicalResult.value : [];
    const semantic = semanticResult.status === "fulfilled" ? semanticResult.value.results : [];
    if (lexicalResult.status === "rejected") warnings.push(`Lexical retrieval failed: ${this.errorMessage(lexicalResult.reason)}`);
    if (semanticResult.status === "rejected") warnings.push(`Semantic retrieval failed: ${this.errorMessage(semanticResult.reason)}`);
    const lexicalNormalized = normalizeScores(lexical);
    const semanticNormalized = normalizeScores(semantic);
    const candidates = new Map<string, HybridSearchResult>();
    lexical.forEach((item) => {
      candidates.set(item.evidenceId, {
        ...item,
        lexicalScore: lexicalNormalized.get(item.evidenceId) ?? 0,
        semanticScore: 0,
        hybridScore: this.weights.lexical * (lexicalNormalized.get(item.evidenceId) ?? 0),
      });
    });
    semantic.forEach((item) => {
      const existing = candidates.get(item.evidenceId);
      const semanticScore = semanticNormalized.get(item.evidenceId) ?? 0;
      candidates.set(item.evidenceId, {
        ...(existing ?? item),
        lexicalScore: existing?.lexicalScore ?? 0,
        semanticScore,
        hybridScore: this.weights.lexical * (existing?.lexicalScore ?? 0) + this.weights.semantic * semanticScore,
      });
    });
    return {
      query: input.query,
      results: [...candidates.values()]
        .sort((left, right) => right.hybridScore - left.hybridScore)
        .slice(0, limit),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "unknown provider error";
  }
}

function normalizeScores<T extends { evidenceId: string; score: number }>(results: T[]): Map<string, number> {
  if (results.length === 0) return new Map();
  const scores = results.map((result) => result.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const equalScore = max === min;
  return new Map(results.map((result) => [
    result.evidenceId,
    equalScore ? (max > 0 ? 1 : 0) : (result.score - min) / (max - min),
  ]));
}

export function validateWeights(weights: HybridWeights): void {
  if (
    !Number.isFinite(weights.lexical) ||
    !Number.isFinite(weights.semantic) ||
    weights.lexical < 0 ||
    weights.semantic < 0 ||
    Math.abs(weights.lexical + weights.semantic - 1) > 0.000001
  ) {
    throw new Error("Hybrid weights must be non-negative and sum to 1");
  }
}
