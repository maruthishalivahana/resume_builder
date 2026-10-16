import { GenerationProposal, LLMProvider } from "../providers/interfaces";
import { resolveHighlight } from "./highlight-edit.service";
import { ClaimValidatorService } from "./claim-validator.service";
import { GroundedSuggestion, JobRequirementData, MatchClassificationResult, RankedEvidence, SuggestionReasonCode } from "../types";
import { tailoringDiagnostic, tailoringDiagnosticWarning } from "../utils/tailoring-diagnostic.util";
import { explicitlyNegatesRequirement } from "../utils/evidence-negation.util";

export interface GroundedGenerationOutput {
  suggestion: GroundedSuggestion;
  validation: ReturnType<ClaimValidatorService["validateDetailed"]>;
  providerUsed?: string;
  fallbackUsed?: boolean;
}

export interface GroundedRejection {
  suggestion: GroundedSuggestion;
  validation: ReturnType<ClaimValidatorService["validateDetailed"]>;
  evidence: Array<{ id: string; text: string; rawText?: string }>;
}

export class GroundedGenerationService {
  private lastReasonCode: SuggestionReasonCode | undefined;

  constructor(
    private readonly provider: LLMProvider,
    // Retained for constructor compatibility; unavailable/no-edit results never use fallback prose.
    _fallbackProvider?: LLMProvider,
    private readonly validator = new ClaimValidatorService(),
    // Explicit audit hook: resume text is never included in ordinary diagnostics.
    private readonly onRejection?: (rejection: GroundedRejection) => void
  ) {}

  getLastReasonCode(): SuggestionReasonCode | undefined {
    return this.lastReasonCode;
  }

  async generate(input: {
    requirement: JobRequirementData;
    match: MatchClassificationResult;
    evidence: RankedEvidence[];
  }): Promise<GroundedGenerationOutput | null> {
    // Saved matches can predate current classification rules. Never send an
    // explicitly denied skill to a provider as positive evidence.
    const verifiedEvidence = input.evidence.filter((item) => input.match.evidenceIds.includes(item.id) &&
      !explicitlyNegatesRequirement(input.requirement.text, item.text));
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

    let proposal: GenerationProposal | null = null;
    const providerUsed = this.provider.constructor.name;

    try {
      proposal = await this.provider.generate({
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

      this.lastReasonCode = "PROVIDER_ERROR";
      return null;
    }

    if (proposal === null) {
      this.lastReasonCode = "NO_EDIT_NEEDED";
      tailoringDiagnostic("generation.skipped.provider_returned_no_suggestion");
      return null;
    }

    if (!proposal) {
      this.lastReasonCode = "INVALID_PROVIDER_OUTPUT";
      return null;
    }
    if (proposal.type === "highlight" && "before" in proposal && proposal.before === proposal.after) {
      this.lastReasonCode = "NO_OP_EDIT";
      return null;
    }
    const suggestion = resolveHighlight(proposal, verifiedEvidence);
    if (
      !suggestion ||
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
        requirementId: input.requirement.id,
        unsupportedClaimCount: validation.unsupportedClaims.length,
        validationReasons: JSON.stringify([...new Set(validation.unsupportedClaims.map(item => item.reason))]),
        reasonCode: "CLAIM_VALIDATION_FAILED",
      });
      if (this.onRejection) {
        try {
          this.onRejection(structuredClone({ suggestion, validation,
            evidence: verifiedEvidence.map(item => ({ id: item.id, text: item.text, rawText: item.rawText })) }));
        } catch {
          tailoringDiagnosticWarning("generation.rejection_observer.failed", { requirementId: input.requirement.id });
        }
      }
      this.lastReasonCode = "CLAIM_VALIDATION_FAILED";
      return null;
    }

    return { suggestion, validation, providerUsed, fallbackUsed: false };
  }
}
