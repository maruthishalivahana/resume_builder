import { ClaimValidationResult, GroundedSuggestion, RankedEvidence, TailoringSuggestionData } from "../types";

const TECHNICAL_ENTITIES = [
  "javascript", "typescript", "python", "java", "c#", "c++", "node.js", "nodejs", "react",
  "react native", "next.js", "nextjs", "express", "express.js", "aws", "aws lambda", "aws s3",
  "azure", "gcp", "docker", "kubernetes", "mongodb", "postgresql", "mysql", "redis",
  "graphql", "rest api", "git", "github actions", "jenkins", "terraform",
];
const RESPONSIBILITY_VERBS = /\b(develop\w*|build\w*|design\w*|manage\w*|lead\w*|maintain\w*|implement\w*|create\w*|deploy\w*|architect\w*)\b/gi;
const CERTIFICATIONS = /\b(?:aws certified|azure certified|cka|ckad|pmp|cissp|certified scrum master|oracle certified)\b/gi;

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
    const evidenceIds = [...new Set(suggestion.evidenceIds)];
    const selected = evidence.filter((item) => evidenceIds.includes(item.id));
    const unsupportedClaims: Array<{ claim: string; reason: string }> = [];
    const warnings: Array<{ claim: string; reason: string }> = [];
    if (!suggestion.targetEvidenceId || !evidenceIds.includes(suggestion.targetEvidenceId)) {
      unsupportedClaims.push({ claim: suggestion.targetEvidenceId ?? "", reason: "Target evidence is not among the supplied verified evidence." });
    }
    if (selected.length === 0) {
      unsupportedClaims.push({ claim: suggestion.after ?? "", reason: "Suggestion does not reference supplied verified evidence." });
      return { valid: false, unsupportedClaims, warnings, evidenceIds };
    }

    const before = suggestion.before ?? "";
    const after = suggestion.after ?? "";
    const evidenceText = selected.map((item) => item.text).join(" ");
    const baseline = `${before} ${evidenceText}`.toLowerCase();
    for (const number of this.extractNumbers(after)) {
      if (!this.extractNumbers(baseline).has(number)) {
        unsupportedClaims.push({ claim: number, reason: "A new number, metric, percentage, or duration is not present in verified evidence." });
      }
    }
    for (const technology of this.extractTechnologies(after)) {
      if (!this.extractTechnologies(baseline).has(technology)) {
        unsupportedClaims.push({ claim: technology, reason: "Technology or platform is not supported by verified evidence." });
      }
    }
    for (const certification of this.extractCertifications(after)) {
      if (!this.extractCertifications(baseline).has(certification)) {
        unsupportedClaims.push({ claim: certification, reason: "Certification is not supported by verified evidence." });
      }
    }
    const beforeResponsibilities = this.extractResponsibilityVerbs(before);
    for (const verb of this.extractResponsibilityVerbs(after)) {
      if (!beforeResponsibilities.has(verb) && !this.extractResponsibilityVerbs(evidenceText).has(verb)) {
        unsupportedClaims.push({ claim: verb, reason: "Responsibility claim is not supported by verified evidence." });
      }
    }
    for (const organization of this.extractOrganizations(after)) {
      if (!this.extractOrganizations(`${before} ${evidenceText}`).has(organization)) {
        unsupportedClaims.push({ claim: organization, reason: "Organization is not supported by verified evidence." });
      }
    }
    if (after.trim() === "") {
      unsupportedClaims.push({ claim: "", reason: "Suggestion after text must not be empty." });
    }
    if (suggestion.reason.trim() === "") {
      warnings.push({ claim: "reason", reason: "Suggestion reason is empty." });
    }
    return { valid: unsupportedClaims.length === 0, unsupportedClaims, warnings, evidenceIds };
  }

  private extractNumbers(text: string): Set<string> {
    return new Set(text.toLowerCase().match(/\b\d+(?:[.,]\d+)?\s*(?:%|years?|yrs?|months?|days?|hours?|requests?\/day)?\b/g) ?? []);
  }

  private extractTechnologies(text: string): Set<string> {
    const lower = text.toLowerCase();
    return new Set(TECHNICAL_ENTITIES.filter((entity) => lower.includes(entity)));
  }

  private extractCertifications(text: string): Set<string> {
    return new Set((text.match(CERTIFICATIONS) ?? []).map((value) => value.toLowerCase()));
  }

  private extractResponsibilityVerbs(text: string): Set<string> {
    return new Set((text.match(RESPONSIBILITY_VERBS) ?? []).map((value) => value.toLowerCase()));
  }

  private extractOrganizations(text: string): Set<string> {
    const organizations = new Set<string>();
    for (const match of text.matchAll(/\b(?:at|for|with)\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*)*)/g)) {
      organizations.add(match[1].toLowerCase().replace(/[.,]+$/, ""));
    }
    return organizations;
  }
}
