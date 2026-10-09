import {
  JobRequirementData,
  MatchClassificationResult,
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

    const conflict = evidence.find((item) => this.hasConflict(requirement.text, item.text));
    if (conflict) {
      return this.result("CONFLICT", this.confidence(conflict, 0.95), [conflict.id], evidenceScores, "Resume evidence explicitly contradicts the requested requirement.");
    }

    const best = evidence[0];
    const requirementTechnology = this.extractTechnology(requirement.text);
    if (requirementTechnology) {
      const exact = evidence.find((item) => this.evidenceTechnologies(item).includes(requirementTechnology));
      if (exact) {
        if (requirement.category === "experience" && /\b(coursework|class project|academic)\b/i.test(exact.text)) {
          return this.result("PARTIAL", this.confidence(exact, 0.55), [exact.id], evidenceScores, "The technology appears in coursework or academic context, not explicit professional experience.");
        }
        if (this.requiresDuration(requirement.text) && !this.hasDuration(exact.text)) {
          return this.result("PARTIAL", this.confidence(exact, 0.65), [exact.id], evidenceScores, "The required technology is explicit, but the resume does not explicitly establish the requested duration.");
        }
        return this.result("STRONG", this.confidence(exact, 0.95), [exact.id], evidenceScores, "Explicit evidence directly matches the required technology.");
      }
      const related = evidence.find((item) => this.hasRelatedTechnology(requirementTechnology, this.evidenceTechnologies(item)));
      if (related) {
        return this.result("PARTIAL", this.confidence(related, 0.65), [related.id], evidenceScores, "Related technology evidence exists, but the exact required technology is not explicitly demonstrated.");
      }
      return this.result("WEAK", this.confidence(best, 0.35), [best.id], evidenceScores, "Related evidence was retrieved, but it does not establish the requested technology.");
    }

    const terms = this.requirementTerms(requirement.text);
    const matched = evidence.find((item) => this.matchingTerms(terms, item.text).length >= Math.max(1, Math.ceil(terms.length * 0.5)));
    if (matched && (requirement.category === "education" || requirement.category === "certification") &&
      this.matchingTerms(terms, matched.text).length >= Math.max(1, Math.ceil(terms.length * 0.5))) {
      return this.result("STRONG", this.confidence(matched, 0.9), [matched.id], evidenceScores, "Explicit evidence directly satisfies the education or certification requirement.");
    }
    if (matched && this.hasDirectResponsibilitySignal(requirement.text, matched.text)) {
      return this.result("STRONG", this.confidence(matched, 0.9), [matched.id], evidenceScores, "Explicit evidence directly demonstrates the requested responsibility or capability.");
    }
    if (matched) {
      return this.result("PARTIAL", this.confidence(matched, 0.6), [matched.id], evidenceScores, "Evidence supports an important part of the requirement but does not establish the complete requirement.");
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
    return { classification, confidence: Math.max(0, Math.min(1, confidence)), evidenceIds, evidenceScores, reason };
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
    const lower = text.toLowerCase()
      .replace(/node\s*\.?\s*js|nodejs/g, "nodejs")
      .replace(/react\s*\.?\s*js|reactjs/g, "reactjs")
      .replace(/restful\s+apis?|rest\s+apis?/g, "rest api");
    const technologies = [...new Set(Object.entries(TECHNOLOGY_ALIASES)
      .filter(([label]) => new RegExp(`(^|[^a-z0-9])${label.replace(/[.+]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(lower))
      .map(([, normalized]) => normalized))];
    return technologies.filter((technology) => !(technology === "react" && technologies.includes("react_native")));
  }

  private extractTechnology(text: string): string | null {
    const lower = text.toLowerCase();
    const normalizedText = lower
      .replace(/node\s*\.?\s*js|nodejs/g, "nodejs")
      .replace(/react\s*\.?\s*js|reactjs/g, "reactjs")
      .replace(/restful\s+apis?|rest\s+apis?/g, "rest api");
    const matches = Object.entries(TECHNOLOGY_ALIASES)
      .filter(([label]) => new RegExp(`(^|[^a-z0-9])${label.replace(/[.+]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(normalizedText))
      .map(([, normalized]) => normalized);
    return matches.sort((a, b) => b.length - a.length)[0] ?? null;
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
