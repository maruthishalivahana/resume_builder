import mongoose, { Document, Schema } from "mongoose";
import { MatchClassification } from "../types";

export interface IResumeMatch extends Document {
  analysisId?: string;
  projectId: string;
  versionId: string;
  requirementId: string;
  classification: MatchClassification;
  confidence: number;
  evidenceIds: string[];
  evidenceScores: Array<{
    evidenceId: string;
    lexicalScore: number;
    semanticScore: number;
    hybridScore: number;
  }>;
  reason: string;
  bestScore: number;
}

const schema = new Schema<IResumeMatch>(
  {
    analysisId: { type: String, index: true },
    projectId: { type: String, required: true, index: true },
    versionId: { type: String, required: true, index: true },
    requirementId: { type: String, required: true },
    classification: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    evidenceIds: [String],
    evidenceScores: [{
      evidenceId: { type: String, required: true },
      lexicalScore: { type: Number, required: true },
      semanticScore: { type: Number, required: true },
      hybridScore: { type: Number, required: true },
    }],
    reason: { type: String, required: true },
    bestScore: { type: Number, required: true },
  },
  { timestamps: true }
);

schema.index({ projectId: 1, versionId: 1, requirementId: 1 }, { unique: true });

export default mongoose.model<IResumeMatch>("ResumeMatch", schema);
