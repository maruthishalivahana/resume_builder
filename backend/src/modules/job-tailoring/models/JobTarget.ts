import mongoose, { Document, Schema } from "mongoose";

export interface IJobTarget extends Document {
  resumeId: string;
  versionId: string;
  title?: string;
  company?: string;
  rawText: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IJobTarget>(
  {
    resumeId: { type: String, required: true, index: true },
    versionId: { type: String, required: true },
    title: String,
    company: String,
    rawText: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IJobTarget>("JobTarget", schema);
