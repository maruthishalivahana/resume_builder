export type RequirementCategory =
  | "skill"
  | "responsibility"
  | "experience"
  | "education"
  | "certification"
  | "domain"
  | "tool"
  | "soft_skill"
  | "other";

export type RequirementImportance = "required" | "preferred";
export type MatchClassification = "STRONG" | "PARTIAL" | "WEAK" | "MISSING" | "CONFLICT";
export type EvidenceType =
  | "bullet"
  | "skill"
  | "project"
  | "experience"
  | "education"
  | "certification"
  | "summary";
export type SuggestionType = "rewrite" | "reorder" | "highlight" | "keyword" | "remove";
export type SuggestionStatus = "pending" | "accepted" | "edited" | "rejected";

export interface JobRequirementData {
  id: string;
  text: string;
  category: RequirementCategory;
  importance: RequirementImportance;
  extractedTerms: string[];
  normalizedTerms: string[];
}

export interface ResumeEvidenceData {
  id: string;
  resumeId: string;
  versionId: string;
  projectId?: string;
  section: string;
  originalSectionName?: string;
  subsection?: string;
  type: EvidenceType;
  text: string;
  source: {
    fileId: string;
    fileName: string;
    lineStart: number;
    lineEnd: number;
  };
  technologies: string[];
  entities: string[];
  embeddingReference?: string;
  metadata?: {
    technologies: string[];
    normalizedTechnologies?: string[];
    entities: string[];
  };
  normalizedTechnologies?: string[];
  embedding?: number[];
  embeddingModel?: string;
  embeddingDimensions?: number;
}

export interface RankedEvidence extends ResumeEvidenceData {
  score: number;
  lexicalScore: number;
  semanticScore: number;
  sectionScore: number;
  qualityScore: number;
}

export interface VerifiedEvidence {
  evidence: RankedEvidence;
  supports: boolean;
  reason: string;
}

export interface MatchEvidenceScore {
  evidenceId: string;
  lexicalScore: number;
  semanticScore: number;
  hybridScore: number;
}

export interface MatchClassificationResult {
  classification: MatchClassification;
  confidence: number;
  evidenceIds: string[];
  evidenceScores: MatchEvidenceScore[];
  reason: string;
}

export type GroundedSuggestionType = "rewrite" | "reorder" | "highlight" | "keyword";

export interface GroundedSuggestion {
  type: GroundedSuggestionType;
  targetEvidenceId: string;
  before: string;
  after: string;
  reason: string;
  evidenceIds: string[];
  confidence: number;
}

export interface ClaimValidationResult {
  valid: boolean;
  unsupportedClaims: Array<{ claim: string; reason: string }>;
  warnings: Array<{ claim: string; reason: string }>;
  evidenceIds: string[];
}

export interface SourcePatch {
  fileId: string;
  fileName: string;
  evidenceId: string;
  lineStart: number;
  lineEnd: number;
  before: string;
  after: string;
  beforeHash: string;
}

export interface TailoringSuggestionData {
  id: string;
  requirementId: string;
  type: SuggestionType;
  targetEvidenceId?: string;
  before?: string;
  after?: string;
  reason: string;
  evidenceIds: string[];
  confidence: number;
  status: SuggestionStatus;
  validation: "PASS" | "FAIL";
}

export interface StrictGenerationConstraints {
  mayInventFacts: false;
  mayChangeMeaning: false;
  mustReferenceEvidence: true;
}

export interface AnalysisSummary {
  total: number;
  strong: number;
  partial: number;
  weak: number;
  missing: number;
  conflict: number;
  safeSuggestions: number;
}
