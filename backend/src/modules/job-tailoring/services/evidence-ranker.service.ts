import { JobRequirementData, RankedEvidence, ResumeEvidenceData } from "../types";

export interface EvidenceRankingWeights {
  lexical: number;
  semantic: number;
  section: number;
  quality: number;
}

const defaultWeights: EvidenceRankingWeights = { lexical: 0.45, semantic: 0.25, section: 0.15, quality: 0.15 };

export class EvidenceRankerService {
  constructor(private readonly weights: EvidenceRankingWeights = defaultWeights) {}

  rank(requirement: JobRequirementData, evidence: ResumeEvidenceData[]): RankedEvidence[] {
    return evidence
      .map((item) => {
        const lexicalScore = this.lexicalScore(requirement.normalizedTerms, item);
        const semanticScore = 0;
        const sectionScore = this.sectionScore(requirement.category, item);
        const qualityScore = Math.min(1, item.text.length / 120);
        const score = lexicalScore * this.weights.lexical + semanticScore * this.weights.semantic + sectionScore * this.weights.section + qualityScore * this.weights.quality;
        return { ...item, score, lexicalScore, semanticScore, sectionScore, qualityScore };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private lexicalScore(terms: string[], item: ResumeEvidenceData): number {
    if (terms.length === 0) return 0;
    return terms.filter((term) => item.text.toLowerCase().includes(term)).length / terms.length;
  }

  private sectionScore(category: string, item: ResumeEvidenceData): number {
    if (category === "skill" || category === "tool") return item.type === "skill" ? 1 : 0.5;
    if (category === "education") return item.type === "education" ? 1 : 0.25;
    return item.type === "bullet" || item.type === "experience" || item.type === "project" ? 1 : 0.5;
  }
}
