import { JobRequirementData, RankedEvidence, VerifiedEvidence } from "../types";
import { evidenceTerms, containsEvidenceTerm, isSubstantiveEvidenceTerm } from "../utils/evidence-terms.util";
import { explicitlyNegatesRequirement } from "../utils/evidence-negation.util";

export class EvidenceValidatorService {
  validate(requirement: JobRequirementData, evidence: RankedEvidence[]): VerifiedEvidence[] {
    return evidence.map((item) => {
      if (explicitlyNegatesRequirement(requirement.text, item.text)) {
        return { evidence: item, supports: false, reason: "Evidence explicitly negates the requested requirement." };
      }
      const requirementTerms = evidenceTerms(requirement.text);
      const technologyTerms = [
        ...(item.normalizedTechnologies ?? []),
        ...(item.metadata?.normalizedTechnologies ?? []),
      ];
      const technologyMatch = requirementTerms.some((term) => technologyTerms.some(value => containsEvidenceTerm(value, term)));
      const terms = technologyMatch
        ? requirementTerms.filter((term) => technologyTerms.some(value => containsEvidenceTerm(value, term)))
        : requirementTerms.filter((term) => containsEvidenceTerm(item.text, term));
      const substantive = terms.some(isSubstantiveEvidenceTerm);
      return {
        evidence: item,
        supports: substantive && item.score >= 0.35,
        reason: terms.length > 0 ? `Matched terms: ${terms.join(", ")}` : "No explicit supporting terms found.",
      };
    });
  }
}
