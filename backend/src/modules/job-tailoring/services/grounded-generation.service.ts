import { LLMProvider } from "../providers/interfaces";
import { ClaimValidatorService } from "./claim-validator.service";
import { GroundedSuggestion, JobRequirementData, MatchClassificationResult, RankedEvidence } from "../types";

export class GroundedGenerationService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly validator = new ClaimValidatorService()
  ) {}

  async generate(input: {
    requirement: JobRequirementData;
    match: MatchClassificationResult;
    evidence: RankedEvidence[];
  }): Promise<{ suggestion: GroundedSuggestion; validation: ReturnType<ClaimValidatorService["validateDetailed"]> } | null> {
    const verifiedEvidence = input.evidence.filter((item) => input.match.evidenceIds.includes(item.id));
    if (verifiedEvidence.length === 0) return null;
    const suggestion = await this.provider.generate({
      requirement: input.requirement,
      evidence: verifiedEvidence,
      constraints: { mayInventFacts: false, mayChangeMeaning: false, mustReferenceEvidence: true },
      match: input.match,
    });
    if (!suggestion) return null;
    const validation = this.validator.validateDetailed(suggestion, verifiedEvidence);
    if (!validation.valid) return null;
    return { suggestion, validation };
  }
}
