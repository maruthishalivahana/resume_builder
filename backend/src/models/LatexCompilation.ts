import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICompileError {
  severity: "error" | "warning";
  file: string | null;
  line: number | null;
  message: string;
}

export interface ILatexCompilation extends Document {
  projectId: Types.ObjectId;
  status: "success" | "failed" | "timeout";
  mainFile: string;
  compiledEntryFileId?: Types.ObjectId;
  compiledEntryFileUpdatedAt?: Date;
  sourceVersion: number;
  pdfPath?: string;
  pdfFileName?: string;
  stdout: string;
  stderr: string;
  compileErrors: ICompileError[];
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const LatexCompilationSchema = new Schema<ILatexCompilation>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "LatexProject",
      required: [true, "Project ID is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["success", "failed", "timeout"],
      required: true,
    },
    mainFile: {
      type: String,
      required: true,
      default: "main.tex",
    },
    compiledEntryFileId: {
      type: Schema.Types.ObjectId,
      ref: "LatexFile",
      required: false,
    },
    compiledEntryFileUpdatedAt: {
      type: Date,
      default: null,
    },
    sourceVersion: {
      type: Number,
      default: 0,
    },
    pdfPath: {
      type: String,
      default: null,
    },
    pdfFileName: {
      type: String,
      default: "main.pdf",
    },
    stdout: {
      type: String,
      default: "",
    },
    stderr: {
      type: String,
      default: "",
    },
    compileErrors: [
      {
        severity: {
          type: String,
          enum: ["error", "warning"],
          default: "error",
        },
        file: {
          type: String,
          default: null,
        },
        line: {
          type: Number,
          default: null,
        },
        message: {
          type: String,
          required: true,
        },
      },
    ],
    durationMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

LatexCompilationSchema.index({ projectId: 1, createdAt: -1 });

export const LatexCompilation = mongoose.model<ILatexCompilation>(
  "LatexCompilation",
  LatexCompilationSchema
);
