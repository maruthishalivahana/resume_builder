import mongoose, { Document, Schema } from "mongoose";
import { ResumeEvidenceData } from "../types";

export interface IResumeEvidence extends Omit<ResumeEvidenceData, "id">, Document {
  evidenceId: string;
}

const schema = new Schema<IResumeEvidence>(
  {
    evidenceId: { type: String, required: true, index: true },
    resumeId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    versionId: { type: String, required: true, index: true },
    section: { type: String, required: true },
    originalSectionName: String,
    subsection: String,
    type: { type: String, required: true },
    text: { type: String, required: true },
    source: {
      fileId: { type: String, required: true },
      fileName: { type: String, required: true },
      lineStart: { type: Number, required: true },
      lineEnd: { type: Number, required: true },
    },
    technologies: [String],
    entities: [String],
    normalizedTechnologies: [String],
    metadata: {
      technologies: [String],
      normalizedTechnologies: [String],
      entities: [String],
    },
    embeddingReference: String,
    embedding: { type: [Number], default: undefined },
    embeddingModel: String,
    embeddingDimensions: Number,
  },
  { timestamps: true }
);

schema.index({ projectId: 1, versionId: 1, evidenceId: 1 }, { unique: true });

export default mongoose.model<IResumeEvidence>("ResumeEvidence", schema);
