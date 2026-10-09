import crypto from "crypto";
import { ResumeEvidenceData, EvidenceType } from "../types";

export interface SourceLatexFile {
  id: string;
  name: string;
  content: string;
}

export interface ParsedEvidenceResult {
  evidence: ResumeEvidenceData[];
  sections: Set<string>;
  warnings: string[];
}

const SECTION_NAMES: Record<string, string> = {
  summary: "summary",
  objective: "objective",
  education: "education",
  experience: "experience",
  "work experience": "experience",
  internships: "experience",
  projects: "projects",
  skills: "skills",
  "technical skills": "skills",
  certifications: "certifications",
  achievements: "achievements",
  publications: "publications",
  leadership: "leadership",
  activities: "activities",
  extracurricular: "extracurricular",
  coursework: "coursework",
};

const TECHNOLOGIES = [
  ["React Native", "react_native"],
  ["JavaScript", "javascript"],
  ["TypeScript", "typescript"],
  ["Next.js", "nextjs"],
  ["Node.js", "nodejs"],
  ["Express.js", "expressjs"],
  ["Socket.io", "socketio"],
  ["Google Cloud", "google_cloud"],
  ["REST API", "rest_api"],
  ["GraphQL", "graphql"],
  ["MongoDB", "mongodb"],
  ["PostgreSQL", "postgresql"],
  ["MySQL", "mysql"],
  ["Docker", "docker"],
  ["Kubernetes", "kubernetes"],
  ["AWS", "aws"],
  ["Redis", "redis"],
  ["GitHub", "github"],
  ["Git", "git"],
  ["Python", "python"],
  ["Java", "java"],
  ["C++", "cpp"],
  ["SQL", "sql"],
] as const;

export class ResumeEvidenceParserService {
  parseFiles(projectId: string, versionId: string, files: SourceLatexFile[]): ParsedEvidenceResult {
    const allEvidence: ResumeEvidenceData[] = [];
    const sections = new Set<string>();
    const warnings: string[] = [];
    for (const file of files) {
      try {
        const parsed = this.parseFile(projectId, versionId, file);
        parsed.evidence.forEach((item) => allEvidence.push(item));
        parsed.sections.forEach((section) => sections.add(section));
        warnings.push(...parsed.warnings);
      } catch (error) {
        warnings.push(`${file.name}: ${error instanceof Error ? error.message : "Unable to parse file"}`);
      }
    }
    return { evidence: allEvidence, sections, warnings };
  }

  private parseFile(projectId: string, versionId: string, file: SourceLatexFile): ParsedEvidenceResult {
    const lines = file.content.split(/\r?\n/);
    const evidence: ResumeEvidenceData[] = [];
    const sections = new Set<string>();
    const warnings: string[] = [];
    let currentSection = "other";
    let originalSectionName = "Other";
    let pendingStart: number | null = null;
    let pendingParts: string[] = [];

    const flush = (endLine: number): void => {
      const text = pendingParts.join(" ").replace(/\s+/g, " ").trim();
      if (pendingStart !== null && this.isMeaningful(text)) {
        const id = this.identity(projectId, versionId, file.id, pendingStart, endLine, text);
        const technologies = this.extractTechnologies(text);
        const normalizedTechnologies = technologies.map((technology) => this.normalizeTechnology(technology));
        const entities = this.extractEntities(text, currentSection);
        evidence.push({
          id,
          resumeId: projectId,
          projectId,
          versionId,
          section: currentSection,
          originalSectionName,
          type: this.evidenceType(currentSection, text),
          text,
          source: { fileId: file.id, fileName: file.name, lineStart: pendingStart, lineEnd: endLine },
          technologies,
          normalizedTechnologies,
          entities,
          metadata: { technologies, normalizedTechnologies, entities },
        });
      }
      pendingStart = null;
      pendingParts = [];
    };

    lines.forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const withoutComment = this.removeComment(rawLine);
      const heading = this.extractHeading(withoutComment);
      if (heading) {
        flush(lineNumber - 1);
        originalSectionName = heading.original;
        currentSection = SECTION_NAMES[heading.normalized] ?? "other";
        sections.add(currentSection);
        return;
      }
      const cleaned = this.cleanLatex(withoutComment);
      if (!cleaned) {
        flush(lineNumber - 1);
        return;
      }
      const startsAtomic = /\\item\b|\\resume(?:subheading|project|item)\b/i.test(withoutComment) || /^\s*[-*•]\s+/.test(rawLine);
      if (startsAtomic && pendingStart !== null) flush(lineNumber - 1);
      if (pendingStart === null) pendingStart = lineNumber;
      if (cleaned) pendingParts.push(cleaned);
      if (startsAtomic && pendingParts.length > 1) {
        const first = pendingParts.shift();
        if (first) pendingParts = [first, ...pendingParts];
      }
    });
    flush(lines.length);
    return { evidence, sections, warnings };
  }

  private removeComment(line: string): string {
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === "%" && !escaped) return line.slice(0, index);
      escaped = line[index] === "\\" && !escaped;
      if (line[index] !== "\\") escaped = false;
    }
    return line;
  }

  private extractHeading(line: string): { original: string; normalized: string } | null {
    const command = line.match(/\\(?:section|subsection|sectionName|resumeSection)\s*\{([^{}]+)\}/i);
    const plain = command?.[1] ?? (line.match(/^\s*(?:[-*])?\s*([A-Za-z][A-Za-z ]{2,40})\s*[:]?\\?$/)?.[1]);
    if (!plain) return null;
    return { original: plain.trim(), normalized: plain.toLowerCase().replace(/\s+/g, " ").trim() };
  }

  private cleanLatex(line: string): string {
    let result = line
      .replace(/\\(?:documentclass|usepackage|begin|end|input|include)\s*(?:\[[^\]]*])?\s*\{[^{}]*\}/gi, " ")
      .replace(/\\href\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\url\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\text(?:bf|it|rm|md|normalfont)\s*\{([^{}]*)\}/gi, "$1")
      .replace(/\\item\b/g, "")
      .replace(/\\(?:resumeSubheading|resumeProjectHeading|resumeProject|resumeItem)\b/g, "");
    result = result.replace(/\\[a-zA-Z]+\*?(?:\s*\[[^\]]*])?/g, " ");
    result = result.replace(/[{}]/g, " ").replace(/~+/g, " ");
    return result.replace(/\s+/g, " ").trim().replace(/^[-*•]\s*/, "");
  }

  private isMeaningful(text: string): boolean {
    return text.length >= 3 && !/^(document|begin|end|item|hfill|vspace|smallskip|medskip)$/i.test(text);
  }

  private evidenceType(section: string, text: string): EvidenceType {
    if (section === "skills") return "skill";
    if (section === "education") return "education";
    if (section === "certifications") return "certification";
    if (section === "summary" || section === "objective") return "summary";
    if (section === "projects" && !/^(built|developed|created|implemented|designed|led)\b/i.test(text)) return "project";
    if (section === "experience" || section === "leadership") return "experience";
    return "bullet";
  }

  private extractTechnologies(text: string): string[] {
    return TECHNOLOGIES.filter(([label]) => new RegExp(`(^|[^a-z0-9])${label.replace(/[.+]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(text)).map(([label]) => label);
  }

  private normalizeTechnology(technology: string): string {
    const normalized = technology.toLowerCase().replace(/\s+/g, "_").replace(/[.]/g, "");
    if (normalized === "react_native") return "react_native";
    if (normalized === "rest_api") return "rest_api";
    return normalized.replace(/js$/, "js");
  }

  private extractEntities(text: string, section: string): string[] {
    const entities = new Set<string>();
    if (section === "experience") {
      const atMatch = text.match(/\bat\s+([A-Z][A-Za-z0-9&. -]{2,50})/);
      if (atMatch) entities.add(atMatch[1].trim());
    }
    if (section === "projects") {
      const projectMatch = text.match(/^(?:project\s*[:\-]\s*)?([A-Z][A-Za-z0-9&: -]{2,60})/);
      if (projectMatch) entities.add(projectMatch[1].trim());
    }
    return [...entities];
  }

  private identity(projectId: string, versionId: string, fileId: string, lineStart: number, lineEnd: number, text: string): string {
    return crypto.createHash("sha256").update([projectId, versionId, fileId, lineStart, lineEnd, text].join("|")).digest("hex");
  }
}
