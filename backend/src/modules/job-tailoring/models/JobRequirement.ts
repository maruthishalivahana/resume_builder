import mongoose, { Document, Schema } from "mongoose";
import { JobRequirementData } from "../types";

export interface IJobRequirement extends Omit<JobRequirementData, "id">, Document {
  requirementId: string;
  analysisId: string;
  projectId?: string;
  versionId?: string;
}

const schema = new Schema<IJobRequirement>(
  {
    requirementId: { type: String, required: true },
    analysisId: { type: String, required: true, index: true },
    projectId: { type: String, index: true },
    versionId: { type: String, index: true },
    text: { type: String, required: true },
    category: { type: String, required: true },
    importance: { type: String, required: true },
    extractedTerms: [String],
    normalizedTerms: [String],
  },
  { timestamps: true }
);

export default mongoose.model<IJobRequirement>("JobRequirement", schema);
