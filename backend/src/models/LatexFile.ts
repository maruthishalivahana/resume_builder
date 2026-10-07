import mongoose, { Document, Schema, Types } from "mongoose";

export interface ILatexFile extends Document {
  projectId: Types.ObjectId;
  folderId: Types.ObjectId | null;
  name: string;
  path: string;
  content: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

const LatexFileSchema = new Schema<ILatexFile>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "LatexProject",
      required: [true, "Project ID is required"],
      index: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "LatexFolder",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
    },
    path: {
      type: String,
      required: [true, "File path is required"],
      trim: true,
    },
    content: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "latex",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index on projectId and path
LatexFileSchema.index({ projectId: 1, path: 1 });

export const LatexFile = mongoose.model<ILatexFile>(
  "LatexFile",
  LatexFileSchema
);
