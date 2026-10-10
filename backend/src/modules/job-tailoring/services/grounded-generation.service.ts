import { LLMProvider } from "../providers/interfaces";
import { ClaimValidatorService } from "./claim-validator.service";
import { GroundedSuggestion, JobRequirementData, MatchClassificationResult, RankedEvidence, SuggestionReasonCode } from "../types";
import { tailoringDiagnostic, tailoringDiagnosticWarning } from "../utils/tailoring-diagnostic.util";

export interface GroundedGenerationOutput {
  suggestion: GroundedSuggestion;
  validation: ReturnType<ClaimValidatorService["validateDetailed"]>;
  providerUsed?: string;
  fallbackUsed?: boolean;
}

export class GroundedGenerationService {
  private lastReasonCode: SuggestionReasonCode | undefined;

  constructor(
    private readonly provider: LLMProvider,
    private readonly fallbackProvider?: LLMProvider,
    private readonly validator = new ClaimValidatorService()
  ) {}

  getLastReasonCode(): SuggestionReasonCode | undefined {
    return this.lastReasonCode;
  }

  async generate(input: {
    requirement: JobRequirementData;
    match: MatchClassificationResult;
    evidence: RankedEvidence[];
  }): Promise<GroundedGenerationOutput | null> {
    const verifiedEvidence = input.evidence.filter((item) => input.match.evidenceIds.includes(item.id));
    this.lastReasonCode = undefined;
    tailoringDiagnostic("generation.input", {
      inputEvidenceCount: input.evidence.length,
      matchEvidenceIdsCount: input.match.evidenceIds.length,
      verifiedEvidenceCount: verifiedEvidence.length,
      classification: input.match.classification,
    });
    if (verifiedEvidence.length === 0) {
      this.lastReasonCode = "SUGGESTION_SCOPE_MISMATCH";
      tailoringDiagnosticWarning("generation.rejected.no_verified_evidence");
      return null;
    }
    if (input.match.classification !== "STRONG" && input.match.classification !== "PARTIAL") {
      tailoringDiagnostic("generation.skipped.ineligible_match_classification", { classification: input.match.classification });
      return null;
    }

    let suggestion: GroundedSuggestion | null = null;
    let providerUsed = this.provider.constructor.name;
    let fallbackUsed = false;

    try {
      suggestion = await this.provider.generate({
        requirement: input.requirement,
        evidence: verifiedEvidence,
        constraints: { mayInventFacts: false, mayChangeMeaning: false, mustReferenceEvidence: true },
        match: input.match,
      });
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : "unknown error";
      tailoringDiagnosticWarning("generation.skipped.provider_error", {
        errorType: error instanceof Error ? error.name : "unknown",
        reasonCode: "PROVIDER_ERROR",
        message: errMessage,
      });

      if (this.fallbackProvider) {
        tailoringDiagnosticWarning("generation.fallback.invoked", {
          fromProvider: this.provider.constructor.name,
          toProvider: this.fallbackProvider.constructor.name,
          reason: errMessage,
          requirementId: input.requirement.id,
        });

        try {
          suggestion = await this.fallbackProvider.generate({
            requirement: input.requirement,
            evidence: verifiedEvidence,
            constraints: { mayInventFacts: false, mayChangeMeaning: false, mustReferenceEvidence: true },
            match: input.match,
          });
          providerUsed = this.fallbackProvider.constructor.name;
          fallbackUsed = true;
        } catch (fallbackError) {
          tailoringDiagnosticWarning("generation.skipped.fallback_error", {
            reasonCode: "PROVIDER_ERROR",
            message: fallbackError instanceof Error ? fallbackError.message : "unknown",
          });
          this.lastReasonCode = "PROVIDER_ERROR";
          return null;
        }
      } else {
        this.lastReasonCode = "PROVIDER_ERROR";
        return null;
      }
    }

    if (!suggestion) {
      if (this.fallbackProvider && !fallbackUsed) {
        tailoringDiagnosticWarning("generation.fallback.invoked", {
          fromProvider: this.provider.constructor.name,
          toProvider: this.fallbackProvider.constructor.name,
          reason: "Primary provider returned no suggestion",
          requirementId: input.requirement.id,
        });

        try {
          suggestion = await this.fallbackProvider.generate({
            requirement: input.requirement,
            evidence: verifiedEvidence,
            constraints: { mayInventFacts: false, mayChangeMeaning: false, mustReferenceEvidence: true },
            match: input.match,
          });
          providerUsed = this.fallbackProvider.constructor.name;
          fallbackUsed = true;
        } catch {
          this.lastReasonCode = "NO_EDIT_NEEDED";
          return null;
        }
      }

      if (!suggestion) {
        this.lastReasonCode = "NO_EDIT_NEEDED";
        tailoringDiagnostic("generation.skipped.provider_returned_no_suggestion");
        return null;
      }
    }

    if (
      typeof suggestion.before !== "string" ||
      suggestion.before.trim().length === 0 ||
      typeof suggestion.after !== "string" ||
      typeof suggestion.reason !== "string" ||
      typeof suggestion.targetEvidenceId !== "string" ||
      !Array.isArray(suggestion.evidenceIds)
    ) {
      tailoringDiagnosticWarning("generation.rejected.malformed_provider_output", { reasonCode: "INVALID_PROVIDER_OUTPUT" });
      this.lastReasonCode = "INVALID_PROVIDER_OUTPUT";
      return null;
    }

    if (suggestion.before.trim() === suggestion.after.trim()) {
      tailoringDiagnostic("generation.rejected.noop_edit", { reasonCode: "NO_OP_EDIT" });
      this.lastReasonCode = "NO_OP_EDIT";
      return null;
    }

    const validation = this.validator.validateDetailed(suggestion, verifiedEvidence);
    if (!validation.valid) {
      tailoringDiagnosticWarning("generation.rejected.claim_validation", {
        unsupportedClaimCount: validation.unsupportedClaims.length,
        reasonCode: "CLAIM_VALIDATION_FAILED",
      });
      this.lastReasonCode = "CLAIM_VALIDATION_FAILED";
      return null;
    }

    return { suggestion, validation, providerUsed, fallbackUsed };
  }
}
