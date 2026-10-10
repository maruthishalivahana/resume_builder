import { JobRequirementData, RequirementCategory, RequirementImportance } from "../types";

const HEADING_PATTERNS: Array<{ pattern: RegExp; importance?: RequirementImportance; category?: RequirementCategory }> = [
  { pattern: /^preferred\s*(qualifications|skills|experience|requirements)?$/i, importance: "preferred", category: "skill" },
  { pattern: /^(nice to have|plus|bonus|desired|optional)$/i, importance: "preferred", category: "skill" },
  { pattern: /^required\s*(qualifications|skills|experience|requirements)?$/i, importance: "required", category: "skill" },
  { pattern: /^(minimum qualifications|basic qualifications|must have|essential requirements)$/i, importance: "required", category: "skill" },
  { pattern: /^(responsibilities|key responsibilities|duties|what you'll do|role responsibilities)$/i, importance: "required", category: "responsibility" },
  { pattern: /^(technical skills|tech stack|technologies|skills & requirements)$/i, importance: "required", category: "skill" },
  { pattern: /^(education & experience|education|certifications?)$/i, importance: "required", category: "education" },
  { pattern: /^(about the role|job summary|overview)$/i, category: "responsibility" },
  { pattern: /^(qualifications?|requirements?|what we are looking for)$/i },
];

const KNOWN_TECH = [
  "python", "rest api", "rest apis", "restful api", "llm", "llms", "rag",
  "docker", "kubernetes", "cloud deployment", "aws", "gcp", "azure",
  "node.js", "nodejs", "react", "react.js", "reactjs", "react native", "next.js", "nextjs",
  "typescript", "javascript", "sql", "nosql", "mongodb", "postgresql",
  "vector database", "pinecone", "weaviate", "qdrant", "langchain",
  "microservices", "express.js", "expressjs", "java", "spring boot",
  "ci/cd", "github actions", "jenkins", "pytorch", "tensorflow", "graphql"
];

const SOFT_SKILL_WORDS = new Set([
  "communication", "collaboration", "ownership", "curiosity", "teamwork",
  "interpersonal", "leadership", "adaptability", "problem solving", "problem-solving",
  "passion", "passionate", "verbal", "written", "self-starter", "work ethic", "detail-oriented"
]);

export class RequirementExtractorService {
  extract(rawJobDescription: string): JobRequirementData[] {
    if (!rawJobDescription || typeof rawJobDescription !== "string" || !rawJobDescription.trim()) {
      return [];
    }

    const segments = this.segmentText(rawJobDescription);
    const requirements: JobRequirementData[] = [];
    const seenTexts = new Set<string>();

    let currentImportance: RequirementImportance = "unspecified";
    let currentCategory: RequirementCategory | undefined = undefined;

    for (const segment of segments) {
      const originalText = segment.text.trim();
      const trimmed = this.cleanRequirementText(originalText);
      if (!trimmed) continue;

      if (segment.isHeader) {
        const headerInfo = this.matchHeader(trimmed);
        if (headerInfo) {
          currentImportance = headerInfo.importance ?? "unspecified";
          currentCategory = headerInfo.category;
        }
        continue;
      }

      // Determine requirement-level importance & category
      const inlineImportance = this.detectImportance(trimmed, currentImportance);
      const category = this.detectCategory(trimmed, currentCategory);
      const { extractedTerms, normalizedTerms } = this.extractTerms(trimmed, category);

      const dedupeKey = this.canonicalize(trimmed);
      if (seenTexts.has(dedupeKey)) {
        continue;
      }
      seenTexts.add(dedupeKey);

      requirements.push({
        id: `requirement-${requirements.length + 1}`,
        text: trimmed,
        originalText,
        cleanText: trimmed,
        category,
        importance: inlineImportance,
        extractedTerms,
        normalizedTerms,
      });
    }

    return requirements;
  }

  private segmentText(raw: string): Array<{ text: string; isHeader: boolean }> {
    const lines = raw.split(/\r?\n/);
    const result: Array<{ text: string; isHeader: boolean }> = [];

    for (const rawLine of lines) {
      let line = rawLine.trim();
      if (!line) continue;

      // Check inline bullet splitting (e.g. "Requirements: • Item 1 • Item 2")
      if (line.includes("•") || line.includes(" - ") || line.includes(" * ")) {
        const parts = line.split(/(?=[•]|(?:\s+[-*]\s+))/).map((p) => p.replace(/^[\s•\-*]+/, "").trim()).filter(Boolean);
        for (const part of parts) {
          this.processPart(part, result);
        }
      } else {
        const cleaned = line.replace(/^[\s•\-*]+|^(\d+[\.\)])\s*/, "").trim();
        this.processPart(cleaned, result);
      }
    }

    return result;
  }

  private processPart(part: string, result: Array<{ text: string; isHeader: boolean }>): void {
    if (!part || part.length < 3) return;

    if (this.isHeaderLine(part)) {
      result.push({ text: part.replace(/:$/, ""), isHeader: true });
      return;
    }

    // If long continuous paragraph without bullet, split by sentence boundary if multi-sentence
    if (part.length > 150 && /[.!?]\s+[A-Z]/.test(part) && !/http|www/i.test(part)) {
      const sentences = part.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter((s) => s.length >= 10);
      for (const sentence of sentences) {
        result.push({ text: sentence, isHeader: false });
      }
    } else {
      result.push({ text: part, isHeader: false });
    }
  }

  private isHeaderLine(text: string): boolean {
    if (text.length > 80) return false;
    if (text.endsWith(":")) return true;
    return HEADING_PATTERNS.some((h) => h.pattern.test(text));
  }

  private matchHeader(text: string): { importance?: RequirementImportance; category?: RequirementCategory } | undefined {
    const clean = text.replace(/:$/, "").trim();
    for (const h of HEADING_PATTERNS) {
      if (h.pattern.test(clean)) {
        return { importance: h.importance, category: h.category };
      }
    }
    return undefined;
  }

  private detectImportance(text: string, contextImportance: RequirementImportance): RequirementImportance {
    if (/preferred|plus|bonus|nice to have|optional|desired/i.test(text)) {
      return "preferred";
    }
    if (/required|must|minimum|essential|basic/i.test(text)) {
      return "required";
    }
    return contextImportance;
  }

  private cleanRequirementText(text: string): string {
    return text
      .replace(/^(required|preferred)\s*(qualification|skill|experience|requirement)s?\s*:\s*/i, "")
      .replace(/^(must have|nice to have|preferred|required)\s*:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private canonicalize(text: string): string {
    return text.toLowerCase()
      .replace(/node\s*\.?\s*js/g, "nodejs")
      .replace(/react\s*\.?\s*js/g, "reactjs")
      .replace(/[^\p{L}\p{N}+#]+/gu, " ")
      .trim();
  }

  private hasExactTechnology(text: string): boolean {
    return KNOWN_TECH.some((tech) => this.hasExactToken(text, tech));
  }

  private detectCategory(text: string, contextCategory?: RequirementCategory): RequirementCategory {
    const lower = text.toLowerCase();

    if (/\b(bachelor|master|phd|degree|computer science|bs|ms|education)\b/i.test(lower)) {
      return "education";
    }
    if (/\b(certified|certification|aws certified|license)\b/i.test(lower)) {
      return "certification";
    }
    if (/\b(\d+\+?\s*years?|years?\s+of\s+experience|proven\s+track\s+record)\b/i.test(lower)) {
      return "experience";
    }
    if (/\b(communicat\w*|collaborat\w*|teamwork|interpersonal|leadership|adaptab\w*|problem.solving|ownership|curiosity)\b/i.test(lower)
      && !this.hasExactTechnology(lower)) {
      return "soft_skill";
    }
    if (/\b(design|build|develop|deploy|maintain|implement|lead|manage|architect|collaborate|drive|create)\b/i.test(lower)) {
      return "responsibility";
    }

    const hasTech = KNOWN_TECH.some((tech) => this.hasExactToken(lower, tech));
    if (hasTech) {
      return "skill";
    }

    const words = lower.split(/[^a-z0-9-]+/).filter((w) => w.length > 2);
    const isPureSoftSkill = words.length > 0 && words.every((w) => SOFT_SKILL_WORDS.has(w) || ["strong", "excellent", "good", "skills", "and", "with"].includes(w));
    if (isPureSoftSkill) {
      return "soft_skill";
    }

    return contextCategory ?? "skill";
  }

  private extractTerms(text: string, category: RequirementCategory): { extractedTerms: string[]; normalizedTerms: string[] } {
    const lower = text.toLowerCase();
    const termsSet = new Set<string>();

    // 1. Check known technical terms
    for (const tech of KNOWN_TECH) {
      if (this.hasExactToken(lower, tech)) {
        termsSet.add(tech);
      }
    }

    // 2. Add domain / action words
    const tokens = lower.split(/[^a-z0-9+#.]+/).filter((t) => t.length > 2);
    const stopWords = new Set(["the", "and", "with", "for", "from", "you", "will", "our", "are", "have", "must", "using", "your"]);

    for (const token of tokens) {
      if (stopWords.has(token)) continue;
      if (category === "skill" && SOFT_SKILL_WORDS.has(token)) continue; // avoid treating soft skills as tech terms
      termsSet.add(token);
    }

    const termsArray = [...termsSet];
    return {
      extractedTerms: termsArray,
      normalizedTerms: termsArray.map((t) => t.replace(/[^a-z0-9]+/g, " ").trim()),
    };
  }

  private hasExactToken(text: string, token: string): boolean {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
  }
}
