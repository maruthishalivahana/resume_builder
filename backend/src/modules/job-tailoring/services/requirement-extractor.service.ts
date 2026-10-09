import { JobRequirementData, RequirementCategory } from "../types";

const categoryTerms: Array<[RequirementCategory, string[]]> = [
  ["education", ["degree", "bachelor", "master", "phd", "education"]],
  ["certification", ["certification", "certified", "license"]],
  ["experience", ["years", "experience", "yr"]],
  ["soft_skill", ["communication", "leadership", "collaboration", "teamwork"]],
  ["tool", ["tool", "platform", "software"]],
  ["responsibility", ["responsible", "develop", "design", "manage", "build", "maintain"]],
  ["skill", ["skill", "proficient", "knowledge", "familiar"]],
];

export class RequirementExtractorService {
  extract(rawJobDescription: string): JobRequirementData[] {
    const lines = rawJobDescription
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
      .filter((line) => line.length >= 3);

    return lines.map((text, index) => {
      const normalizedTerms = this.terms(text);
      return {
        id: `requirement-${index + 1}`,
        text,
        category: this.category(text),
        importance: /required|must|minimum|need to/i.test(text) ? "required" : "preferred",
        extractedTerms: normalizedTerms,
        normalizedTerms,
      };
    });
  }

  private terms(text: string): string[] {
    return [...new Set(text.toLowerCase().split(/[^a-z0-9+#.]+/).filter((term) => term.length > 2))];
  }

  private category(text: string): RequirementCategory {
    const lower = text.toLowerCase();
    return categoryTerms.find(([, terms]) => terms.some((term) => lower.includes(term)))?.[0] ?? "other";
  }
}
