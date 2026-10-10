import {
  JobRequirementData,
  MatchClassificationResult,
  MatchReasonCode,
} from "../types";

export interface ClassifierEvidence {
  id: string;
  text: string;
  technologies?: string[];
  normalizedTechnologies?: string[];
  metadata?: { normalizedTechnologies?: string[] };
  score?: number;
  lexicalScore?: number;
  semanticScore?: number;
  hybridScore?: number;
}

const TECHNOLOGY_ALIASES: Record<string, string> = {
  "node.js": "nodejs",
  nodejs: "nodejs",
  react: "react",
  "react.js": "reactjs",
  reactjs: "reactjs",
  "react native": "react_native",
  "aws lambda": "aws_lambda",
  "aws s3": "aws_s3",
  "rest api": "rest_api",
  "rest apis": "rest_api",
  "restful api": "rest_api",
  mongodb: "mongodb",
  postgresql: "postgresql",
  mysql: "mysql",
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  "next.js": "nextjs",
  nextjs: "nextjs",
  "express.js": "expressjs",
  expressjs: "expressjs",
  docker: "docker",
  kubernetes: "kubernetes",
  "spring boot": "spring_boot",
  java: "java",
  sql: "sql",
  nosql: "nosql",
  javascriptlanguage: "javascript",
  "github actions": "github_actions",
  jenkins: "jenkins",
};

export class MatchClassifierService {
  classify(requirement: JobRequirementData, evidence: ClassifierEvidence[]): MatchClassificationResult["classification"] {
    return this.classifyDetailed(requirement, evidence).classification;
  }

  classifyDetailed(requirement: JobRequirementData, evidence: ClassifierEvidence[]): MatchClassificationResult {
    const evidenceScores = evidence.map((item) => ({
      evidenceId: item.id,
      lexicalScore: item.lexicalScore ?? 0,
      semanticScore: item.semanticScore ?? 0,
      hybridScore: item.hybridScore ?? item.score ?? 0,
    }));
    if (evidence.length === 0) {
      return this.result("MISSING", 0.99, [], evidenceScores, "No supporting resume evidence was found.");
    }

    const conflict = evidence.filter((item) => this.hasConflict(requirement.text, item.text));
    if (conflict.length > 0) {
      return this.result("CONFLICT", this.confidence(conflict[0], 0.95), conflict.map(e => e.id), evidenceScores, "Resume evidence explicitly contradicts the requested requirement.");
    }

    const best = evidence[0];
    const requirementTechnologies = this.extractTechnologies(requirement.text);
    if (requirementTechnologies.length > 0) {
      const exact = evidence.filter((item) => {
        const available = this.evidenceTechnologies(item);
        return requirementTechnologies.every((technology) => available.includes(technology));
      });
      if (exact.length > 0) {
        if (requirement.category === "experience" && exact.every(e => /\b(coursework|class project|academic)\b/i.test(e.text))) {
          return this.result("PARTIAL", this.confidence(exact[0], 0.55), exact.map(e => e.id), evidenceScores, "The technology appears in coursework or academic context, not explicit professional experience.");
        }
        if (this.requiresDuration(requirement.text) && exact.every(e => !this.hasDuration(e.text))) {
          return this.result("PARTIAL", this.confidence(exact[0], 0.65), exact.map(e => e.id), evidenceScores, "The required technology is explicit, but the resume does not explicitly establish the requested duration.");
        }
        return this.result("STRONG", this.confidence(exact[0], 0.95), exact.map(e => e.id), evidenceScores, "Explicit evidence directly matches the required technology.");
      }
      const partial = evidence.filter((item) => {
        const available = this.evidenceTechnologies(item);
        return requirementTechnologies.some((technology) =>
          available.includes(technology) || this.hasRelatedTechnology(technology, available)
        );
      });
      if (partial.length > 0) {
        return this.result("PARTIAL", this.confidence(partial[0], 0.65), partial.map(e => e.id), evidenceScores, "Some required technologies are explicit, but the complete technology requirement is not demonstrated.");
      }
      const related = evidence.filter((item) => requirementTechnologies.some((technology) =>
        this.hasRelatedTechnology(technology, this.evidenceTechnologies(item))
      ));
      if (related.length > 0) {
        return this.result("PARTIAL", this.confidence(related[0], 0.65), related.map(e => e.id), evidenceScores, "Related technology evidence exists, but the exact required technology is not explicitly demonstrated.");
      }
      if ((best.hybridScore ?? best.score ?? 0) < 0.25) {
        return this.result("MISSING", 0.9, [], evidenceScores, "No supporting resume evidence was found for this required technology.");
      }
      return this.result("WEAK", this.confidence(best, 0.35), [best.id], evidenceScores, "Related evidence was retrieved, but it does not establish the requested technology.");
    }

    const terms = this.requirementTerms(requirement.text);
    const matched = evidence.filter((item) => this.matchingTerms(terms, item.text).length >= Math.max(1, Math.ceil(terms.length * 0.5)));
    if (matched.length > 0 && (requirement.category === "education" || requirement.category === "certification")) {
      const strongEdu = matched.filter((item) => this.matchingTerms(terms, item.text).length >= Math.max(1, Math.ceil(terms.length * 0.5)));
      if (strongEdu.length > 0) {
        return this.result("STRONG", this.confidence(strongEdu[0], 0.9), strongEdu.map(e => e.id), evidenceScores, "Explicit evidence directly satisfies the education or certification requirement.");
      }
    }
    const responsibilityMatches = matched.filter((item) => this.hasDirectResponsibilitySignal(requirement.text, item.text));
    if (responsibilityMatches.length > 0) {
      return this.result("STRONG", this.confidence(responsibilityMatches[0], 0.9), responsibilityMatches.map(e => e.id), evidenceScores, "Explicit evidence directly demonstrates the requested responsibility or capability.");
    }
    if (matched.length > 0) {
      return this.result("PARTIAL", this.confidence(matched[0], 0.6), matched.map(e => e.id), evidenceScores, "Evidence supports an important part of the requirement but does not establish the complete requirement.");
    }
    if ((best.hybridScore ?? best.score ?? 0) < 0.25 || this.matchingTerms(terms, best.text).length === 0) {
      return this.result("MISSING", 0.9, [], evidenceScores, "No supporting resume evidence was found for this requirement.");
    }
    return this.result("WEAK", this.confidence(best, 0.3), [best.id], evidenceScores, "Related evidence was retrieved, but it does not sufficiently establish the requested capability.");
  }

  private result(
    classification: MatchClassificationResult["classification"],
    confidence: number,
    evidenceIds: string[],
    evidenceScores: MatchClassificationResult["evidenceScores"],
    reason: string
  ): MatchClassificationResult {
    const reasonCode: MatchReasonCode =
      classification === "MISSING" ? "NO_EVIDENCE_RETRIEVED" :
      classification === "CONFLICT" ? "CONFLICTING_EVIDENCE" :
      classification === "STRONG" ? "EXACT_EVIDENCE_MATCH" :
      classification === "PARTIAL" ? "PARTIAL_EVIDENCE_MATCH" :
      "RELATED_EVIDENCE_ONLY";
    return { classification, confidence: Math.max(0, Math.min(1, confidence)), evidenceIds, evidenceScores, reason, reasonCode };
  }

  private evidenceTechnologies(item: ClassifierEvidence): string[] {
    const textTechnologies = this.extractTechnologies(item.text);
    return [...new Set([
      ...(item.normalizedTechnologies ?? []),
      ...(item.metadata?.normalizedTechnologies ?? []),
      ...(item.technologies ?? []).map((technology) => this.normalizeTechnology(technology)),
      ...textTechnologies,
    ])];
  }

  private extractTechnologies(text: string): string[] {
    const normalizedText = text.toLowerCase()
      .replace(/node\s*\.?\s*js|nodejs/g, "nodejs")
      .replace(/react\s*\.?\s*js|reactjs/g, "reactjs")
      .replace(/restful\s+apis?|rest\s+apis?/g, "rest api");
    const technologies = [...new Set(Object.entries(TECHNOLOGY_ALIASES)
      .filter(([label]) => this.hasExactToken(normalizedText, label))
      .map(([, normalized]) => normalized))];
    return technologies.filter((technology) => !(technology === "react" && technologies.includes("react_native")));
  }

  private hasExactToken(text: string, token: string): boolean {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
  }

  private normalizeTechnology(value: string): string {
    const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
    return TECHNOLOGY_ALIASES[normalized] ?? normalized.replace(/[.\s]/g, "_");
  }

  private hasRelatedTechnology(required: string, available: string[]): boolean {
    return (required === "react" && available.includes("react_native")) ||
      (required === "aws_lambda" && available.includes("aws_s3")) ||
      (required === "rest_api" && available.some((item) => item === "expressjs"));
  }

  private requirementTerms(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9+#.]+/).filter((term) => term.length > 2 && !["experience", "years", "with", "and", "the"].includes(term));
  }

  private matchingTerms(terms: string[], text: string): string[] {
    const lower = text.toLowerCase();
    return terms.filter((term) => lower.includes(term));
  }

  private hasDirectResponsibilitySignal(requirement: string, evidence: string): boolean {
    const requiredSignals = requirement.toLowerCase().match(/\b(develop\w*|build\w*|design\w*|manage\w*|lead\w*|maintain\w*|implement\w*|create\w*|deploy\w*)\b/g) ?? [];
    const evidenceSignals = evidence.toLowerCase().match(/\b(develop\w*|build\w*|design\w*|manage\w*|lead\w*|led|maintain\w*|implement\w*|create\w*|deploy\w*)\b/g) ?? [];
    const stems: Record<string, string[]> = {
      develop: ["develop", "built"],
      build: ["build", "built"],
      design: ["design"],
      manage: ["manage", "managed"],
      lead: ["lead", "led"],
      maintain: ["maintain", "maintained"],
      implement: ["implement"],
      create: ["create"],
      deploy: ["deploy", "deployed"],
    };
    return requiredSignals.length > 0 && requiredSignals.some((signal) => {
      const root = Object.keys(stems).find((key) => signal.startsWith(key));
      return root ? evidenceSignals.some((item) => stems[root].some((stem) => item.startsWith(stem))) : false;
    });
  }

  private hasConflict(requirement: string, evidence: string): boolean {
    const requiredYears = requirement.match(/(\d+(?:\.\d+)?)\s*\+?\s*years?/i)?.[1];
    const resumeYears = evidence.match(/(\d+(?:\.\d+)?)\s*years?/i)?.[1];
    const requiredMonths = requirement.match(/(\d+)\s*\+?\s*months?/i)?.[1];
    const resumeMonths = evidence.match(/(\d+)\s*[- ]?months?/i)?.[1];
    return Boolean(
      (requiredYears && resumeYears && Number(resumeYears) < Number(requiredYears)) ||
      (requiredYears && resumeMonths && Number(resumeMonths) < Number(requiredYears) * 12) ||
      (requiredMonths && resumeMonths && Number(resumeMonths) < Number(requiredMonths))
    );
  }

  private requiresDuration(text: string): boolean {
    return /\b\d+(?:\.\d+)?\s*\+?\s*(?:years?|months?)\b/i.test(text);
  }

  private hasDuration(text: string): boolean {
    return /\b\d+(?:\.\d+)?\s*[- ]?(?:years?|months?)\b/i.test(text);
  }

  private confidence(evidence: ClassifierEvidence, base: number): number {
    const score = evidence.hybridScore ?? evidence.score ?? 0.5;
    return Math.min(1, base * 0.8 + Math.max(0, Math.min(1, score)) * 0.2);
  }
}
