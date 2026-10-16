import ResumeEvidence from "../models/ResumeEvidence";
import { LexicalSearchProvider, LexicalSearchResult } from "./interfaces";
import { normalizeEvidenceText } from "../utils/evidence-terms.util";

export function tokenize(text: string): string[] {
  return normalizeEvidenceText(text).split(/\s+/).filter(Boolean);
}

export class Bm25LexicalSearchProvider implements LexicalSearchProvider {
  constructor(
    private readonly k1 = 1.2,
    private readonly b = 0.75
  ) {}

  async search(params: {
    projectId: string;
    versionId: string;
    query: string;
    limit: number;
  }): Promise<LexicalSearchResult[]> {
    const records = await ResumeEvidence.find({
      projectId: params.projectId,
      versionId: params.versionId,
    }).lean();
    return this.rank(params.query, records.map((record) => ({
      evidenceId: record.evidenceId,
      score: 0,
      text: record.text,
      section: record.section,
      type: record.type,
      source: record.source,
    }))).slice(0, params.limit);
  }

  rank(query: string, documents: LexicalSearchResult[]): LexicalSearchResult[] {
    const queryTerms = [...new Set(tokenize(query))];
    const tokenized = documents.map((document) => tokenize(document.text));
    const averageLength = tokenized.length === 0
      ? 0
      : tokenized.reduce((sum, tokens) => sum + tokens.length, 0) / tokenized.length;
    const scored = documents.map((document, index) => {
      const tokens = tokenized[index];
      const frequencies = new Map<string, number>();
      tokens.forEach((token) => frequencies.set(token, (frequencies.get(token) ?? 0) + 1));
      let score = 0;
      for (const term of queryTerms) {
        const documentFrequency = tokenized.filter((candidate) => candidate.includes(term)).length;
        if (documentFrequency === 0) continue;
        const idf = Math.log(1 + (documents.length - documentFrequency + 0.5) / (documentFrequency + 0.5));
        const termFrequency = frequencies.get(term) ?? 0;
        const normalization = averageLength === 0
          ? 1
          : 1 - this.b + this.b * tokens.length / averageLength;
        score += idf * (termFrequency * (this.k1 + 1)) / (termFrequency + this.k1 * normalization);
      }
      return { document, score };
    });
    return scored
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => ({ ...item.document, score: item.score }));
  }
}

export class InMemoryLexicalSearchProvider implements LexicalSearchProvider {
  constructor(private readonly documents: Array<LexicalSearchResult & { projectId: string; versionId: string }>) {}

  async search(params: {
    projectId: string;
    versionId: string;
    query: string;
    limit: number;
  }): Promise<LexicalSearchResult[]> {
    const scoped = this.documents.filter((document) =>
      document.projectId === params.projectId && document.versionId === params.versionId
    );
    return new Bm25LexicalSearchProvider().rank(params.query, scoped).slice(0, params.limit);
  }
}
