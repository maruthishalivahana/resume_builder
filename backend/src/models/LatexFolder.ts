import mongoose, { Document, Schema, Types } from "mongoose";

export interface ILatexFolder extends Document {
  projectId: Types.ObjectId;
  name: string;
  path: string;
  parentFolderId: Types.ObjectId | null;
  treeVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

const LatexFolderSchema = new Schema<ILatexFolder>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "LatexProject",
      required: [true, "Project ID is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Folder name is required"],
      trim: true,
    },
    path: {
      type: String,
      required: [true, "Folder path is required"],
      trim: true,
    },
    parentFolderId: {
      type: Schema.Types.ObjectId,
      ref: "LatexFolder",
      default: null,
    },
    treeVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Compound index on projectId and path
LatexFolderSchema.index({ projectId: 1, path: 1 });

export const LatexFolder = mongoose.model<ILatexFolder>(
  "LatexFolder",
  LatexFolderSchema
);
