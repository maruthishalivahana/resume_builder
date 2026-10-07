import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { LatexProject } from "../models/LatexProject";
import { LatexFile } from "../models/LatexFile";
import { LatexFolder } from "../models/LatexFolder";
import { AppError } from "../middleware/error.middleware";
import { LatexCompilerService } from "../services/latexCompiler.service";
import { bumpProjectSourceVersion } from "../services/latexProjectState.service";

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

    // 5. Create LatexFile associated with the project
    const latexFile = await LatexFile.create({
      projectId: project._id,
      folderId: null,
      name: originalName,
      path: originalName,
      content: utf8Content,
      language: "latex",
    });
    if (!project.entryFileId) {
      project.entryFileId = latexFile._id;
      project.entryFileSelectionRequired = false;
      await project.save();
    }
    await bumpProjectSourceVersion(project._id);

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
    const file = await LatexFile.findOne().sort({ updatedAt: -1, createdAt: -1 });
    if (!file) {
      res.status(200).json({
        success: true,
        data: null,
      });
      return;
    }

    const project = await LatexProject.findById(file.projectId);

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project?._id.toString() || "",
          name: project?.name || file.name.replace(/\.tex$/i, ""),
          compiler: project?.compiler || "pdflatex",
          entryFileId: project?.entryFileId?.toString() || null,
        },
        file: {
          id: file._id.toString(),
          name: file.name,
          path: file.path,
          content: file.content,
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

    const [files, folders] = await Promise.all([
      LatexFile.find({ projectId }).sort({ path: 1, createdAt: 1 }),
      LatexFolder.find({ projectId }).sort({ path: 1, createdAt: 1 }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        files: files.map((f) => ({
          id: f._id.toString(),
          name: f.name,
          path: f.path,
          folderId: f.folderId ? f.folderId.toString() : null,
          language: f.language,
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

    res.status(200).json({
      success: true,
      data: {
        file: {
          id: file._id.toString(),
          name: file.name,
          path: file.path,
          content: file.content,
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

    let targetPath = trimmedName;
    let targetFolderId: mongoose.Types.ObjectId | null = null;

    if (folderId) {
      if (!mongoose.Types.ObjectId.isValid(folderId)) {
        throw new AppError("Invalid folderId", 400);
      }
      const folder = await LatexFolder.findOne({
        _id: folderId,
        projectId,
      });
      if (!folder) {
        throw new AppError("Target folder not found in this project", 404);
      }
      targetFolderId = folder._id;
      targetPath = `${folder.path}/${trimmedName}`;
    }

    // Check for duplicate path in project
    const existing = await LatexFile.findOne({
      projectId,
      path: targetPath,
    });
    if (existing) {
      throw new AppError(`File '${targetPath}' already exists in this project`, 409);
    }

    // Default template: user supplied content, minimal skeleton if main.tex, or empty string
    const initialContent =
      typeof content === "string"
        ? content
        : trimmedName.toLowerCase() === "main.tex"
        ? "\\documentclass{article}\n\n\\begin{document}\n\n\\end{document}\n"
        : "";

    const file = await LatexFile.create({
      projectId,
      folderId: targetFolderId,
      name: trimmedName,
      path: targetPath,
      content: initialContent,
      language: "latex",
    });

    if (!project.entryFileId && !project.entryFileSelectionRequired && !targetFolderId) {
      project.entryFileId = file._id as any;
      project.entryFileSelectionRequired = false;
      await project.save();
    }
    await bumpProjectSourceVersion(project._id);

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

    let targetPath = trimmedName;
    let targetParentId: mongoose.Types.ObjectId | null = null;

    if (parentFolderId) {
      if (!mongoose.Types.ObjectId.isValid(parentFolderId)) {
        throw new AppError("Invalid parentFolderId", 400);
      }
      const parent = await LatexFolder.findOne({
        _id: parentFolderId,
        projectId,
      });
      if (!parent) {
        throw new AppError("Parent folder not found in this project", 404);
      }
      targetParentId = parent._id;
      targetPath = `${parent.path}/${trimmedName}`;
    }

    // Check duplicate folder path
    const existing = await LatexFolder.findOne({
      projectId,
      path: targetPath,
    });
    if (existing) {
      throw new AppError(`Folder '${targetPath}' already exists in this project`, 409);
    }

    const folder = await LatexFolder.create({
      projectId,
      name: trimmedName,
      path: targetPath,
      parentFolderId: targetParentId,
    });
    await bumpProjectSourceVersion(project._id);

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

    const file = await LatexFile.findById(fileId);
    if (!file) {
      throw new AppError("File not found", 404);
    }

    await LatexFile.findByIdAndDelete(fileId);
    const project = await LatexProject.findById(file.projectId);
    if (project?.entryFileId?.toString() === fileId) {
      project.entryFileId = null;
      project.entryFileSelectionRequired = true;
      await project.save();
    }
    await bumpProjectSourceVersion(file.projectId);

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
      throw new AppError("Folder not found", 404);
    }

    // Check for child files
    const hasFiles = await LatexFile.exists({ folderId: folder._id });
    if (hasFiles) {
      res.status(409).json({
        success: false,
        message: "Folder is not empty",
      });
      return;
    }

    // Check for child folders
    const hasSubfolders = await LatexFolder.exists({ parentFolderId: folder._id });
    if (hasSubfolders) {
      res.status(409).json({
        success: false,
        message: "Folder is not empty",
      });
      return;
    }

    await LatexFolder.findByIdAndDelete(folderId);
    await bumpProjectSourceVersion(folder.projectId);

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

    let newPath = trimmedName;
    if (file.folderId) {
      const folder = await LatexFolder.findById(file.folderId);
      if (folder) {
        newPath = `${folder.path}/${trimmedName}`;
      }
    }

    // Check duplicate path if path changed
    if (newPath !== file.path) {
      const duplicate = await LatexFile.findOne({
        projectId: file.projectId,
        path: newPath,
        _id: { $ne: file._id },
      });
      if (duplicate) {
        throw new AppError(`File '${newPath}' already exists in this project`, 409);
      }
    }

    file.name = trimmedName;
    file.path = newPath;
    await file.save();
    await bumpProjectSourceVersion(file.projectId);

    res.status(200).json({
      success: true,
      message: "File renamed successfully",
      data: {
        file: {
          id: file._id.toString(),
          name: file.name,
          path: file.path,
          folderId: file.folderId ? file.folderId.toString() : null,
          content: file.content,
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

    let newPath = trimmedName;
    if (folder.parentFolderId) {
      const parent = await LatexFolder.findById(folder.parentFolderId);
      if (parent) {
        newPath = `${parent.path}/${trimmedName}`;
      }
    }

    const oldPath = folder.path;

    if (newPath !== oldPath) {
      const duplicate = await LatexFolder.findOne({
        projectId: folder.projectId,
        path: newPath,
        _id: { $ne: folder._id },
      });
      if (duplicate) {
        throw new AppError(`Folder '${newPath}' already exists in this project`, 409);
      }
    }

    // Update folder itself
    folder.name = trimmedName;
    folder.path = newPath;
    await folder.save();

    // Cascade update to subfolders starting with oldPath + "/"
    const subfolders = await LatexFolder.find({
      projectId: folder.projectId,
      path: new RegExp(`^${oldPath}/`),
    });

    for (const sub of subfolders) {
      sub.path = sub.path.replace(new RegExp(`^${oldPath}/`), `${newPath}/`);
      await sub.save();
    }

    // Cascade update to files starting with oldPath + "/"
    const files = await LatexFile.find({
      projectId: folder.projectId,
      path: new RegExp(`^${oldPath}/`),
    });

    for (const f of files) {
      f.path = f.path.replace(new RegExp(`^${oldPath}/`), `${newPath}/`);
      await f.save();
    }
    await bumpProjectSourceVersion(folder.projectId);

    res.status(200).json({
      success: true,
      message: "Folder renamed successfully",
      data: {
        folder: {
          id: folder._id.toString(),
          name: folder.name,
          path: folder.path,
          parentFolderId: folder.parentFolderId
            ? folder.parentFolderId.toString()
            : null,
          updatedAt: folder.updatedAt,
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
 * Body: { content: string }
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

    const { content } = req.body as { content?: unknown };

    if (typeof content !== "string") {
      throw new AppError("'content' must be a string in the request body", 400);
    }

    const file = await LatexFile.findByIdAndUpdate(
      fileId,
      { $set: { content } },
      { new: true, runValidators: true }
    );

    if (!file) {
      throw new AppError("File not found", 404);
    }
    await bumpProjectSourceVersion(file.projectId);

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
 * Body: { entryFileId?: string }
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
    const { entryFileId } = req.body as { entryFileId?: string };
    if (!mongoose.Types.ObjectId.isValid(projectId) || !entryFileId) {
      throw new AppError("Valid projectId and entryFileId are required", 400);
    }
    const project = await LatexProject.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    const file = await LatexFile.findOne({ _id: entryFileId, projectId });
    if (!file) throw new AppError("Entry file not found in this project", 404);
    if (file.folderId || file.path.includes("/")) {
      throw new AppError("Only root-level .tex files can be entry files", 400);
    }
    if (!file.path.toLowerCase().endsWith(".tex")) {
      throw new AppError("Entry file must have a .tex extension", 400);
    }
    project.entryFileId = file._id;
    project.entryFileSelectionRequired = false;
    await project.save();
    await bumpProjectSourceVersion(project._id);
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

    const pdfInfo = await LatexCompilerService.getLatestSuccessfulPdf(projectId);
    if (!pdfInfo) {
      throw new AppError("No compiled PDF available for this project", 404);
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

    const record = await LatexCompilerService.getProjectCompilationState(projectId);
    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
}
