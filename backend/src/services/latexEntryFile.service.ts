import { Types } from "mongoose";
import { ILatexFile } from "../models/LatexFile";
import { ILatexProject } from "../models/LatexProject";
import { AppError } from "../middleware/error.middleware";

const LEGACY_ENTRY_FILE_NAME = "main.tex";

export async function resolveEntryFile(
  project: Pick<ILatexProject, "_id" | "entryFileId" | "entryFileSelectionRequired">,
  files: ILatexFile[],
  requestedEntryFileId?: string
): Promise<ILatexFile> {
  let entryFile: ILatexFile | undefined;

  if (requestedEntryFileId) {
    if (!Types.ObjectId.isValid(requestedEntryFileId)) {
      throw new AppError("Invalid entryFileId", 400);
    }
    entryFile = files.find((file) => file._id.toString() === requestedEntryFileId);
    if (!entryFile) {
      throw new AppError("Entry file not found in this project", 400);
    }
  } else if (project.entryFileId) {
    entryFile = files.find(
      (file) => file._id.toString() === project.entryFileId!.toString()
    );
    if (!entryFile) {
      const rootTexFiles = files.filter(
        (file) => !file.folderId && file.path.toLowerCase().endsWith(".tex")
      );
      if (rootTexFiles.length > 0) {
        entryFile = rootTexFiles[0];
      }
    }
  } else if (!project.entryFileSelectionRequired) {
    entryFile =
      files.find((file) => !file.folderId && file.path === LEGACY_ENTRY_FILE_NAME) ||
      files.find((file) => !file.folderId && file.path.toLowerCase() === LEGACY_ENTRY_FILE_NAME);
    if (!entryFile) {
      const rootTexFiles = files.filter(
        (file) => !file.folderId && file.path.toLowerCase().endsWith(".tex")
      );
      if (rootTexFiles.length >= 1) {
        entryFile = rootTexFiles[0];
      }
    }
  }

  if (!entryFile) {
    throw new AppError(
      "No entry file configured. Add a root-level .tex file or set one as the entry file.",
      400,
      "ENTRY_FILE_NOT_FOUND"
    );
  }

  return entryFile;
}
