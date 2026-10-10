import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { LatexFile } from "../../../models/LatexFile";
import { AppError } from "../../../middleware/error.middleware";
import JobRequirement from "../models/JobRequirement";
import ResumeMatch from "../models/ResumeMatch";
import TailoringAnalysis from "../models/TailoringAnalysis";
import TailoringSuggestion from "../models/TailoringSuggestion";
import { TailoringOrchestratorService } from "../services/tailoring-orchestrator.service";
import { RequirementExtractorService } from "../services/requirement-extractor.service";
import { ResumeIntelligenceService } from "../services/resume-intelligence.service";
import ResumeEvidence from "../models/ResumeEvidence";
import { MockEmbeddingProvider } from "../providers/interfaces";
import { AtlasVectorSearchProvider, MongoVectorSearchProvider } from "../providers/atlas-vector-search.provider";
import { EmbeddingIndexService } from "../services/embedding-index.service";
import { SemanticRetrievalService } from "../services/semantic-retrieval.service";
import { Bm25LexicalSearchProvider } from "../providers/bm25-lexical-search.provider";
import { HybridRetrievalService } from "../services/hybrid-retrieval.service";
import { MatchAnalysisService } from "../services/match-analysis.service";
import { MatchClassifierService } from "../services/match-classifier.service";
import { GroundedGenerationService } from "../services/grounded-generation.service";
import { SourcePatchService } from "../services/source-patch.service";
import { hashSourceText } from "../utils/source-hash.util";
import { resolveTailoringProviderConfig } from "../config/tailoring-provider.config";
import { randomUUID } from "crypto";

const orchestrator = new TailoringOrchestratorService();
const requirementExtractor = new RequirementExtractorService();
const resumeIntelligence = new ResumeIntelligenceService();
const embeddingProvider = new MockEmbeddingProvider(Number(process.env.EMBEDDING_DIMENSIONS ?? 64));
const embeddingIndex = new EmbeddingIndexService(embeddingProvider);
const vectorSearchProvider = process.env.VECTOR_SEARCH_PROVIDER === "atlas"
  ? new AtlasVectorSearchProvider()
  : new MongoVectorSearchProvider();
const semanticRetrieval = new SemanticRetrievalService(embeddingProvider, vectorSearchProvider);
const hybridRetrieval = new HybridRetrievalService(
  new Bm25LexicalSearchProvider(),
  semanticRetrieval,
  {
    lexical: Number(process.env.HYBRID_LEXICAL_WEIGHT ?? 0.5),
    semantic: Number(process.env.HYBRID_SEMANTIC_WEIGHT ?? 0.5),
  }
);
const matchAnalysis = new MatchAnalysisService(hybridRetrieval, new MatchClassifierService());
const providerConfig = resolveTailoringProviderConfig();
const groundedGeneration = new GroundedGenerationService(
  providerConfig.primaryProvider,
  providerConfig.fallbackProvider
);
const sourcePatch = new SourcePatchService();

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new AppError(`${name} is required`, 400);
  return value.trim();
}

export async function analyze(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resumeId = requireString(req.body.resumeId ?? req.body.projectId, "resumeId");
    const versionId = requireString(req.body.versionId, "versionId");
    const rawJobDescription = requireString(req.body.rawJobDescription ?? req.body.jobDescription, "rawJobDescription");
    const result = await orchestrator.analyze({ resumeId, versionId, rawJobDescription, title: req.body.title, company: req.body.company });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function extractRequirements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawJobDescription = requireString(req.body.rawJobDescription ?? req.body.jobDescription, "rawJobDescription");
    res.json({ success: true, data: requirementExtractor.extract(rawJobDescription) });
  } catch (error) {
    next(error);
  }
}

export async function indexResume(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = requireString(req.body.projectId, "projectId");
    const versionId = requireString(req.body.versionId, "versionId");
    res.status(201).json({ success: true, data: await resumeIntelligence.indexResume({ projectId, versionId }) });
  } catch (error) {
    next(error);
  }
}

export async function getResumeEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = requireString(req.params.projectId, "projectId");
    const filter: Record<string, string> = { projectId };
    for (const key of ["versionId", "section", "type", "fileId"]) {
      const value = req.query[key];
      if (typeof value === "string" && value.trim()) {
        filter[key === "fileId" ? "source.fileId" : key] = value.trim();
      }
    }
    const records = await ResumeEvidence.find(filter).sort({ "source.fileName": 1, "source.lineStart": 1 }).lean();
    res.json({
      success: true,
      data: records.map((record) => ({ ...record, id: record.evidenceId })),
    });
  } catch (error) {
    next(error);
  }
}

export async function indexResumeEmbeddings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = requireString(req.body.projectId, "projectId");
    const versionId = requireString(req.body.versionId, "versionId");
    res.status(201).json({ success: true, data: await embeddingIndex.indexResumeEmbeddings({ projectId, versionId }) });
  } catch (error) {
    next(error);
  }
}

export async function semanticSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = requireString(req.body.projectId, "projectId");
    const versionId = requireString(req.body.versionId, "versionId");
    const query = requireString(req.body.query, "query");
    const limit = req.body.limit === undefined ? undefined : Number(req.body.limit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      throw new AppError("limit must be an integer between 1 and 100", 400);
    }
    res.json({ success: true, data: await semanticRetrieval.search({ projectId, versionId, query, limit }) });
  } catch (error) {
    next(error);
  }
}

export async function hybridSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = requireString(req.body.projectId, "projectId");
    const versionId = requireString(req.body.versionId, "versionId");
    const query = requireString(req.body.query, "query");
    const limit = req.body.limit === undefined ? undefined : Number(req.body.limit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      throw new AppError("limit must be an integer between 1 and 100", 400);
    }

    res.json({ success: true, data: await hybridRetrieval.search({ projectId, versionId, query, limit }) });
  } catch (error) {
    next(error);
  }
}

export async function analyzeMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = requireString(req.body.projectId, "projectId");
    const versionId = requireString(req.body.versionId, "versionId");
    const requirementIds = req.body.requirementIds;
    if (requirementIds !== undefined && (!Array.isArray(requirementIds) || requirementIds.some((id: unknown) => typeof id !== "string" || id.trim().length === 0))) {
      throw new AppError("requirementIds must be an array of non-empty strings", 400);
    }

    res.json({
      success: true,
      data: await matchAnalysis.analyze({ projectId, versionId, analysisId: req.body.analysisId, requirementIds }),
    });
  } catch (error) {
    next(error);
  }
}

export async function generateSuggestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = requireString(req.body.projectId, "projectId");
    const versionId = requireString(req.body.versionId, "versionId");
    const requirementId = requireString(req.body.requirementId, "requirementId");
    const analysisId = typeof req.body.analysisId === "string" ? req.body.analysisId : undefined;
    const requirementRecord = await JobRequirement.findOne({ projectId, versionId, requirementId, ...(analysisId ? { analysisId } : {}) }).lean();
    if (!requirementRecord) throw new AppError("Requirement not found", 404, "REQUIREMENT_NOT_FOUND");
    const matchRecord = await ResumeMatch.findOne({ jobTargetId: requirementRecord.jobTargetId, requirementId }).lean();
    if (!matchRecord) throw new AppError("Match not found; analyze matches before generating", 409, "MATCH_NOT_FOUND");
    const retrieved = await hybridRetrieval.search({ projectId, versionId, query: requirementRecord.text, limit: 20 });
    const evidenceRecords = await ResumeEvidence.find({ projectId, versionId, evidenceId: { $in: matchRecord.evidenceIds } }).lean();
    const scoreById = new Map(retrieved.results.map((item) => [item.evidenceId, item]));
    const evidence = evidenceRecords.map((record) => {
      const score = scoreById.get(record.evidenceId);
      return {
        id: record.evidenceId, resumeId: record.resumeId, versionId: record.versionId, projectId: record.projectId,
        section: record.section, originalSectionName: record.originalSectionName, type: record.type, text: record.text,
        source: record.source, technologies: record.technologies, entities: record.entities,
        normalizedTechnologies: record.normalizedTechnologies, metadata: record.metadata,
        score: score?.hybridScore ?? 0, lexicalScore: score?.lexicalScore ?? 0,
        semanticScore: score?.semanticScore ?? 0, sectionScore: 0, qualityScore: 0,
      };
    });
    const result = await groundedGeneration.generate({
      requirement: {
        id: requirementRecord.requirementId, text: requirementRecord.text, category: requirementRecord.category,
        importance: requirementRecord.importance, extractedTerms: requirementRecord.extractedTerms,
        normalizedTerms: requirementRecord.normalizedTerms,
      },
      match: {
        classification: matchRecord.classification, confidence: matchRecord.confidence,
        evidenceIds: matchRecord.evidenceIds, evidenceScores: matchRecord.evidenceScores, reason: matchRecord.reason,
      },
      evidence,
    });
    if (!result) throw new AppError("No safe grounded suggestion was generated", 422, "SUGGESTION_NOT_SAFE");
    const sourceRecord = await ResumeEvidence.findOne({
      evidenceId: result.suggestion.targetEvidenceId,
      projectId,
      versionId,
    }).lean();
    if (!sourceRecord) throw new AppError("Suggestion target evidence was not found", 422, "EVIDENCE_NOT_FOUND");
    const sourceFile = await LatexFile.findOne({
      _id: sourceRecord.source.fileId,
      projectId,
    }).lean();
    if (!sourceFile) throw new AppError("Suggestion source file was not found", 404, "FILE_NOT_FOUND");
    const sourceLines = sourceFile.content.split(/\r?\n/);
    const before = sourceLines.slice(sourceRecord.source.lineStart - 1, sourceRecord.source.lineEnd).join("\n");
    const generatedBefore = result.suggestion.before;
    const occurrences = generatedBefore ? before.split(generatedBefore).length - 1 : 0;
    if (occurrences > 1) throw new AppError("Suggestion text is ambiguous within the source range", 422, "AMBIGUOUS_SOURCE");
    if (occurrences === 0 && before !== generatedBefore) {
      throw new AppError("Suggestion text could not be mapped to the source range", 422, "SOURCE_NOT_FOUND");
    }
    const sourceAfter = occurrences === 1 && generatedBefore
      ? before.replace(generatedBefore, result.suggestion.after)
      : result.suggestion.after;
    const suggestion = await TailoringSuggestion.create({
      ...result.suggestion, projectId, versionId, jobTargetId: requirementRecord.jobTargetId, suggestionId: randomUUID(), analysisId: requirementRecord.analysisId,
      requirementId, status: "pending", validation: "PASS",
      sourcePatch: {
        fileId: sourceRecord.source.fileId,
        fileName: sourceRecord.source.fileName,
        evidenceId: sourceRecord.evidenceId,
        lineStart: sourceRecord.source.lineStart,
        lineEnd: sourceRecord.source.lineEnd,
        before,
        after: sourceAfter,
        beforeHash: hashSourceText(before),
      },
    });
    res.status(201).json({ success: true, data: suggestion });
  } catch (error) {
    next(error);
  }
}

export async function getRequirements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const analysisId = requireString(req.params.analysisId, "analysisId");
    res.json({ success: true, data: await JobRequirement.find({ analysisId }).lean() });
  } catch (error) {
    next(error);
  }
}

export async function getAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const analysisId = requireString(req.params.analysisId, "analysisId");
    const analysis = await TailoringAnalysis.findOne({ analysisId }).lean();
    if (!analysis) throw new AppError("Analysis not found", 404, "ANALYSIS_NOT_FOUND");
    const [requirements, matches, suggestions] = await Promise.all([
      JobRequirement.find({ analysisId }).lean(),
      ResumeMatch.find({ analysisId }).lean(),
      TailoringSuggestion.find({ analysisId }).lean(),
    ]);
    const matchByRequirement = new Map(matches.map((match) => [match.requirementId, match]));
    res.json({
      success: true,
      data: {
        ...analysis,
        requirements: requirements.map((requirement) => ({
          ...requirement,
          match: matchByRequirement.get(requirement.requirementId) ?? null,
        })),
        suggestions,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await ResumeMatch.find({ analysisId: requireString(req.params.analysisId, "analysisId") }).lean() });
  } catch (error) {
    next(error);
  }
}

export async function getSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: await TailoringSuggestion.find({ analysisId: requireString(req.params.analysisId, "analysisId") }).lean() });
  } catch (error) {
    next(error);
  }
}

export async function getScopedSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = requireString(req.query.projectId, "projectId");
      const versionId = requireString(req.query.versionId, "versionId");
      const requestedAnalysisId = typeof req.query.analysisId === "string" ? req.query.analysisId : undefined;
      const latestAnalysis = requestedAnalysisId
        ? null
        : await TailoringAnalysis.findOne({ resumeId: projectId, resumeVersionId: versionId })
          .sort({ createdAt: -1 })
          .select({ analysisId: 1 })
          .lean();
      const analysisId = requestedAnalysisId ?? latestAnalysis?.analysisId;
      const scope = { projectId, versionId, analysisId: analysisId ?? "__no_analysis__" };
      const [suggestions, requirements, matches, evidence] = await Promise.all([
        TailoringSuggestion.find(scope).sort({ createdAt: -1 }).lean(),
        JobRequirement.find(scope).lean(),
        ResumeMatch.find(scope).lean(),
        ResumeEvidence.find({ projectId, versionId }).lean(),
      ]);
      const requirementById = new Map(requirements.map((item) => [item.requirementId, item]));
      const matchById = new Map(matches.map((item) => [item.requirementId, item]));
      const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
      res.json({
        success: true,
        data: suggestions.map((suggestion) => ({
          ...suggestion,
          requirement: requirementById.get(suggestion.requirementId)?.text ?? suggestion.requirementId,
          classification: matchById.get(suggestion.requirementId)?.classification,
          evidence: suggestion.evidenceIds.map((id) => {
            const item = evidenceById.get(id);
            return item ? {
              evidenceId: item.evidenceId,
              fileId: item.source.fileId,
              fileName: item.source.fileName,
              lineStart: item.source.lineStart,
              lineEnd: item.source.lineEnd,
              text: item.text,
            } : null;
          }).filter((item): item is NonNullable<typeof item> => item !== null),
        })),
      });
    } catch (error) {
      next(error);
    }
  }

export async function acceptSuggestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = requireString(req.body.projectId, "projectId");
    const versionId = requireString(req.body.versionId, "versionId");
    const result = await sourcePatch.apply({
      suggestionId: requireString(req.params.suggestionId, "suggestionId"),
      projectId,
      versionId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function rejectSuggestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const suggestionId = requireString(req.params.suggestionId, "suggestionId");
    const projectId = requireString(req.body.projectId, "projectId");
    const versionId = requireString(req.body.versionId, "versionId");
    const suggestion = await TailoringSuggestion.findOneAndUpdate(
      { suggestionId, projectId, versionId, validation: "PASS", status: "pending" },
      { $set: { status: "rejected" } },
      { new: true }
    ).lean();
    if (!suggestion) throw new AppError("Suggestion is unavailable or already processed", 409, "SUGGESTION_NOT_PENDING");
    res.json({ success: true, data: suggestion });
  } catch (error) {
    next(error);
  }
}

export async function editSuggestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const suggestionId = requireString(req.params.suggestionId, "suggestionId");
    const after = requireString(req.body.after, "after");
    const suggestion = await TailoringSuggestion.findOneAndUpdate({ suggestionId, validation: "PASS" }, { after, status: "edited" }, { new: true }).lean();
    if (!suggestion) throw new AppError("Safe suggestion not found", 404, "SUGGESTION_NOT_FOUND");
    res.json({ success: true, data: suggestion });
  } catch (error) {
    next(error);
  }
}

export function validateObjectId(value: string, name: string): void {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${name}`, 400);
}
