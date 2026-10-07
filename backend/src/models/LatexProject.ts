import mongoose, { Document, Schema, Types } from "mongoose";

export interface ILatexProject extends Document {
  name: string;
  compiler: "pdflatex" | "xelatex";
  entryFileId: Types.ObjectId | null;
  entryFileSelectionRequired: boolean;
  sourceVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const LatexProjectSchema = new Schema<ILatexProject>(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },
    compiler: {
      type: String,
      enum: {
        values: ["pdflatex", "xelatex"],
        message: "{VALUE} is not a supported compiler",
      },
      default: "pdflatex",
    },
    entryFileId: {
      type: Schema.Types.ObjectId,
      ref: "LatexFile",
      default: null,
    },
    entryFileSelectionRequired: {
      type: Boolean,
      default: false,
    },
    sourceVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const LatexProject = mongoose.model<ILatexProject>(
  "LatexProject",
  LatexProjectSchema
);
