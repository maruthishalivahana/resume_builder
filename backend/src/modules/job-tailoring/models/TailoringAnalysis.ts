import mongoose, { Document, Schema } from "mongoose";
import { AnalysisSummary } from "../types";

export type AnalysisStatus = "pending" | "running" | "completed" | "failed";

export interface ITailoringAnalysis extends Document {
  analysisId: string;
  resumeId: string;
  resumeVersionId: string;
  jobTargetId: string;
  status: AnalysisStatus;
  pipelineStage: string;
  summary?: AnalysisSummary;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

const schema = new Schema<ITailoringAnalysis>(
  {
    analysisId: { type: String, required: true, unique: true },
    resumeId: { type: String, required: true, index: true },
    resumeVersionId: { type: String, required: true },
    jobTargetId: { type: String, required: true },
    status: { type: String, required: true, default: "pending" },
    pipelineStage: { type: String, required: true, default: "created" },
    summary: Schema.Types.Mixed,
    error: String,
    startedAt: Date,
    completedAt: Date,
    durationMs: Number,
  },
  { timestamps: true }
);

export default mongoose.model<ITailoringAnalysis>("TailoringAnalysis", schema);
