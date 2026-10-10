import mongoose, { Document, Schema } from "mongoose";
import { SourcePatch, SuggestionReasonCode, SuggestionStatus, SuggestionType } from "../types";

export interface ITailoringSuggestion extends Document {
  suggestionId: string;
  analysisId: string;
  jobTargetId: string;
  requirementId: string;
  projectId: string;
  versionId: string;
  type: SuggestionType;
  targetEvidenceId?: string;
  before?: string;
  after?: string;
  reason: string;
  evidenceIds: string[];
  confidence: number;
  status: SuggestionStatus;
  validation: "PASS" | "FAIL";
  reasonCode?: SuggestionReasonCode;
  sourcePatch?: SourcePatch;
  appliedAt?: Date;
  appliedFileId?: string;
  appliedLineStart?: number;
  appliedLineEnd?: number;
  appliedBeforeHash?: string;
  appliedAfterHash?: string;
}

const schema = new Schema<ITailoringSuggestion>(
  {
    suggestionId: { type: String, required: true, unique: true },
    analysisId: { type: String, required: true, index: true },
    jobTargetId: { type: String, required: true, index: true },
    requirementId: { type: String, required: true },
    projectId: { type: String, required: true, index: true },
    versionId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    targetEvidenceId: String,
    before: String,
    after: String,
    reason: { type: String, required: true },
    evidenceIds: [String],
    confidence: { type: Number, min: 0, max: 1, required: true },
    status: { type: String, required: true, default: "pending" },
    validation: { type: String, required: true },
    reasonCode: String,
    sourcePatch: {
      fileId: { type: String, required: true },
      fileName: { type: String, required: true },
      evidenceId: { type: String, required: true },
      lineStart: { type: Number, required: true },
      lineEnd: { type: Number, required: true },
      before: { type: String, required: true },
      after: { type: String, required: true },
      beforeHash: { type: String, required: true },
    },
    appliedAt: Date,
    appliedFileId: String,
    appliedLineStart: Number,
    appliedLineEnd: Number,
    appliedBeforeHash: String,
    appliedAfterHash: String,
  },
  { timestamps: true }
);

export default mongoose.model<ITailoringSuggestion>("TailoringSuggestion", schema);
