import JobRequirement from "../models/JobRequirement";
import ResumeMatch from "../models/ResumeMatch";
import { HybridRetrievalService } from "./hybrid-retrieval.service";
import { ClassifierEvidence, MatchClassifierService } from "./match-classifier.service";

export class MatchAnalysisService {
  constructor(
    private readonly retrieval: HybridRetrievalService,
    private readonly classifier: MatchClassifierService
  ) {}

  async analyze(input: {
    projectId: string;
    versionId: string;
    requirementIds?: string[];
  }): Promise<{ matches: Array<{
    requirementId: string;
    classification: string;
    confidence: number;
    evidenceIds: string[];
    reason: string;
  }> }> {
    const filter: Record<string, unknown> = {
      projectId: input.projectId,
      versionId: input.versionId,
      ...(input.requirementIds?.length ? { requirementId: { $in: input.requirementIds } } : {}),
    };
    const requirements = await JobRequirement.find(filter).lean();
    const matches = [];
    for (const requirement of requirements) {
      const retrieved = await this.retrieval.search({
        projectId: input.projectId,
        versionId: input.versionId,
        query: requirement.text,
        limit: 20,
      });
      const evidence: ClassifierEvidence[] = retrieved.results.map((item) => ({
        id: item.evidenceId,
        text: item.text,
        hybridScore: item.hybridScore,
        lexicalScore: item.lexicalScore,
        semanticScore: item.semanticScore,
      }));
      const result = this.classifier.classifyDetailed({
        id: requirement.requirementId,
        text: requirement.text,
        category: requirement.category,
        importance: requirement.importance,
        extractedTerms: requirement.extractedTerms,
        normalizedTerms: requirement.normalizedTerms,
      }, evidence);
      await ResumeMatch.updateOne(
        { projectId: input.projectId, versionId: input.versionId, requirementId: requirement.requirementId },
        {
          $set: {
            projectId: input.projectId,
            versionId: input.versionId,
            requirementId: requirement.requirementId,
            classification: result.classification,
            confidence: result.confidence,
            evidenceIds: result.evidenceIds,
            evidenceScores: result.evidenceScores,
            reason: result.reason,
            bestScore: result.evidenceScores[0]?.hybridScore ?? 0,
          },
        },
        { upsert: true }
      );
      matches.push({ requirementId: requirement.requirementId, ...result });
    }
    return { matches };
  }
}
