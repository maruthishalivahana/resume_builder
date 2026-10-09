import { randomUUID } from "crypto";
import JobRequirement from "../models/JobRequirement";
import ResumeEvidence from "../models/ResumeEvidence";
import ResumeMatch from "../models/ResumeMatch";
import TailoringAnalysis from "../models/TailoringAnalysis";
import TailoringSuggestion from "../models/TailoringSuggestion";
import JobTarget from "../models/JobTarget";
import { LatexFile } from "../../../models/LatexFile";
import { DeterministicLexicalSearchProvider, DeterministicTailoringGenerator, EmptyVectorSearchProvider, LLMProvider } from "../providers/interfaces";
import { OpenRouterLLMProvider } from "../providers/openrouter-llm.provider";
import { AnalysisSummary, MatchClassification } from "../types";
import { ClaimValidatorService } from "./claim-validator.service";
import { EvidenceRankerService } from "./evidence-ranker.service";
import { EvidenceValidatorService } from "./evidence-validator.service";
import { MatchClassifierService } from "./match-classifier.service";
import { RequirementExtractorService } from "./requirement-extractor.service";
import { ResumeIntelligenceService } from "./resume-intelligence.service";
import { RetrievalService } from "./retrieval.service";
import { GroundedGenerationService } from "./grounded-generation.service";
import { hashSourceText } from "../utils/source-hash.util";

export class TailoringOrchestratorService {
  private readonly extractor = new RequirementExtractorService();
  private readonly intelligence = new ResumeIntelligenceService();
  private readonly ranker = new EvidenceRankerService();
  private readonly classifier = new MatchClassifierService();
  private readonly evidenceValidator = new EvidenceValidatorService();
  private readonly claimValidator = new ClaimValidatorService();
  private readonly llmProvider: LLMProvider = process.env.LLM_PROVIDER === "openrouter"
    ? new OpenRouterLLMProvider()
    : new DeterministicTailoringGenerator();
  private readonly groundedGenerator = new GroundedGenerationService(this.llmProvider, this.claimValidator);
  private readonly retrieval = new RetrievalService(new DeterministicLexicalSearchProvider(), new EmptyVectorSearchProvider());

  async analyze(input: { resumeId: string; versionId: string; rawJobDescription: string; title?: string; company?: string }): Promise<{ analysisId: string; summary: AnalysisSummary }> {
    const analysisId = randomUUID();
    const startedAt = Date.now();
    const target = await JobTarget.create({
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
      jobTargetId: target._id.toString(),
      status: "running",
      pipelineStage: "job_target",
      startedAt: new Date(),
    });
    try {
      analysis.pipelineStage = "requirements";
      await analysis.save();
      const requirements = this.extractor.extract(input.rawJobDescription);
      await JobRequirement.insertMany(requirements.map((requirement) => ({
        ...requirement,
        requirementId: requirement.id,
        analysisId,
        projectId: input.resumeId,
        versionId: input.versionId,
      })));
      analysis.pipelineStage = "evidence";
      await analysis.save();
      const evidence = await this.intelligence.buildEvidence(input.resumeId, input.versionId);
      await ResumeEvidence.deleteMany({ resumeId: input.resumeId, versionId: input.versionId });
      await ResumeEvidence.insertMany(evidence.map((item) => ({ ...item, evidenceId: item.id })));
      const classifications: MatchClassification[] = [];
      let safeSuggestions = 0;
      for (const requirement of requirements) {
        const ranked = this.ranker.rank(requirement, evidence);
        const retrieved = await this.retrieval.retrieve(requirement, ranked);
        const verified = this.evidenceValidator.validate(requirement, retrieved).filter((item) => item.supports).map((item) => item.evidence);
        const match = this.classifier.classifyDetailed(requirement, ranked);
        classifications.push(match.classification);
        await ResumeMatch.updateOne(
          { projectId: input.resumeId, versionId: input.versionId, requirementId: requirement.id },
          {
            $set: {
              analysisId,
              projectId: input.resumeId,
              versionId: input.versionId,
              requirementId: requirement.id,
              classification: match.classification,
              confidence: match.confidence,
              evidenceIds: match.evidenceIds,
              evidenceScores: match.evidenceScores,
              reason: match.reason,
              bestScore: match.evidenceScores[0]?.hybridScore ?? 0,
            },
          },
          { upsert: true }
        );
        if (verified.length > 0 && match.classification !== "MISSING" && match.classification !== "CONFLICT") {
          const generated = await this.groundedGenerator.generate({
            requirement,
            match,
            evidence: verified,
          });
          if (generated) {
            const target = verified.find((item) => item.id === generated.suggestion.targetEvidenceId);
            const targetFile = target ? await LatexFile.findOne({ _id: target.source.fileId, projectId: input.resumeId }).lean() : null;
            const targetLines = targetFile?.content.split(/\r?\n/);
            const sourceBefore = target && targetLines
              ? targetLines.slice(target.source.lineStart - 1, target.source.lineEnd).join("\n")
              : null;
            const generatedBefore = generated.suggestion.before;
            const sourceOccurrences = sourceBefore && generatedBefore ? sourceBefore.split(generatedBefore).length - 1 : 0;
            const sourceAfter = sourceBefore && generatedBefore && sourceOccurrences === 1
              ? sourceBefore.replace(generatedBefore, generated.suggestion.after)
              : sourceBefore === generatedBefore ? generated.suggestion.after : null;
            if (!target || !sourceBefore || !sourceAfter || sourceOccurrences > 1) continue;
            await TailoringSuggestion.create({
              ...generated.suggestion,
              projectId: input.resumeId,
              versionId: input.versionId,
              requirementId: requirement.id,
              suggestionId: randomUUID(),
              analysisId,
              status: "pending",
              validation: "PASS",
              sourcePatch: {
                fileId: target.source.fileId,
                fileName: target.source.fileName,
                evidenceId: target.id,
                lineStart: target.source.lineStart,
                lineEnd: target.source.lineEnd,
                before: sourceBefore,
                after: sourceAfter,
                beforeHash: hashSourceText(sourceBefore),
              },
            });
            safeSuggestions += 1;
          }
        }
      }
      const summary: AnalysisSummary = {
        total: classifications.length,
        strong: classifications.filter((item) => item === "STRONG").length,
        partial: classifications.filter((item) => item === "PARTIAL").length,
        weak: classifications.filter((item) => item === "WEAK").length,
        missing: classifications.filter((item) => item === "MISSING").length,
        conflict: classifications.filter((item) => item === "CONFLICT").length,
        safeSuggestions,
      };
      analysis.status = "completed";
      analysis.pipelineStage = "completed";
      analysis.summary = summary;
      analysis.completedAt = new Date();
      analysis.durationMs = Date.now() - startedAt;
      await analysis.save();
      return { analysisId, summary };
    } catch (error) {
      analysis.status = "failed";
      analysis.pipelineStage = "failed";
      analysis.error = error instanceof Error ? error.message : "Unknown analysis failure";
      analysis.completedAt = new Date();
      analysis.durationMs = Date.now() - startedAt;
      await analysis.save();
      throw error;
    }
  }
}
