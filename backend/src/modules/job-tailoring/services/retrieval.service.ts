import { LegacyLexicalSearchProvider, VectorSearchProvider } from "../providers/interfaces";
import { JobRequirementData, RankedEvidence } from "../types";

export class RetrievalService {
  constructor(
    private readonly lexical: LegacyLexicalSearchProvider,
    private readonly vector: VectorSearchProvider
  ) {}

  async retrieve(requirement: JobRequirementData, evidence: RankedEvidence[]): Promise<RankedEvidence[]> {
    const lexicalMatches = this.lexical.search(requirement.text, evidence);
    const vectorMatches = await this.vector.search(requirement.text, evidence);
    return [...new Map([...lexicalMatches, ...vectorMatches].map((item) => [item.id, item])).values()];
  }
}
