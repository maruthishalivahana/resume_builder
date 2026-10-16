import { randomUUID } from "crypto";
import JobRequirement from "../models/JobRequirement";
import ResumeEvidence from "../models/ResumeEvidence";
import ResumeMatch from "../models/ResumeMatch";
import TailoringAnalysis from "../models/TailoringAnalysis";
import TailoringSuggestion from "../models/TailoringSuggestion";
import JobTarget from "../models/JobTarget";
import { LatexFile } from "../../../models/LatexFile";
import { DeterministicLexicalSearchProvider, EmptyVectorSearchProvider, LLMProvider } from "../providers/interfaces";
import { AnalysisSummary, MatchClassification } from "../types";
import { ClaimValidatorService } from "./claim-validator.service";
import { EvidenceRankerService } from "./evidence-ranker.service";
import { EvidenceValidatorService } from "./evidence-validator.service";
import { MatchClassifierService } from "./match-classifier.service";
import { RequirementExtractorService } from "./requirement-extractor.service";
import { ResumeIntelligenceService } from "./resume-intelligence.service";
import { RetrievalService } from "./retrieval.service";
import { GroundedGenerationService } from "./grounded-generation.service";
import { createEvidenceSourcePatch } from "../utils/source-range.util";
import { tailoringDiagnostic, tailoringDiagnosticWarning } from "../utils/tailoring-diagnostic.util";
import { SuggestionReasonCode } from "../types";

import { resolveTailoringProviderConfig } from "../config/tailoring-provider.config";

export class TailoringOrchestratorService {
  private readonly extractor = new RequirementExtractorService();
  private readonly intelligence = new ResumeIntelligenceService();
  private readonly ranker = new EvidenceRankerService();
  private readonly classifier = new MatchClassifierService();
  private readonly evidenceValidator = new EvidenceValidatorService();
  private readonly claimValidator = new ClaimValidatorService();
  private readonly llmProvider: LLMProvider;
  private readonly fallbackProvider?: LLMProvider;
  private readonly providerName: string;
  private readonly modelName: string;
  private readonly retrieval = new RetrievalService(new DeterministicLexicalSearchProvider(), new EmptyVectorSearchProvider());

  constructor(customPrimary?: LLMProvider, customFallback?: LLMProvider) {
    if (customPrimary) {
      this.llmProvider = customPrimary;
      this.fallbackProvider = customFallback;
      this.providerName = customPrimary.constructor.name;
      this.modelName = "custom";
    } else {
      const config = resolveTailoringProviderConfig();
      this.llmProvider = config.primaryProvider;
      this.fallbackProvider = config.fallbackProvider;
      this.providerName = config.primaryProvider.constructor.name;
      this.modelName = config.model;
    }
  }

  async analyze(input: { resumeId: string; versionId: string; rawJobDescription: string; title?: string; company?: string }): Promise<{ analysisId: string; jobTargetId: string; summary: AnalysisSummary }> {
    // Rejection diagnostics are mutable; never share them across analyses.
    const groundedGenerator = new GroundedGenerationService(this.llmProvider, this.fallbackProvider, this.claimValidator);
    const analysisId = randomUUID();
    const startedAt = Date.now();
    const jobTarget = await JobTarget.create({
      resumeId: input.resumeId,
      versionId: input.versionId,
      title: input.title,
      company: input.company,
      rawText: input.rawJobDescription,
    });
    const analysis = await TailoringAnalysis.create({
      analysisId,
      resumeId: input.resumeId,
      resumeVersionId: input.versionId,
      jobTargetId: jobTarget._id.toString(),
      status: "running",
      pipelineStage: "job_target",
      startedAt: new Date(),
    });
    try {
      analysis.pipelineStage = "requirements";
      await analysis.save();
      const requirements = this.extractor.extract(input.rawJobDescription);
      tailoringDiagnostic("requirements.extracted", {
        analysisId,
        jobTargetId: jobTarget._id.toString(),
        count: requirements.length,
      });
      await JobRequirement.insertMany(requirements.map((requirement) => ({
        ...requirement,
        requirementId: requirement.id,
        analysisId,
        projectId: input.resumeId,
        versionId: input.versionId,
        jobTargetId: jobTarget._id.toString(),
      })));
      analysis.pipelineStage = "evidence";
      await analysis.save();
      const evidence = await this.intelligence.buildEvidence(input.resumeId, input.versionId);
      if (evidence.length > 0) {
        await ResumeEvidence.bulkWrite(
          evidence.map((item) => ({
            updateOne: {
              filter: {
                projectId: input.resumeId,
                versionId: input.versionId,
                evidenceId: item.id,
              },
              update: {
                $set: {
                  ...item,
                  evidenceId: item.id,
                  resumeId: input.resumeId,
                  projectId: input.resumeId,
                  versionId: input.versionId,
                },
              },
              upsert: true,
            },
          }))
        );
      }
      const classifications: MatchClassification[] = [];
      let safeSuggestions = 0;
      const diagnosticReasons: Record<string, number> = {};
      const recordReason = (reasonCode: string): void => {
        diagnosticReasons[reasonCode] = (diagnosticReasons[reasonCode] ?? 0) + 1;
      };
      if (requirements.length === 0) recordReason("NO_REQUIREMENTS");
      tailoringDiagnostic("analysis.started", {
        analysisId,
        jobTargetId: jobTarget._id.toString(),
        requirementsCount: requirements.length,
        evidenceCount: evidence.length,
        provider: this.providerName,
        model: this.modelName,
        fallbackConfigured: Boolean(this.fallbackProvider),
      });

      for (const requirement of requirements) {
        const ranked = this.ranker.rank(requirement, evidence);
        const retrieved = await this.retrieval.retrieve(requirement, ranked);
        const verified = this.evidenceValidator.validate(requirement, retrieved).filter((item) => item.supports).map((item) => item.evidence);
        const match = this.classifier.classifyDetailed(requirement, ranked);
        classifications.push(match.classification);

        tailoringDiagnostic("requirement.classified", {
          analysisId,
          jobTargetId: jobTarget._id.toString(),
          requirementId: requirement.id,
          category: requirement.category,
          importance: requirement.importance,
          rankedCount: ranked.length,
          retrievedCount: retrieved.length,
          verifiedCount: verified.length,
          classification: match.classification,
          confidence: Number(match.confidence.toFixed(2)),
          reasonCode: match.reasonCode,
        });
        if (verified.length === 0) recordReason(ranked.length === 0 ? "NO_EVIDENCE_RETRIEVED" : "NO_VERIFIED_EVIDENCE");

        await ResumeMatch.updateOne(
          { analysisId, requirementId: requirement.id },
          {
            $set: {
              analysisId,
              jobTargetId: jobTarget._id.toString(),
              projectId: input.resumeId,
              versionId: input.versionId,
              requirementId: requirement.id,
              classification: match.classification,
              confidence: match.confidence,
              evidenceIds: match.evidenceIds,
              evidenceScores: match.evidenceScores,
              reason: match.reason,
              reasonCode: match.reasonCode,
              bestScore: match.evidenceScores[0]?.hybridScore ?? 0,
            },
          },
          { upsert: true }
        );
        if (verified.length > 0 && match.classification !== "MISSING" && match.classification !== "CONFLICT") {
          tailoringDiagnostic("generation.dispatch", {
            analysisId,
            requirementId: requirement.id,
            provider: this.providerName,
            model: this.modelName,
            evidenceCount: verified.length,
          });
          const generated = await groundedGenerator.generate({
            requirement,
            match,
            evidence: verified,
          });
          if (generated) {
            tailoringDiagnostic("suggestion.generated", {
              analysisId,
              requirementId: requirement.id,
              type: generated.suggestion.type,
              providerUsed: generated.providerUsed ?? this.providerName,
              fallbackUsed: generated.fallbackUsed ?? false,
              validation: generated.validation.valid ? "PASS" : "FAIL",
            });
            const target = verified.find((item) => item.id === generated.suggestion.targetEvidenceId);
            const targetFile = target ? await LatexFile.findOne({ _id: target.source.fileId, projectId: input.resumeId }).lean() : null;
            let patch;
            try {
              if (!target || !targetFile) throw new Error("Suggestion source was not found");
              patch = createEvidenceSourcePatch(targetFile.content, target, generated.suggestion);
            } catch (error) {
              recordReason("SOURCE_PATCH_FAILED");
              tailoringDiagnosticWarning("suggestion.rejected.source_mapping", {
                analysisId, requirementId: requirement.id,
                reason: error instanceof Error ? error.message : "Source mapping failed",
              });
              continue;
            }
            await TailoringSuggestion.create({
              ...generated.suggestion,
              projectId: input.resumeId,
              versionId: input.versionId,
              requirementId: requirement.id,
              suggestionId: randomUUID(),
              analysisId,
              jobTargetId: jobTarget._id.toString(),
              status: "pending",
              validation: "PASS",
              reasonCode: "PERSISTED" as SuggestionReasonCode,
              sourcePatch: patch,
            });
            safeSuggestions += 1;
            tailoringDiagnostic("suggestion.persisted", {
              analysisId,
              requirementId: requirement.id,
              safeSuggestionCount: safeSuggestions,
            });
          } else {
            recordReason(groundedGenerator.getLastReasonCode() ?? "NO_EDIT_NEEDED");
            tailoringDiagnostic("suggestion.skipped.no_safe_edit", {
              analysisId,
              requirementId: requirement.id,
              reasonCode: groundedGenerator.getLastReasonCode() ?? "NO_EDIT_NEEDED",
            });
          }
        } else {
          tailoringDiagnostic("suggestion.skipped.ineligible_match", {
            analysisId,
            requirementId: requirement.id,
            verifiedCount: verified.length,
            classification: match.classification,
          });
        }
      }
      const persistedMatches = await ResumeMatch.find({ analysisId, jobTargetId: jobTarget._id.toString() }).lean();
      const summary: AnalysisSummary = {
        total: persistedMatches.length,
        strong: persistedMatches.filter((item) => item.classification === "STRONG").length,
        partial: persistedMatches.filter((item) => item.classification === "PARTIAL").length,
        weak: persistedMatches.filter((item) => item.classification === "WEAK").length,
        missing: persistedMatches.filter((item) => item.classification === "MISSING").length,
        conflict: persistedMatches.filter((item) => item.classification === "CONFLICT").length,
        safeSuggestions,
        diagnosticReasons,
      };
      analysis.status = "completed";
      analysis.pipelineStage = "completed";
      analysis.summary = summary;
      analysis.diagnosticReasons = diagnosticReasons;
      analysis.completedAt = new Date();
      analysis.durationMs = Date.now() - startedAt;
      await analysis.save();
      return { analysisId, jobTargetId: jobTarget._id.toString(), summary };
    } catch (error) {
      analysis.status = "failed";
      analysis.pipelineStage = "failed";
      analysis.error = "ANALYSIS_FAILED";
      analysis.completedAt = new Date();
      analysis.durationMs = Date.now() - startedAt;
      await analysis.save();
      tailoringDiagnosticWarning("analysis.failed", { analysisId, errorType: error instanceof Error ? error.name : "unknown" });
      throw error;
    }
  }
}
