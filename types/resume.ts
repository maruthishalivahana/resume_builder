export interface BulletPoint {
  id: string;
  text: string;
  highlightedKeywords?: string[];
  suggestedImprovement?: string;
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  bullets: BulletPoint[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  honors?: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  subtitle?: string;
  link?: string;
  githubUrl?: string;
  techStack: string[];
  bullets: BulletPoint[];
}

export interface SkillCategory {
  id: string;
  categoryName: string;
  skills: string[];
}

export interface CertificationItem {
  id: string;
  title: string;
  issuer: string;
  date: string;
  url?: string;
}

export interface PersonalInfo {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  summary?: string;
}

export type TemplateType = "modern-engineer" | "minimalist-latex" | "executive-serif" | "clean-mono";

export interface ResumeSectionMeta {
  id: string;
  type: "personal" | "experience" | "projects" | "skills" | "education" | "certifications" | "custom";
  title: string;
  visible: boolean;
  order: number;
}

export interface ResumeVersion {
  id: string;
  versionName: string;
  createdAt: string;
  targetRole?: string;
  targetCompany?: string;
  matchScore?: number;
  changesSummary?: string;
}

export interface Resume {
  id: string;
  name: string;
  targetRole: string;
  updatedAt: string;
  template: TemplateType;
  personal: PersonalInfo;
  sections: ResumeSectionMeta[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  skills: SkillCategory[];
  education: EducationItem[];
  certifications: CertificationItem[];
  versions: ResumeVersion[];
}

export interface AISuggestion {
  id: string;
  targetId: string; // e.g. bullet_001
  type: "bullet_polish" | "quantify_impact" | "jd_alignment" | "syntax_tighten" | "ats_fix";
  originalText: string;
  suggestedText: string;
  rationale: string;
  evidence: string[];
  status: "pending" | "accepted" | "rejected";
}

export interface JobRequirement {
  id: string;
  name: string;
  category: "languages" | "frameworks" | "systems" | "architecture" | "soft_skills";
  status: "found" | "partial" | "missing";
  confidence: number; // 0 to 100
  evidenceSnippet?: string;
  matchedResumeTargetId?: string; // Links directly to e.g. bullet_001 or skill_001
  guidanceNote?: string;
}

export interface JobDescriptionMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  matchScore: number;
  updatedAt: string;
  rawText: string;
  requirements: JobRequirement[];
  strengthsSummary: string[];
  gapsSummary: string[];
}

// ATS Diagnostics & Reporting Data Models
export type ATSIssueSeverity = "critical" | "warning" | "good";

export interface ATSIssue {
  id: string;
  severity: ATSIssueSeverity;
  problem: string;
  explanation: string;
  suggestedFix?: string;
  actionableAIRecommendation?: string;
}

export interface ATSCategoryBreakdown {
  parsing: number; // e.g. 100
  keywords: number; // e.g. 91
  structure: number; // e.g. 94
  formatting: number; // e.g. 78
  sections: number; // e.g. 95
  readability: number; // e.g. 90
}

export interface KeywordCoverageItem {
  name: string;
  status: "found" | "partial" | "missing";
  category: string;
  evidence?: string;
  note?: string;
}

export interface ATSEvaluation {
  readinessScore: number; // e.g. 87
  readinessLabel: "Excellent" | "Good" | "Needs Attention";
  lastAnalyzed: string;
  jdKeywordAlignment: number; // e.g. 92
  targetJobTitle: string;
  targetCompany: string;
  breakdown: ATSCategoryBreakdown;
  issues: ATSIssue[];
  keywords: KeywordCoverageItem[];
}
