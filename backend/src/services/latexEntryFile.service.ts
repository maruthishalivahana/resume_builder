import { Types } from "mongoose";
import { ILatexFile } from "../models/LatexFile";
import { ILatexProject } from "../models/LatexProject";
import { AppError } from "../middleware/error.middleware";

export function validateEntryFile(file: Pick<ILatexFile, "projectId" | "path">, projectId: string): void {
  if (file.projectId?.toString() !== projectId.toLowerCase()) throw new AppError("Entry file is outside this project", 400, "ENTRY_FILE_INVALID");
  if (typeof file.path !== "string" || !file.path.toLowerCase().endsWith(".tex") ||
      file.path.includes("\\") || /[:\x00-\x1f]/.test(file.path) ||
      file.path.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new AppError("Entry file must be a valid project-relative .tex file", 400, "ENTRY_FILE_INVALID");
  }
}

export async function resolveEntryFile(
  project: Pick<ILatexProject, "_id" | "entryFileId" | "entryFileSelectionRequired">,
  files: ILatexFile[],
  requestedEntryFileId?: string
): Promise<ILatexFile> {
  if (requestedEntryFileId !== undefined) {
    if (typeof requestedEntryFileId !== "string" || !Types.ObjectId.isValid(requestedEntryFileId)) {
      throw new AppError("Invalid entryFileId", 400);
    }
  }
  const targetId = requestedEntryFileId !== undefined ? requestedEntryFileId.toLowerCase() : project.entryFileId?.toString();
  if (!targetId) {
    throw new AppError(
      "No entry file configured. Select a .tex file as the project's compilation entry.",
      400,
      "ENTRY_FILE_NOT_FOUND"
    );
  }
  const entryFile = files.find(file => file._id.toString() === targetId);
  if (!entryFile) throw new AppError(requestedEntryFileId !== undefined
    ? "Requested entry file is missing or outside this project."
    : "Configured entry file is missing or outside this project. Select an existing .tex entry file.", 400, "ENTRY_FILE_NOT_FOUND");
  validateEntryFile(entryFile, project._id.toString());
  return entryFile;
}
