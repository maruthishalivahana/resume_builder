import { GroundedSuggestion, JobRequirementData, MatchClassificationResult, RankedEvidence, StrictGenerationConstraints } from "../types";
import { evidenceTerms, containsEvidenceTerm } from "../utils/evidence-terms.util";

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export type HighlightProposal = Omit<GroundedSuggestion, "type" | "before" | "after"> & {
  type: "highlight";
  highlightText: string;
};
export type GenerationProposal = GroundedSuggestion | HighlightProposal;

export interface LLMProvider {
  generate(input: {
    requirement: JobRequirementData;
    evidence: RankedEvidence[];
    constraints: StrictGenerationConstraints;
    match?: MatchClassificationResult;
  }): Promise<GenerationProposal | null>;
}

export interface LexicalSearchResult {
  evidenceId: string;
  score: number;
  text: string;
  section: string;
  type: string;
  source: SemanticSearchResult["source"];
}

export interface LexicalSearchProvider {
  search(params: {
    projectId: string;
    versionId: string;
    query: string;
    limit: number;
  }): Promise<LexicalSearchResult[]>;
}

export interface LegacyLexicalSearchProvider {
  search(query: string, evidence: RankedEvidence[]): RankedEvidence[];
}

export interface VectorSearchProvider {
  search(query: string, evidence: RankedEvidence[]): Promise<RankedEvidence[]>;
}

export interface SemanticSearchResult {
  evidenceId: string;
  score: number;
  text: string;
  section: string;
  type: string;
  source: {
    fileId: string;
    fileName: string;
    lineStart: number;
    lineEnd: number;
  };
}

export interface ScopedVectorSearchProvider {
  search(params: {
    projectId: string;
    versionId: string;
    queryVector: number[];
    limit: number;
  }): Promise<SemanticSearchResult[]>;
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;
  readonly model = "mock-hash-v1";

  constructor(dimensions = 64) {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error("Embedding dimensions must be a positive integer");
    }
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const vector = Array.from({ length: this.dimensions }, () => 0);
    for (const token of text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []) {
      let hash = 2166136261;
      for (const character of token) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
      }
      vector[Math.abs(hash) % this.dimensions] += 1;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

export class InMemoryVectorSearchProvider implements ScopedVectorSearchProvider {
  constructor(
    private readonly records: Array<{
      projectId: string;
      versionId: string;
      evidenceId: string;
      text: string;
      section: string;
      type: string;
      source: SemanticSearchResult["source"];
      embedding: number[];
    }>
  ) {}

  async search(params: {
    projectId: string;
    versionId: string;
    queryVector: number[];
    limit: number;
  }): Promise<SemanticSearchResult[]> {
    return this.records
      .filter((record) => record.projectId === params.projectId && record.versionId === params.versionId)
      .map((record) => ({
        evidenceId: record.evidenceId,
        score: cosineSimilarity(params.queryVector, record.embedding),
        text: record.text,
        section: record.section,
        type: record.type,
        source: record.source,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, params.limit);
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) return 0;
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

export class DeterministicLexicalSearchProvider implements LegacyLexicalSearchProvider {
  search(query: string, evidence: RankedEvidence[]): RankedEvidence[] {
    const terms = evidenceTerms(query);
    return evidence
      .map((item) => ({
        item,
        score: terms.filter((term) => containsEvidenceTerm(item.text, term)).length,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }
}

export class EmptyVectorSearchProvider implements VectorSearchProvider {
  async search(_query: string, _evidence: RankedEvidence[]): Promise<RankedEvidence[]> {
    return [];
  }
}

export class DeterministicTailoringGenerator implements LLMProvider {
  async generate(_input: {
    requirement: JobRequirementData;
    evidence: RankedEvidence[];
    constraints: StrictGenerationConstraints;
  }): Promise<GroundedSuggestion | null> {
    // No deterministic semantic edit is implemented. Abstain rather than append
    // placeholder prose or guess where text belongs inside user-authored LaTeX.
    return null;
  }
}
