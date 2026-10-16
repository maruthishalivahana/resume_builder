import { Request, Response, NextFunction } from "express";
import { finalizeFileWrite, finalizeFileDeletion } from "../services/latexWriteRecovery.service";
import mongoose from "mongoose";
import { mutateTree, recoverTree, recoverDeletedTreeNode, assertTreeReady } from "../services/latexTree.service";
import { LatexProject } from "../models/LatexProject";
import { LatexFile } from "../models/LatexFile";
import { LatexFolder } from "../models/LatexFolder";
import { LatexCompilation } from "../models/LatexCompilation";
import { AppError } from "../middleware/error.middleware";
import { LatexCompilerService } from "../services/latexCompiler.service";
import { validateEntryFile } from "../services/latexEntryFile.service";

/**
 * Derives a project name from the uploaded filename by stripping the .tex extension.
 */
function deriveProjectName(filename: string): string {
  const baseName = filename.replace(/\.tex$/i, "").trim();
  return baseName.length > 0 ? baseName : "Untitled Project";
}

/**
 * Validates a single file or folder name segment.
 * Disallows path traversal, slashes, windows drives, and illegal characters.
 */
function validateSegmentName(name: string): void {
  if (!name || typeof name !== "string") {
    throw new AppError("Name is required and must be a string", 400);
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new AppError("Name cannot be empty", 400);
  }
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new AppError(
      "Invalid name: path separators (/ or \\) and traversal sequences (..) are not allowed",
      400
    );
  }
  if (/^[a-zA-Z]:/.test(trimmed)) {
    throw new AppError("Invalid name: absolute drive paths are not allowed", 400);
  }
  if (/[<>:"|?*]/.test(trimmed)) {
    throw new AppError("Invalid name: contains forbidden characters", 400);
  }
}

/**
 * POST /api/latex/upload
 * Accepts multipart/form-data with a single file under the field 'file'.
 * Reads UTF-8 content in memory and creates LatexProject + LatexFile in MongoDB.
 * Backward compatible: if projectId is passed in body, adds to existing project.
 */
export async function uploadTexFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;

    // 1. Verify file exists
    if (!file) {
      throw new AppError(
        "No file uploaded. Please upload a .tex file using the 'file' field",
        400
      );
    }

    // 2. Validate file extension
    const originalName = file.originalname.trim();
    if (!originalName.toLowerCase().endsWith(".tex")) {
      throw new AppError("Invalid file type. File must have a .tex extension", 400);
    }

    // 3. Read in-memory buffer as UTF-8 string
    const utf8Content = file.buffer.toString("utf-8");

    // 4. Check if importing into an existing project or creating new
    let project;
    const existingProjectId = req.body?.projectId;
    if (existingProjectId && mongoose.Types.ObjectId.isValid(existingProjectId)) {
      project = await LatexProject.findById(existingProjectId);
    }

    if (!project) {
      const projectName = deriveProjectName(originalName);
      project = await LatexProject.create({
        name: projectName,
        compiler: "pdflatex",
      });
    }

    const createdId = await mutateTree(project._id.toString(), { kind: "create", type: "file", name: originalName,
      parentId: null, content: utf8Content, selectEntry: false });
    const latexFile = (await LatexFile.findById(createdId))!;
    project = (await LatexProject.findById(project._id))!;

    // 6. Return standardized HTTP 201 response
    res.status(201).json({
      success: true,
      message: "LaTeX file uploaded successfully",
      data: {
        project: {
          id: project._id.toString(),
          name: project.name,
          compiler: project.compiler,
          entryFileId: project.entryFileId?.toString() || null,
        },
        file: {
          id: latexFile._id.toString(),
          name: latexFile.name,
          path: latexFile.path,
          content: latexFile.content,
          contentRevision: latexFile.contentRevision ?? 0,
          folderId: null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/latex/latest
 * Retrieves the most recently uploaded/edited LaTeX file and its project.
 */
export async function getLatestLatexFile(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = await LatexFile.find().sort({ updatedAt: -1, createdAt: -1 }).limit(50);
    let file: (typeof files)[number] | null = null;
    let project: (typeof LatexProject.prototype) | null = null;
    for (const candidate of files) {
      const candidateProject = await LatexProject.findById(candidate.projectId);
      if (candidateProject) {
        file = candidate;
        project = candidateProject;
        break;
      }
    }

    if (!file || !project) {
      res.status(200).json({
        success: true,
        data: null,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project._id.toString(),
          name: project.name,
          compiler: project.compiler,
          entryFileId: project.entryFileId?.toString() || null,
        },
        file: {
          id: file._id.toString(),
          name: file.name,
          path: file.path,
          content: file.content,
          contentRevision: file.contentRevision ?? 0,
          folderId: file.folderId ? file.folderId.toString() : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/latex/projects
 * Creates a new LaTeX project.
 * Body: { name: string }
 */
export async function createProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new AppError("Project name is required", 400);
    }

    const trimmedName = name.trim();
    const project = await LatexProject.create({
      name: trimmedName,
      compiler: "pdflatex",
    });

    res.status(201).json({
      success: true,
      data: {
        project: {
          id: project._id.toString(),
          name: project.name,
          compiler: project.compiler,
          entryFileId: project.entryFileId?.toString() || null,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/latex/projects/:projectId
 * Returns project metadata.
 */
export async function getProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new AppError("Invalid projectId", 400);
    }

    const project = await LatexProject.findById(projectId);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project._id.toString(),
          name: project.name,
          compiler: project.compiler,
          entryFileId: project.entryFileId?.toString() || null,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/latex/projects/:projectId/files
 * Lists all files and folders belonging to a project.
 */
export async function getProjectFiles(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new AppError("Invalid projectId", 400);
    }

    const treeVersion = await assertTreeReady(projectId);
    const [files, folders] = await Promise.all([
      LatexFile.find({ projectId }).sort({ path: 1, createdAt: 1 }),
      LatexFolder.find({ projectId }).sort({ path: 1, createdAt: 1 }),
    ]);

    if (await assertTreeReady(projectId) !== treeVersion) {
      throw new AppError("Project tree changed while loading. Reload the tree.", 409, "TREE_CHANGED");
    }
    res.status(200).json({
      success: true,
      data: {
        files: files.map((f) => ({
          id: f._id.toString(),
          name: f.name,
          path: f.path,
          folderId: f.folderId ? f.folderId.toString() : null,
          language: f.language,
          contentRevision: f.contentRevision ?? 0,
          lineCount: f.content ? f.content.split("\n").length : 0,
          updatedAt: (f as any).updatedAt,
        })),
        folders: folders.map((f) => ({
          id: f._id.toString(),
          name: f.name,
          path: f.path,
          parentFolderId: f.parentFolderId ? f.parentFolderId.toString() : null,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/latex/files/:fileId
 * Returns a single LaTeX file including its full content.
 */
export async function getLatexFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new AppError("Invalid fileId", 400);
    }

    const file = await LatexFile.findById(fileId);
    if (!file) {
      throw new AppError("File not found", 404);
    }
    if (file.pendingDelete) {
      if (!await finalizeFileDeletion(file)) throw new AppError("Deletion recovery pending; local drafts are retained", 503, "DELETE_RECOVERY_PENDING");
      throw new AppError("File was deleted", 404);
    }

    const recoveryPending = !await finalizeFileWrite(file);
    res.status(200).json({
      success: true,
      data: {
        file: {
          id: file._id.toString(),
          name: file.name,
          path: file.path,
          content: file.content,
          recoveryPending,
          contentRevision: file.contentRevision ?? 0,
          folderId: file.folderId ? file.folderId.toString() : null,
          language: file.language,
          lineCount: file.content ? file.content.split("\n").length : 0,
          updatedAt: (file as any).updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/latex/projects/:projectId/files
 * Creates a new .tex file in a project (optionally inside a folder).
 * Body: { name: string, folderId?: string | null }
 */
export async function createFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new AppError("Invalid projectId", 400);
    }

    const project = await LatexProject.findById(projectId);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const { name, folderId, content } = req.body as {
      name?: string;
      folderId?: string | null;
      content?: string;
    };

    if (!name || typeof name !== "string") {
      throw new AppError("File name is required", 400);
    }

    const trimmedName = name.trim();
    if (!trimmedName.toLowerCase().endsWith(".tex")) {
      throw new AppError("File must have a .tex extension", 400);
    }

    validateSegmentName(trimmedName);

    if (folderId != null && (typeof folderId !== "string" || !mongoose.Types.ObjectId.isValid(folderId))) throw new AppError("Invalid folderId", 400);
    const initialContent = typeof content === "string" ? content : trimmedName.toLowerCase() === "main.tex"
      ? "\\documentclass{article}\n\n\\begin{document}\n\n\\end{document}\n" : "";
    const createdId = await mutateTree(projectId, { kind: "create", type: "file", name: trimmedName,
      parentId: folderId ?? null, content: initialContent, selectEntry: true });
    const file = (await LatexFile.findById(createdId))!;

    res.status(201).json({
      success: true,
      message: "File created successfully",
      data: {
        file: {
          id: file._id.toString(),
          name: file.name,
          path: file.path,
          folderId: file.folderId ? file.folderId.toString() : null,
          content: file.content,
          contentRevision: file.contentRevision ?? 0,
          lineCount: file.content ? file.content.split("\n").length : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/latex/projects/:projectId/folders
 * Creates a new folder in a project (optionally nested).
 * Body: { name: string, parentFolderId?: string | null }
 */
export async function createFolder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new AppError("Invalid projectId", 400);
    }

    const project = await LatexProject.findById(projectId);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const { name, parentFolderId } = req.body as {
      name?: string;
      parentFolderId?: string | null;
    };

    if (!name || typeof name !== "string") {
      throw new AppError("Folder name is required", 400);
    }

    const trimmedName = name.trim();
    validateSegmentName(trimmedName);

    if (parentFolderId != null && (typeof parentFolderId !== "string" || !mongoose.Types.ObjectId.isValid(parentFolderId))) throw new AppError("Invalid parentFolderId", 400);
    const createdId = await mutateTree(projectId, { kind: "create", type: "folder", name: trimmedName, parentId: parentFolderId ?? null });
    const folder = (await LatexFolder.findById(createdId))!;

    res.status(201).json({
      success: true,
      message: "Folder created successfully",
      data: {
        folder: {
          id: folder._id.toString(),
          name: folder.name,
          path: folder.path,
          parentFolderId: folder.parentFolderId
            ? folder.parentFolderId.toString()
            : null,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/latex/files/:fileId
 * Deletes a single file.
 */
export async function deleteFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new AppError("Invalid fileId", 400);
    }

    const expectedRevision = req.body?.expectedRevision;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new AppError("Deletion requires expectedRevision", 400);
    const file = await LatexFile.findById(fileId);
    if (!file) {
      await recoverDeletedTreeNode(fileId, "file");
      res.status(200).json({ success: true, message: "File already deleted" }); return;
    }
    if (file.pendingWrite && !await finalizeFileWrite(file)) throw new AppError("Finish committed write recovery before deleting", 409, "WRITE_RECOVERY_PENDING");

    await mutateTree(file.projectId.toString(), { kind: "delete", type: "file", id: fileId, expectedRevision });

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/latex/folders/:folderId
 * Deletes a folder ONLY if it is empty.
 * Returns 409 Conflict if folder contains files or subfolders.
 */
export async function deleteFolder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { folderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      throw new AppError("Invalid folderId", 400);
    }

    const folder = await LatexFolder.findById(folderId);
    if (!folder) {
      await recoverDeletedTreeNode(folderId, "folder");
      res.status(200).json({ success: true, message: "Folder already deleted" }); return;
    }

    await mutateTree(folder.projectId.toString(), { kind: "delete", type: "folder", id: folderId });

    res.status(200).json({
      success: true,
      message: "Folder deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/latex/files/:fileId/name
 * Renames a file, updating its name and path.
 * Body: { name: string }
 */
export async function renameFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fileId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new AppError("Invalid fileId", 400);
    }

    const file = await LatexFile.findById(fileId);
    if (!file) {
      throw new AppError("File not found", 404);
    }

    const { name } = req.body as { name?: string };
    if (!name || typeof name !== "string") {
      throw new AppError("New file name is required", 400);
    }

    const trimmedName = name.trim();
    if (!trimmedName.toLowerCase().endsWith(".tex")) {
      throw new AppError("File must have a .tex extension", 400);
    }

    validateSegmentName(trimmedName);

    await mutateTree(file.projectId.toString(), { kind: "rename", type: "file", id: fileId, name: trimmedName });
    const renamed = (await LatexFile.findById(fileId))!;

    res.status(200).json({
      success: true,
      message: "File renamed successfully",
      data: {
        file: {
          id: renamed._id.toString(),
          name: renamed.name,
          path: renamed.path,
          folderId: renamed.folderId ? renamed.folderId.toString() : null,
          content: renamed.content,
          contentRevision: renamed.contentRevision ?? 0,
          lineCount: renamed.content ? renamed.content.split("\n").length : 0,
          updatedAt: renamed.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/latex/folders/:folderId/name
 * Renames a folder, and cascades path updates to all subfolders and files underneath it.
 * Body: { name: string }
 */
export async function renameFolder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { folderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      throw new AppError("Invalid folderId", 400);
    }

    const folder = await LatexFolder.findById(folderId);
    if (!folder) {
      throw new AppError("Folder not found", 404);
    }

    const { name } = req.body as { name?: string };
    if (!name || typeof name !== "string") {
      throw new AppError("New folder name is required", 400);
    }

    const trimmedName = name.trim();
    validateSegmentName(trimmedName);

    await mutateTree(folder.projectId.toString(), { kind: "rename", type: "folder", id: folderId, name: trimmedName });
    const renamed = (await LatexFolder.findById(folderId))!;

    res.status(200).json({
      success: true,
      message: "Folder renamed successfully",
      data: {
        folder: {
          id: renamed._id.toString(),
          name: renamed.name,
          path: renamed.path,
          parentFolderId: renamed.parentFolderId
            ? renamed.parentFolderId.toString()
            : null,
          updatedAt: renamed.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/latex/files/:fileId
 * Updates only the content field of a LaTeX file.
 * Body: { content: string, expectedRevision: number }
 */
export async function updateLatexFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new AppError("Invalid fileId", 400);
    }

    const { content, expectedRevision } = req.body as { content?: unknown; expectedRevision?: unknown };

    if (typeof content !== "string") {
      throw new AppError("'content' must be a string in the request body", 400);
    }

    if (typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new AppError("expectedRevision must be a non-negative integer; reload the file before saving", 400);
    }
    const previous = await LatexFile.findById(fileId);
    if (previous?.pendingWrite && !await finalizeFileWrite(previous)) {
      throw new AppError("Previous content committed; metadata recovery is pending. Reload to reconcile.", 503, "WRITE_RECOVERY_PENDING");
    }
    const file = await LatexFile.findOneAndUpdate(
      { _id: fileId, pendingWrite: { $exists: false }, pendingDelete: { $ne: true }, ...(expectedRevision === 0
        ? { $or: [{ contentRevision: 0 }, { contentRevision: { $exists: false } }] }
        : { contentRevision: expectedRevision }) },
      { $set: { content, pendingWrite: { kind: "editor" } }, $inc: { contentRevision: 1 } },
      { new: true, runValidators: true }
    );

    if (!file) {
      if (!await LatexFile.exists({ _id: fileId })) throw new AppError("File not found", 404);
      throw new AppError("Revision conflict: this file changed on the server. Local edits are retained; compare with the server before retrying.", 409, "FILE_REVISION_CONFLICT");
    }
    const recoveryPending = !await finalizeFileWrite(file);

    res.status(200).json({
      success: true,
      message: "File updated successfully",
      data: {
        file: {
          id: file._id.toString(),
          name: file.name,
          path: file.path,
          folderId: file.folderId ? file.folderId.toString() : null,
          updatedAt: (file as any).updatedAt,
          contentRevision: file.contentRevision,
          content: file.content,
          recoveryPending,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/latex/compiler/status
 * Returns availability and version of the configured LaTeX compiler.
 */
export async function checkCompilerStatus(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await LatexCompilerService.checkCompilerAvailability();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/latex/projects/:projectId/compile
 * Compiles a LaTeX project from MongoDB.
 * Body: { entryFileId?: string } — explicit build target; omission uses the project default.
 */
export async function compileProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new AppError("Invalid projectId", 400);
    }

    const { entryFileId } = (req.body || {}) as { entryFileId?: string };

    const result = await LatexCompilerService.compileLatexProject({
      projectId,
      entryFileId,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/latex/projects/:projectId/entry-file
 * Sets a root-level .tex file as the project's entry file.
 */
export async function setProjectEntryFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { entryFileId } = (req.body || {}) as { entryFileId?: string };
    if (!mongoose.Types.ObjectId.isValid(projectId) || typeof entryFileId !== "string" || !mongoose.Types.ObjectId.isValid(entryFileId)) {
      throw new AppError("Valid projectId and entryFileId are required", 400);
    }
    const project = await LatexProject.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    const file = await LatexFile.findOne({ _id: entryFileId, projectId });
    if (!file) throw new AppError("Entry file not found in this project", 404);
    validateEntryFile(file, projectId);
    // Entry selection and source invalidation commit together, fenced against tree mutations.
    const updated = await LatexProject.updateOne({ _id: project._id, treeOperation: { $exists: false },
      ...((project.treeVersion ?? 0) === 0 ? { $or: [{ treeVersion: 0 }, { treeVersion: { $exists: false } }] } : { treeVersion: project.treeVersion }) },
      { $set: { entryFileId: file._id, entryFileSelectionRequired: false }, $inc: { sourceVersion: 1 } });
    if (!updated.matchedCount) throw new AppError("Project tree changed or recovery is pending. Reload before selecting the entry file.", 409, "TREE_CHANGED");
    res.status(200).json({
      success: true,
      data: { project: { id: project._id.toString(), entryFileId: file._id.toString() } },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/latex/projects/:projectId/pdf
 * Returns the latest compiled PDF file as application/pdf for inline browser viewing.
 */
export async function getProjectPdf(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new AppError("Invalid projectId", 400);
    }

    const compilationId = req.query.compilationId;
    if (compilationId !== undefined && (typeof compilationId !== "string" || !mongoose.Types.ObjectId.isValid(compilationId))) {
      throw new AppError("Invalid compilationId", 400);
    }
    const pdfInfo = await LatexCompilerService.getLatestSuccessfulPdf(projectId, compilationId);
    if (!pdfInfo) {
      throw new AppError(compilationId ? "Requested compilation PDF not found in this project" : "No compiled PDF available for this project", 404);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${pdfInfo.fileName}"`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    res.sendFile(pdfInfo.absolutePath);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/latex/projects/:projectId/compilation/latest
 * Returns latest compilation record for a project.
 */
export async function getLatestCompilation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw new AppError("Invalid projectId", 400);
    }

    const entryFileId = req.query.entryFileId;
    if (entryFileId !== undefined && (typeof entryFileId !== "string" || !mongoose.Types.ObjectId.isValid(entryFileId))) throw new AppError("Invalid entryFileId", 400);
    const record = await LatexCompilerService.getProjectCompilationState(projectId, entryFileId);
    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
}

/** Explicit roll-forward recovery for a durable namespace mutation. */
export async function getCompilationHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params;
    const { entryFileId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(projectId) || typeof entryFileId !== "string" || !mongoose.Types.ObjectId.isValid(entryFileId)) throw new AppError("Valid projectId and entryFileId are required", 400);
    if (!await LatexProject.findById(projectId)) throw new AppError("Project not found", 404);
    const page = Number(req.query.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000) throw new AppError("Invalid history page", 400);
    const records = await LatexCompilation.find({ projectId, compiledEntryFileId: entryFileId }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(21);
    res.json({ success: true, data: { builds: records.slice(0, 20), page, hasMore: records.length > 20 } });
  } catch (error) { next(error); }
}

export async function recoverProjectTree(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) throw new AppError("Invalid projectId", 400);
    await recoverTree(projectId);
    res.status(200).json({ success: true, message: "Project tree recovery complete" });
  } catch (error) { next(error); }
}
