import ResumeEvidence from "../models/ResumeEvidence";
import { EmbeddingProvider } from "../providers/interfaces";

export interface EmbeddingIndexInput {
  projectId: string;
  versionId: string;
}

export interface EmbeddingIndexStats {
  totalEvidence: number;
  embedded: number;
  skipped: number;
  failed: number;
  dimensions?: number;
  provider: string;
  model: string;
  failures: Array<{ evidenceId: string; error: string }>;
}

export class EmbeddingIndexService {
  constructor(
    private readonly provider: EmbeddingProvider & { dimensions?: number; model?: string },
    private readonly batchSize = 32
  ) {}

  async embedEvidence(evidence: { evidenceId: string; text: string }): Promise<number[]> {
    const vector = await this.provider.embed(evidence.text);
    this.validateVector(vector);
    return vector;
  }

  async indexResumeEmbeddings(input: EmbeddingIndexInput): Promise<EmbeddingIndexStats> {
    const records = await ResumeEvidence.find({ projectId: input.projectId, versionId: input.versionId }).sort({ evidenceId: 1 });
    const missing = records.filter((record) => !this.isValidVector(record.embedding));
    const stats: EmbeddingIndexStats = {
      totalEvidence: records.length,
      embedded: 0,
      skipped: records.length - missing.length,
      failed: 0,
      dimensions: this.provider.dimensions,
      provider: this.provider.constructor.name,
      model: this.provider.model ?? "unknown",
      failures: [],
    };

    for (let offset = 0; offset < missing.length; offset += this.batchSize) {
      const batch = missing.slice(offset, offset + this.batchSize);
      let vectors: number[][];
      try {
        vectors = await this.provider.embedBatch(batch.map((record) => record.text));
      } catch (error) {
        for (const record of batch) {
          stats.failed += 1;
          stats.failures.push({ evidenceId: record.evidenceId, error: error instanceof Error ? error.message : "Embedding provider failed" });
        }
        continue;
      }
      if (vectors.length !== batch.length) {
        for (const record of batch) {
          stats.failed += 1;
          stats.failures.push({ evidenceId: record.evidenceId, error: "Embedding provider returned an incorrect batch length" });
        }
        continue;
      }
      for (let index = 0; index < batch.length; index += 1) {
        try {
          const vector = vectors[index];
          this.validateVector(vector);
          await ResumeEvidence.updateOne(
            { projectId: input.projectId, versionId: input.versionId, evidenceId: batch[index].evidenceId },
            { $set: { embedding: vector, embeddingModel: stats.model, embeddingDimensions: vector.length } }
          );
          stats.embedded += 1;
          stats.dimensions = vector.length;
        } catch (error) {
          stats.failed += 1;
          stats.failures.push({ evidenceId: batch[index].evidenceId, error: error instanceof Error ? error.message : "Invalid embedding" });
        }
      }
    }
    return stats;
  }

  private isValidVector(value: unknown): value is number[] {
    return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "number" && Number.isFinite(item));
  }

  private validateVector(vector: number[]): void {
    if (!this.isValidVector(vector)) throw new Error("Embedding must be a non-empty finite numeric vector");
    if (this.provider.dimensions !== undefined && vector.length !== this.provider.dimensions) {
      throw new Error(`Embedding dimension mismatch: expected ${this.provider.dimensions}, received ${vector.length}`);
    }
  }
}
