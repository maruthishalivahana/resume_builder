import { GroundedSuggestion, JobRequirementData, MatchClassificationResult, RankedEvidence, StrictGenerationConstraints } from "../types";

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface LLMProvider {
  generate(input: {
    requirement: JobRequirementData;
    evidence: RankedEvidence[];
    constraints: StrictGenerationConstraints;
    match?: MatchClassificationResult;
  }): Promise<GroundedSuggestion | null>;
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
    const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
    return evidence
      .map((item) => ({
        item,
        score: terms.filter((term) => item.text.toLowerCase().includes(term)).length,
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
  async generate(input: {
    requirement: JobRequirementData;
    evidence: RankedEvidence[];
    constraints: StrictGenerationConstraints;
  }): Promise<GroundedSuggestion | null> {
    if (!input.constraints.mustReferenceEvidence || input.evidence.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tailoringDiagnostic } = require("../utils/tailoring-diagnostic.util");
    tailoringDiagnostic("deterministic_generator.started", {
      requirementCategory: input.requirement.category,
      evidenceCount: input.evidence.length,
    });

    // 1. Select the evidence item that best matches the requirement terms or category
    const terms = (input.requirement.extractedTerms ?? []).map((t) => t.toLowerCase());
    let bestEvidence = input.evidence[0];
    let maxOverlap = -1;

    for (const ev of input.evidence) {
      const evLower = ev.text.toLowerCase();
      let overlap = 0;
      for (const term of terms) {
        if (evLower.includes(term)) overlap += 1;
      }
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestEvidence = ev;
      }
    }

    const before = bestEvidence.rawText ?? bestEvidence.text;

    // 2. Safely tailor evidence without inventing unverified technology claims
    const rawTerms = input.requirement.extractedTerms ?? [];
    const matchedTerms: string[] = [];
    const evTextLower = bestEvidence.text.toLowerCase();

    for (const term of rawTerms) {
      if (term.trim() && evTextLower.includes(term.toLowerCase().trim())) {
        if (!matchedTerms.some((t) => t.toLowerCase() === term.toLowerCase())) {
          const match = bestEvidence.text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
          matchedTerms.push(match ? match[0] : term.trim());
        }
      }
    }

    if (matchedTerms.length === 0) {
      const stopWords = new Set(["experience", "with", "and", "or", "in", "to", "for", "the", "a", "an", "of", "on", "at", "by", "is", "are", "as"]);
      const reqWords = input.requirement.text.split(/[^a-zA-Z0-9.+/#-]/).filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));
      for (const word of reqWords) {
        if (evTextLower.includes(word.toLowerCase())) {
          if (!matchedTerms.some((t) => t.toLowerCase() === word.toLowerCase())) {
            matchedTerms.push(word);
          }
        }
      }
    }

    let enhancement: string;
    if (matchedTerms.length > 0) {
      const focusTerms = matchedTerms.slice(0, 2).join(" and ");
      enhancement = `, with emphasis on verified ${focusTerms}`;
    } else if (bestEvidence.technologies && bestEvidence.technologies.length > 0) {
      enhancement = `, with specialized focus on ${bestEvidence.technologies[0]}`;
    } else {
      enhancement = `, tailored for target ${input.requirement.category} alignment`;
    }

    const isLatex = before.includes("\\item") || before.includes("{");
    let after: string;

    if (isLatex) {
      const lastBraceIndex = before.lastIndexOf("}");
      if (lastBraceIndex !== -1) {
        const contentBeforeBrace = before.substring(0, lastBraceIndex).replace(/\.$/, "").trimEnd();
        after = `${contentBeforeBrace}${enhancement}${before.substring(lastBraceIndex)}`;
      } else {
        after = `${before.replace(/\.$/, "").trimEnd()}${enhancement}`;
      }
    } else {
      after = `${before.replace(/\.$/, "").trimEnd()}${enhancement}`;
    }

    if (after.trim() === before.trim()) return null;

    return {
      type: "rewrite",
      targetEvidenceId: bestEvidence.id,
      before,
      after,
      reason: `Tailors ${bestEvidence.section} to highlight ${input.requirement.category} requirement: ${input.requirement.text}`,
      evidenceIds: [bestEvidence.id],
      confidence: Math.min(1, Math.max(0.5, bestEvidence.score)),
    };
  }
}
