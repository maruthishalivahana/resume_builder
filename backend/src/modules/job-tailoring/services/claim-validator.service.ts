import { ClaimValidationResult, GroundedSuggestion, RankedEvidence, TailoringSuggestionData } from "../types";
import { explicitlyNegatesRequirement } from "../utils/evidence-negation.util";

// These contexts must not disappear when extracting an otherwise matching sentence.
const RESTRICTIVE_CONTEXT = /\b(no|not|never|without|only|limited|basic|introductory|familiar|exposure|learning|coursework|academic|prototype|personal|assisted|contributed)\b|\b(?:class|course)\s+project\b/i;

export class ClaimValidatorService {
  validate(
    suggestion: Omit<TailoringSuggestionData, "id" | "status" | "validation"> | GroundedSuggestion,
    evidence: RankedEvidence[]
  ): "PASS" | "FAIL" {
    return this.validateDetailed(suggestion, evidence).valid ? "PASS" : "FAIL";
  }

  validateDetailed(
    suggestion: Omit<TailoringSuggestionData, "id" | "status" | "validation"> | GroundedSuggestion,
    evidence: RankedEvidence[]
  ): ClaimValidationResult {
    const unsupportedClaims: ClaimValidationResult["unsupportedClaims"] = [];
    const warnings: ClaimValidationResult["warnings"] = [];
    const suppliedIds: unknown = suggestion.evidenceIds;
    const references: unknown[] = Array.isArray(suppliedIds) ? suppliedIds : [];
    const evidenceIds = [...new Set(references.filter((id): id is string => typeof id === "string"))];
    const reject = (claim: string, reason: string): void => { unsupportedClaims.push({ claim, reason }); };
    const result = (): ClaimValidationResult => ({ valid: unsupportedClaims.length === 0, unsupportedClaims, warnings, evidenceIds });

    if (!Array.isArray(suppliedIds) || references.length === 0) {
      reject("evidenceIds", "Suggestion must reference supplied verified evidence.");
    }
    const selected: RankedEvidence[] = [];
    for (const id of references) {
      if (typeof id !== "string" || !id || /\s/.test(id)) {
        reject(typeof id === "string" ? id : "evidenceIds", "Evidence reference is malformed.");
        continue;
      }
      const matches = evidence.filter(item => item.id === id);
      if (matches.length !== 1) {
        reject(id, "Evidence reference must resolve uniquely within the supplied verified evidence.");
      } else if (!selected.includes(matches[0])) {
        selected.push(matches[0]);
      }
    }
    const target = suggestion.targetEvidenceId;
    if (typeof target !== "string" || !target || !evidenceIds.includes(target) || !selected.some(item => item.id === target)) {
      reject(typeof target === "string" ? target : "", "Target evidence is not among the supplied verified evidence.");
    }
    // Never accept the remaining valid subset of an invalid evidence reference list.
    if (unsupportedClaims.length > 0) return result();

    const after = typeof suggestion.after === "string" ? suggestion.after : "";
    if (!after.trim()) {
      reject("", "Suggestion after text must not be empty.");
      return result();
    }
    // Generated `before` text is not evidence. Only the cited records establish facts.
    const claim = this.normalize(after);
    if (!claim) {
      reject(after, "Suggestion must contain a non-empty claim after formatting is removed.");
      return result();
    }
    const texts = selected.flatMap(item => [item.text, item.rawText])
      .filter((text): text is string => typeof text === "string" && Boolean(text.trim()))
      .map(text => this.normalize(text));
    const exact = texts.some(text => text === claim);
    const statements = this.statements(after);
    // Combine complete single-statement evidence records only. Extracting one
    // sentence from a larger record can drop qualifications or temporal context.
    const extractive = statements.length > 0 && statements.every(statement => texts.some(text =>
      !RESTRICTIVE_CONTEXT.test(text) && this.statements(text).length === 1 && text === statement
    ));
    if (!exact && !extractive && !this.isTechnologyList(after, selected)) {
      reject(after, "Claim is not explicitly established by the supplied evidence; ambiguous paraphrases and added qualifications, experience, responsibilities or impact are rejected.");
    }
    if (typeof suggestion.reason !== "string" || !suggestion.reason.trim()) {
      warnings.push({ claim: "reason", reason: "Suggestion reason is empty." });
    }
    return result();
  }

  private normalize(text: string): string {
    return text.normalize("NFC")
      .replace(/\\(?:textbf|textit|textrm|textmd|textnormal|emph)\s*(?=\{)/g, "")
      .replace(/\\item\b/g, "")
      .replace(/\\([%&_#])/g, "$1")
      .replace(/[{}]/g, "")
      .replace(/~/g, " ")
      .replace(/\s+/g, " ").trim().toLowerCase()
      .replace(/[.!?]$/, "").trim();
  }

  private statements(text: string): string[] {
    return text.split(/(?<=[.!?])\s+(?=[\p{L}\\])/u)
      .map(statement => this.normalize(statement)).filter(Boolean);
  }

  private isTechnologyList(after: string, selected: RankedEvidence[]): boolean {
    // Structured technology fields establish a mention, never usage, proficiency,
    // deployment or impact. Only bare list entries may be supported by these fields.
    const names = new Set(selected.filter(item => !RESTRICTIVE_CONTEXT.test(item.text) && !explicitlyNegatesRequirement(after, item.text))
      .flatMap(item => [
        ...(item.technologies ?? []), ...(item.normalizedTechnologies ?? []),
        ...(item.metadata?.technologies ?? []), ...(item.metadata?.normalizedTechnologies ?? []),
      ]).filter((name): name is string => typeof name === "string" && Boolean(name.trim()))
      .map(name => this.normalize(name)));
    const entries = after.split(/[,;\n]/).map(entry => this.normalize(entry));
    return entries.length > 0 && entries.every(entry => Boolean(entry) && names.has(entry));
  }
}
