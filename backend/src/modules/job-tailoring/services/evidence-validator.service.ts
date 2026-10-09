import { JobRequirementData, RankedEvidence, VerifiedEvidence } from "../types";

export class EvidenceValidatorService {
  validate(requirement: JobRequirementData, evidence: RankedEvidence[]): VerifiedEvidence[] {
    return evidence.map((item) => {
      const requirementTerms = requirement.normalizedTerms;
      const evidenceTerms = [
        ...(item.normalizedTechnologies ?? []),
        ...(item.metadata?.normalizedTechnologies ?? []),
      ];
      const technologyMatch = requirementTerms.some((term) => evidenceTerms.includes(term));
      const terms = technologyMatch
        ? requirementTerms.filter((term) => evidenceTerms.includes(term))
        : requirementTerms.filter((term) => item.text.toLowerCase().includes(term));
      return {
        evidence: item,
        supports: terms.length > 0 && item.score >= 0.35,
        reason: terms.length > 0 ? `Matched terms: ${terms.join(", ")}` : "No explicit supporting terms found.",
      };
    });
  }
}
