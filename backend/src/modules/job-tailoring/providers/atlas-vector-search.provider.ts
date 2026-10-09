import ResumeEvidence from "../models/ResumeEvidence";
import { ScopedVectorSearchProvider, SemanticSearchResult } from "./interfaces";

export class AtlasVectorSearchProvider implements ScopedVectorSearchProvider {
  constructor(private readonly indexName = process.env.ATLAS_VECTOR_INDEX_NAME ?? "resume_evidence_vector") {}

  async search(params: {
    projectId: string;
    versionId: string;
    queryVector: number[];
    limit: number;
  }): Promise<SemanticSearchResult[]> {
    const records = await ResumeEvidence.aggregate<SemanticSearchResult>([
      {
        $vectorSearch: {
          index: this.indexName,
          path: "embedding",
          queryVector: params.queryVector,
          numCandidates: Math.max(params.limit * 10, 50),
          limit: params.limit,
          filter: { projectId: params.projectId, versionId: params.versionId },
        },
      },
      {
        $project: {
          _id: 0,
          evidenceId: 1,
          text: 1,
          section: 1,
          type: 1,
          source: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);
    return records;
  }
}

export class MongoVectorSearchProvider implements ScopedVectorSearchProvider {
  async search(params: {
    projectId: string;
    versionId: string;
    queryVector: number[];
    limit: number;
  }): Promise<SemanticSearchResult[]> {
    const records = await ResumeEvidence.find({
      projectId: params.projectId,
      versionId: params.versionId,
      embedding: { $exists: true, $type: "array" },
    }).lean();
    return records
      .map((record) => ({
        evidenceId: record.evidenceId,
        score: cosineSimilarity(params.queryVector, record.embedding ?? []),
        text: record.text,
        section: record.section,
        type: record.type,
        source: record.source,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, params.limit);
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}
