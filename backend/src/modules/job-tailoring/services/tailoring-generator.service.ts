import { LLMProvider } from "../providers/interfaces";
import { GroundedSuggestion, JobRequirementData, MatchClassificationResult, RankedEvidence, StrictGenerationConstraints } from "../types";

export class TailoringGeneratorService {
  constructor(private readonly provider: LLMProvider) {}

  async generate(
    requirement: JobRequirementData,
    evidence: RankedEvidence[],
    match?: MatchClassificationResult
  ): Promise<GroundedSuggestion | null> {
    const constraints: StrictGenerationConstraints = { mayInventFacts: false, mayChangeMeaning: false, mustReferenceEvidence: true };
    return this.provider.generate({ requirement, evidence, constraints, match });
  }
}
